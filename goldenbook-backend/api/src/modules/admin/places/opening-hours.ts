// ─── Opening hours: editor input → opening_hours rows ───────────────────────
//
// Storage format (unchanged, shared with the Google backfill scripts, the
// public place detail, the NOW engine and plan/route generation):
//
//   opening_hours(place_id, day_of_week 0=Sunday..6, opens_at time,
//                 closes_at time, is_closed bool, slot_order int)
//
//   - one row per open interval; slot_order orders the intervals of a day
//   - a closed day is ONE row with is_closed = true and NULL times
//   - an overnight interval (22:00-02:00) is stored on the day it opens with
//     closes_at < opens_at, exactly as the Google backfill writes it
//   - a place with no rows at all means "hours unknown" (NOW does not filter
//     it out); a day with no row renders as closed in the app
//
// The editor submits one entry per weekday. Days left out of a non-empty
// submission are written as closed rows so the app and the NOW engine agree
// that the place is not open on them. An empty array clears every row (back
// to "unknown").

import { z } from 'zod'
import type { db } from '../../../db/postgres'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const timeSchema = z
  .string()
  .regex(TIME_RE, 'Time must be HH:MM (00:00-23:59)')

export const openingIntervalSchema = z.object({
  opens:  timeSchema,
  closes: timeSchema,
})

export const openingDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  closed:    z.boolean(),
  intervals: z.array(openingIntervalSchema).max(6).default([]),
})

export type OpeningDayInput = z.infer<typeof openingDaySchema>

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Validate the whole week. Returns the first problem as a human readable
 * message, or null. Kept separate from the zod shape so the rules can be
 * unit-tested and reused by the dashboard copy.
 *
 *   - each weekday at most once
 *   - a closed day carries no intervals; an open day carries at least one
 *   - opens != closes (24h is 00:00-23:59)
 *   - intervals of a day do not overlap; an overnight interval runs into the
 *     next day, so it can only be the last one of its day
 *   - the next day does not open before that overnight interval closes
 */
export function validateOpeningWeek(days: readonly OpeningDayInput[]): string | null {
  const seen = new Set<number>()
  // Minutes past midnight that each day's overnight interval reaches into the
  // next day, and each open day's earliest opening, for the cross-day check.
  const spillByDay = new Map<number, number>()
  const firstOpenByDay = new Map<number, number>()
  for (const day of days) {
    if (seen.has(day.dayOfWeek)) return `Day ${day.dayOfWeek} appears more than once`
    seen.add(day.dayOfWeek)

    if (day.closed) {
      if (day.intervals.length > 0) return `Day ${day.dayOfWeek} is closed but has opening intervals`
      continue
    }
    if (day.intervals.length === 0) return `Day ${day.dayOfWeek} is open but has no intervals`

    const spans = day.intervals.map((iv) => {
      const start = toMinutes(iv.opens)
      let end = toMinutes(iv.closes)
      if (end === start) return null
      if (end < start) end += 24 * 60 // overnight
      return { start, end }
    })
    if (spans.some((s) => s === null)) {
      return `Day ${day.dayOfWeek} has an interval that opens and closes at the same time`
    }
    const sorted = (spans as { start: number; end: number }[]).sort((a, b) => a.start - b.start)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) return `Day ${day.dayOfWeek} has overlapping intervals`
    }
    firstOpenByDay.set(day.dayOfWeek, sorted[0].start)
    const spill = Math.max(0, ...sorted.map((s) => s.end - 24 * 60))
    if (spill > 0) spillByDay.set(day.dayOfWeek, spill)
  }
  for (const [dow, spill] of spillByDay) {
    const next = (dow + 1) % 7
    const firstOpen = firstOpenByDay.get(next)
    if (firstOpen !== undefined && firstOpen < spill) {
      return `Day ${next} opens before day ${dow}'s overnight interval closes`
    }
  }
  return null
}

export const openingHoursSchema = z
  .array(openingDaySchema)
  .max(7)
  .superRefine((days, ctx) => {
    const problem = validateOpeningWeek(days)
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem })
  })

export interface OpeningHourRowInput {
  day_of_week: number
  opens_at:    string | null
  closes_at:   string | null
  is_closed:   boolean
  slot_order:  number
}

/** Map validated editor input to opening_hours rows (see header). */
export function toOpeningHourRows(days: readonly OpeningDayInput[]): OpeningHourRowInput[] {
  if (days.length === 0) return []
  const byDay = new Map(days.map((d) => [d.dayOfWeek, d]))
  const rows: OpeningHourRowInput[] = []
  for (let dow = 0; dow < 7; dow++) {
    const day = byDay.get(dow)
    if (!day || day.closed || day.intervals.length === 0) {
      rows.push({ day_of_week: dow, opens_at: null, closes_at: null, is_closed: true, slot_order: 0 })
      continue
    }
    const sorted = [...day.intervals].sort((a, b) => a.opens.localeCompare(b.opens))
    sorted.forEach((iv, i) => {
      rows.push({ day_of_week: dow, opens_at: iv.opens, closes_at: iv.closes, is_closed: false, slot_order: i })
    })
  }
  return rows
}

/**
 * Replace the full set of opening_hours rows for a place. Must run inside the
 * caller's transaction so a failed save never leaves a half-written week.
 *
 * The Google backfill scripts (backfill-opening-hours, enrich-restaurants,
 * context-engine) only ever insert for places that have zero rows, so hours
 * set here are never overwritten by them. Clearing all hours (empty array)
 * makes the place eligible for the next backfill again.
 */
export async function replaceOpeningHours(
  client: { query: typeof db.query },
  placeId: string,
  days: readonly OpeningDayInput[],
): Promise<void> {
  const rows = toOpeningHourRows(days)
  await client.query(`DELETE FROM opening_hours WHERE place_id = $1`, [placeId])
  if (rows.length === 0) return
  await client.query(
    `
    INSERT INTO opening_hours (place_id, day_of_week, opens_at, closes_at, is_closed, slot_order)
    SELECT $1, r.day_of_week, r.opens_at::time, r.closes_at::time, r.is_closed, r.slot_order
    FROM unnest($2::smallint[], $3::text[], $4::text[], $5::boolean[], $6::int[])
         AS r(day_of_week, opens_at, closes_at, is_closed, slot_order)
    `,
    [
      placeId,
      rows.map((r) => r.day_of_week),
      rows.map((r) => r.opens_at),
      rows.map((r) => r.closes_at),
      rows.map((r) => r.is_closed),
      rows.map((r) => r.slot_order),
    ],
  )
}
