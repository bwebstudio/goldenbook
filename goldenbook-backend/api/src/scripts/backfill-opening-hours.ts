#!/usr/bin/env tsx
// ─── Backfill opening_hours from Google Places (Places API v1) ────────────
//
// Usage:
//   npx tsx api/src/scripts/backfill-opening-hours.ts --dry-run
//   npx tsx api/src/scripts/backfill-opening-hours.ts
//
// Scope:
//   - Targets every published place (place_type ≠ 'hotel') that has NO rows
//     in opening_hours. Hotels are excluded by user requirement: a hotel's
//     general entry doesn't need hours. Bars/restaurants/spas inside hotels
//     are separate place_type='bar'/'restaurant'/etc rows and DO get covered.
//
// Strategy:
//   1. If the place already has google_place_id → fetch details directly.
//   2. Otherwise → run a text search "<name> <city> Portugal" and use the
//      top result. Skip if Google returns nothing or the place is marked
//      permanently closed (we never invent hours).
//   3. Map regularOpeningHours.periods into opening_hours rows. Day numbers
//      already match (0=Sunday). Multiple periods on the same day become
//      multiple rows with incrementing slot_order. Overnight periods are
//      stored on the opening day with closes_at = the close hour (frontend
//      handles "22:00–02:00" naturally).
//   4. Wrap each place in a transaction. Mark enrichment_status / enriched_at.
//
// Exit code:
//   0 — done (some places may have been left empty due to no Google data)
//   1 — fatal error (e.g. missing API key)

import { db } from '../db/postgres'
import { searchGooglePlaces } from '../modules/admin/places/generate-place'

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY_TYPE = process.argv.find((a) => a.startsWith('--type='))?.slice('--type='.length)
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith('--limit='))
  if (!arg) return undefined
  const n = parseInt(arg.slice('--limit='.length), 10)
  return Number.isFinite(n) ? n : undefined
})()
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

const DETAIL_FIELDS = [
  'id',
  'displayName',
  'regularOpeningHours',
  'businessStatus',
].join(',')

interface GooglePeriodPoint {
  day: number          // 0=Sun, 1=Mon, ..., 6=Sat
  hour: number
  minute: number
}
interface GooglePeriod {
  open?: GooglePeriodPoint
  close?: GooglePeriodPoint
}
interface GoogleDetail {
  id: string
  displayName?: { text: string }
  regularOpeningHours?: {
    periods?: GooglePeriod[]
  }
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY'
}

async function fetchDetails(placeId: string): Promise<GoogleDetail | null> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': DETAIL_FIELDS,
      },
    })
    if (!res.ok) return null
    return (await res.json()) as GoogleDetail
  } catch {
    return null
  }
}

interface Candidate {
  id: string
  name: string
  place_type: string
  city_slug: string
  google_place_id: string | null
}

async function loadCandidates(): Promise<Candidate[]> {
  const params: unknown[] = []
  let typeClause = ''
  if (ONLY_TYPE) {
    typeClause = `AND p.place_type = $1`
    params.push(ONLY_TYPE)
  }
  const limitClause = LIMIT ? ` LIMIT ${LIMIT}` : ''
  const { rows } = await db.query<Candidate>(
    `
    SELECT p.id, p.name, p.place_type, d.slug AS city_slug, p.google_place_id
    FROM   places p
    JOIN   destinations d ON d.id = p.destination_id
    WHERE  p.status = 'published'
      AND  p.place_type <> 'hotel'
      ${typeClause}
      AND  NOT EXISTS (SELECT 1 FROM opening_hours oh WHERE oh.place_id = p.id)
    ORDER  BY d.slug, p.place_type, p.name
    ${limitClause}
    `,
    params,
  )
  return rows
}

interface OpeningHourRow {
  day_of_week: number
  opens_at: string  // 'HH:MM'
  closes_at: string // 'HH:MM'
  slot_order: number
  is_closed: boolean
}

/**
 * Convert Google's `regularOpeningHours.periods` to rows for our schema.
 *
 * Google's day numbering already matches ours (0=Sunday). Each period maps
 * to one row on the opening day. If close.day differs (overnight), we still
 * store the close time on the opening day's row — the frontend renders this
 * naturally as "22:00–02:00".
 *
 * Days that have no period at all become a closed marker. A single period
 * with open hour=0 minute=0 and no close (Google's "always open") expands
 * to seven 00:00–23:59 rows.
 *
 * Returns null if the input is unusable (no periods, all malformed, etc).
 */
function mapPeriodsToRows(periods: GooglePeriod[] | undefined): OpeningHourRow[] | null {
  if (!periods || periods.length === 0) return null

  // ── Always-open special case ────────────────────────────────────────────
  // Google encodes "always open" as exactly one period { open: day=0 h=0 m=0 }
  // with no close. Expand to 7 rows of 00:00–23:59 so the table renders
  // every day rather than just Sunday.
  if (periods.length === 1) {
    const p = periods[0]
    if (p.open && p.open.hour === 0 && p.open.minute === 0 && !p.close) {
      const rows: OpeningHourRow[] = []
      for (let d = 0; d < 7; d++) {
        rows.push({ day_of_week: d, opens_at: '00:00', closes_at: '23:59', slot_order: 0, is_closed: false })
      }
      return rows
    }
  }

  // ── Group periods by day_of_week and assign slot_order ─────────────────
  const byDay = new Map<number, OpeningHourRow[]>()
  for (const period of periods) {
    if (!period.open) continue
    const day = period.open.day
    if (day < 0 || day > 6) continue
    const opens = `${String(period.open.hour).padStart(2, '0')}:${String(period.open.minute).padStart(2, '0')}`
    // If close is missing, treat as "open until end of day". This is rare —
    // Google usually returns explicit close times for venues with hours.
    const closes = period.close
      ? `${String(period.close.hour).padStart(2, '0')}:${String(period.close.minute).padStart(2, '0')}`
      : '23:59'

    const slot: OpeningHourRow = {
      day_of_week: day,
      opens_at: opens,
      closes_at: closes,
      slot_order: 0,
      is_closed: false,
    }

    const arr = byDay.get(day) ?? []
    arr.push(slot)
    byDay.set(day, arr)
  }

  if (byDay.size === 0) return null

  // Sort each day's slots by opens_at and assign slot_order
  for (const [day, arr] of byDay) {
    arr.sort((a, b) => a.opens_at.localeCompare(b.opens_at))
    for (let i = 0; i < arr.length; i++) arr[i].slot_order = i
    byDay.set(day, arr)
  }

  // Mark missing days as explicitly closed so the UI renders "Closed"
  // instead of swallowing the row entirely. Google omits closed days from
  // periods, so a missing day === closed.
  const out: OpeningHourRow[] = []
  for (let d = 0; d < 7; d++) {
    const slots = byDay.get(d)
    if (slots && slots.length > 0) {
      out.push(...slots)
    } else {
      out.push({
        day_of_week: d,
        opens_at: '00:00', // ignored when is_closed=true, but the column is NOT NULL safe
        closes_at: '00:00',
        slot_order: 0,
        is_closed: true,
      })
    }
  }
  return out
}

interface InsertResult {
  ok: boolean
  reason?: string
  rows?: number
  resolvedGoogleId?: string
}

async function backfillOne(c: Candidate): Promise<InsertResult> {
  // 1. Resolve google_place_id
  let googleId = c.google_place_id
  if (!googleId) {
    const query = `${c.name} ${c.city_slug} Portugal`
    const results = await searchGooglePlaces(query)
    if (results.length === 0) return { ok: false, reason: 'no-search-match' }
    googleId = results[0].placeId
  }

  // 2. Fetch detail with hours
  const details = await fetchDetails(googleId)
  if (!details) return { ok: false, reason: 'fetch-failed' }
  if (details.businessStatus === 'CLOSED_PERMANENTLY') {
    return { ok: false, reason: 'permanently-closed' }
  }

  // 3. Map to rows
  const rows = mapPeriodsToRows(details.regularOpeningHours?.periods)
  if (!rows) return { ok: false, reason: 'no-hours-on-google' }

  if (DRY_RUN) {
    return { ok: true, rows: rows.length, resolvedGoogleId: googleId }
  }

  // 4. Insert in a transaction. Also persist the resolved google_place_id
  //    if we discovered it via search, so future runs are faster.
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Defensive: clean any stale rows for this place. We targeted only
    // places with zero rows but the audit could have raced.
    await client.query('DELETE FROM opening_hours WHERE place_id = $1', [c.id])

    for (const r of rows) {
      await client.query(
        `INSERT INTO opening_hours (place_id, day_of_week, opens_at, closes_at, is_closed, slot_order)
         VALUES ($1, $2, $3::time, $4::time, $5, $6)`,
        [c.id, r.day_of_week, r.is_closed ? null : r.opens_at, r.is_closed ? null : r.closes_at, r.is_closed, r.slot_order],
      )
    }

    if (!c.google_place_id && googleId) {
      // Some places share the same Google entity (e.g. a chain with two
      // editorial entries, or a multi-city sub-brand). The unique index on
      // google_place_id will fire — that's expected. We still want the
      // opening_hours rows to land, so wrap the UPDATE in a savepoint and
      // roll back ONLY that statement on conflict.
      await client.query('SAVEPOINT gid_save')
      try {
        await client.query(
          `UPDATE places SET google_place_id = $1 WHERE id = $2 AND google_place_id IS NULL`,
          [googleId, c.id],
        )
        await client.query('RELEASE SAVEPOINT gid_save')
      } catch (gErr: any) {
        await client.query('ROLLBACK TO SAVEPOINT gid_save')
        if (!String(gErr?.message ?? '').includes('idx_places_google_place_id')) throw gErr
        // shared-google-id collision — silently keep going
      }
    }

    await client.query(
      `UPDATE places
       SET enriched_at = NOW(),
           enrichment_status = 'hours_backfilled'
       WHERE id = $1`,
      [c.id],
    )

    await client.query('COMMIT')
    return { ok: true, rows: rows.length, resolvedGoogleId: googleId }
  } catch (err: any) {
    await client.query('ROLLBACK')
    return { ok: false, reason: `db-error: ${err.message}` }
  } finally {
    client.release()
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Backfill opening_hours from Google Places')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  if (ONLY_TYPE) console.log(`  Filter: place_type = ${ONLY_TYPE}`)
  if (LIMIT)     console.log(`  Limit:  ${LIMIT}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  if (!GOOGLE_API_KEY) {
    console.error('Missing GOOGLE_MAPS_API_KEY / GOOGLE_PLACES_API_KEY')
    process.exit(1)
  }

  const candidates = await loadCandidates()
  console.log(`Found ${candidates.length} candidates\n`)

  let success = 0
  let failed = 0
  const failures: Record<string, number> = {}
  const failureSamples: Record<string, string[]> = {}

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    process.stdout.write(`[${i + 1}/${candidates.length}] [${c.city_slug}] ${c.place_type.padEnd(10)} ${c.name}  `)

    const result = await backfillOne(c)
    if (result.ok) {
      console.log(`✓ ${result.rows} rows`)
      success++
    } else {
      console.log(`✗ ${result.reason}`)
      failed++
      failures[result.reason ?? 'unknown'] = (failures[result.reason ?? 'unknown'] ?? 0) + 1
      const samples = failureSamples[result.reason ?? 'unknown'] ?? []
      if (samples.length < 5) samples.push(`[${c.city_slug}] ${c.name}`)
      failureSamples[result.reason ?? 'unknown'] = samples
    }

    // Polite throttle — Google Places API has per-second limits.
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(`  Done: ${success} succeeded, ${failed} failed (${candidates.length} total)`)
  console.log('═══════════════════════════════════════════════════════════')
  if (Object.keys(failures).length > 0) {
    console.log('\nFailure breakdown:')
    for (const [reason, count] of Object.entries(failures)) {
      console.log(`  ${reason}: ${count}`)
      const samples = failureSamples[reason] ?? []
      for (const s of samples) console.log(`    · ${s}`)
    }
  }

  await db.end()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
