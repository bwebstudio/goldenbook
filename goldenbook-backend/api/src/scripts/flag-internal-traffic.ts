#!/usr/bin/env tsx
// ─── Flag QA traffic that reached analytics unmarked ────────────────────────
//
// Internal traffic is normally marked at write time: dev and TestFlight builds
// send `x-gb-internal: 1` and events.route.ts stores `is_internal` from it.
// That wiring is in place and works.
//
// It only covers clients that send the header. Testing from a store build, a
// browser, or a build where IS_INTERNAL_BUILD was false still lands in the
// table as real usage. The 20260805120000 migration backfilled the history
// once; this script is the same pass, re-runnable, for whatever has arrived
// since. At the time of writing that was 161 searches between 6 Aug and
// 12 Sep 2026.
//
// The marker is a digits-only search ("111", "1111"). It is mechanical rather
// than a guess about intent: nobody searches a guidebook for "1111". A session
// that typed one is a test session end to end, so the flag cascades from the
// search to its session and from the session to its events.
//
// Nothing is deleted. `is_internal` is a flag readers exclude, so a mistake
// here is reversible with an UPDATE.
//
// Usage:
//   npx tsx api/src/scripts/flag-internal-traffic.ts            # dry run
//   npx tsx api/src/scripts/flag-internal-traffic.ts --confirm

import { db } from '../db/postgres'

const CONFIRM = process.argv.includes('--confirm')
const DIGITS_ONLY = String.raw`^[0-9[:space:]]+$`

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const { rows: [r] } = await db.query<{ n: string }>(sql, params)
  return Number(r.n)
}

async function main() {
  const searches = await count(
    `SELECT count(*)::text AS n FROM search_queries WHERE query ~ $1 AND NOT is_internal`,
    [DIGITS_ONLY],
  )
  const sessions = await count(`
    SELECT count(*)::text AS n FROM user_sessions s
     WHERE NOT s.is_internal
       AND EXISTS (SELECT 1 FROM search_queries q
                    WHERE q.session_id = s.session_id AND q.query ~ $1)
  `, [DIGITS_ONLY])

  console.log(`\n  digits-only searches not yet flagged   ${searches}`)
  console.log(`  sessions they belong to                ${sessions}`)

  if (searches === 0 && sessions === 0) { console.log('\n  Nothing to flag.\n'); return }
  if (!CONFIRM) { console.log('\n  DRY RUN. Re-run with --confirm.\n'); return }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE search_queries SET is_internal = true WHERE query ~ $1 AND NOT is_internal`,
      [DIGITS_ONLY],
    )
    // A session that ran one test search is a test session throughout, so the
    // flag has to reach the rest of its rows or the funnel stays skewed.
    await client.query(`
      UPDATE user_sessions s SET is_internal = true
       WHERE NOT s.is_internal
         AND EXISTS (SELECT 1 FROM search_queries q
                      WHERE q.session_id = s.session_id AND q.query ~ $1)
    `, [DIGITS_ONLY])
    const events = await client.query(`
      UPDATE analytics_events ae SET is_internal = true
        FROM user_sessions s
       WHERE s.session_id = ae.session_id AND s.is_internal AND NOT ae.is_internal
    `)
    const rest = await client.query(`
      UPDATE search_queries q SET is_internal = true
        FROM user_sessions s
       WHERE s.session_id = q.session_id AND s.is_internal AND NOT q.is_internal
    `)

    await client.query('COMMIT')
    console.log(`\n  flagged: ${searches} searches, ${sessions} sessions,`)
    console.log(`           ${events.rowCount ?? 0} events, ${rest.rowCount ?? 0} sibling searches\n`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
