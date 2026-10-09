import { describe, it, expect } from 'vitest'
import { openingHoursSchema, toOpeningHourRows, validateOpeningWeek, type OpeningDayInput } from '../opening-hours'
import { updatePlaceSchema, createPlaceSchema } from '../admin-places.dto'

const open = (dayOfWeek: number, ...intervals: [string, string][]): OpeningDayInput => ({
  dayOfWeek,
  closed: false,
  intervals: intervals.map(([opens, closes]) => ({ opens, closes })),
})
const closed = (dayOfWeek: number): OpeningDayInput => ({ dayOfWeek, closed: true, intervals: [] })

describe('validateOpeningWeek', () => {
  it('accepts split shifts, closed days and an overnight last interval', () => {
    expect(validateOpeningWeek([
      open(1, ['12:00', '15:00'], ['19:00', '23:00']),
      open(5, ['18:00', '20:00'], ['22:00', '02:00']),
      closed(0),
    ])).toBeNull()
  })

  it('rejects overlapping intervals', () => {
    expect(validateOpeningWeek([open(2, ['10:00', '14:00'], ['13:00', '18:00'])])).toMatch(/overlapping/)
  })

  it('rejects an overnight interval followed by another one on the same day', () => {
    expect(validateOpeningWeek([open(6, ['22:00', '02:00'], ['23:00', '23:30'])])).toMatch(/overlapping/)
  })

  it('rejects opens == closes, open days without intervals, closed days with intervals, duplicates', () => {
    expect(validateOpeningWeek([open(1, ['10:00', '10:00'])])).toMatch(/same time/)
    expect(validateOpeningWeek([open(1)])).toMatch(/no intervals/)
    expect(validateOpeningWeek([{ dayOfWeek: 1, closed: true, intervals: [{ opens: '10:00', closes: '12:00' }] }])).toMatch(/closed/)
    expect(validateOpeningWeek([closed(1), closed(1)])).toMatch(/more than once/)
  })
})

describe('openingHoursSchema', () => {
  it('rejects malformed times and out-of-range days', () => {
    expect(openingHoursSchema.safeParse([open(1, ['9:00', '12:00'])]).success).toBe(false)
    expect(openingHoursSchema.safeParse([open(1, ['24:00', '12:00'])]).success).toBe(false)
    expect(openingHoursSchema.safeParse([open(7, ['09:00', '12:00'])]).success).toBe(false)
  })

  it('is wired into the create and update payloads', () => {
    const week = [open(1, ['09:00', '18:00'])]
    expect(updatePlaceSchema.parse({ openingHours: week }).openingHours).toEqual(week)
    expect(updatePlaceSchema.parse({}).openingHours).toBeUndefined()
    expect(updatePlaceSchema.safeParse({ openingHours: [open(1, ['10:00', '14:00'], ['13:00', '18:00'])] }).success).toBe(false)
    expect(createPlaceSchema.shape.openingHours).toBeDefined()
  })
})

describe('toOpeningHourRows', () => {
  it('returns no rows for an empty week (hours unknown)', () => {
    expect(toOpeningHourRows([])).toEqual([])
  })

  it('writes every weekday, sorting intervals and marking missing days closed', () => {
    const rows = toOpeningHourRows([
      open(1, ['19:00', '23:00'], ['12:00', '15:00']),
      open(5, ['22:00', '02:00']),
      closed(3),
    ])
    expect(rows.filter((r) => r.day_of_week === 1)).toEqual([
      { day_of_week: 1, opens_at: '12:00', closes_at: '15:00', is_closed: false, slot_order: 0 },
      { day_of_week: 1, opens_at: '19:00', closes_at: '23:00', is_closed: false, slot_order: 1 },
    ])
    // Overnight stays on the opening day with closes_at < opens_at, the same
    // shape the Google backfill writes.
    expect(rows.filter((r) => r.day_of_week === 5)).toEqual([
      { day_of_week: 5, opens_at: '22:00', closes_at: '02:00', is_closed: false, slot_order: 0 },
    ])
    for (const d of [0, 2, 3, 4, 6]) {
      expect(rows.filter((r) => r.day_of_week === d)).toEqual([
        { day_of_week: d, opens_at: null, closes_at: null, is_closed: true, slot_order: 0 },
      ])
    }
  })
})
