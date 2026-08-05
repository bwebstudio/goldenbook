// Catalogue rotation.
//
// Ranking is self-reinforcing: the places that surfaced yesterday collect the
// views, saves and popularity that make them surface again tomorrow. Left
// alone it converges, and the 5 Aug audit measured exactly that. 106 of 346
// published places had never been opened by a single user.
//
// The fix is a bounded, additive boost for places that have gone unseen. It is
// deliberately NOT part of the weighted signal set: those weights are
// normalised to 1.0 and A/B tested, and rotation is not a relevance signal
// competing with the others. It is a correction applied on top, in the same
// way `dinnerSafetyPenalty` is, so it composes without disturbing what the
// experiments measure.
//
// It also only ever moves places WITHIN the eligible pool. Everything that
// filters candidates (open right now, matching the moment, not a service
// business) has already run by the time this applies, so rotation surfaces
// neglected places, never inappropriate ones.

import { db } from '../../db/postgres'

/** Ceiling on the boost, in the same units as the total score (roughly 0-100). */
const MAX_BOOST = 12

/**
 * How much to lift a place that has gone unseen.
 *
 * The curve is flat rather than continuous on purpose: a place unseen for 95
 * days is not meaningfully more deserving than one unseen for 92, and steps
 * make the behaviour predictable when someone is looking at a score breakdown
 * and asking why a given place appeared.
 *
 * @param lastViewedAt when a real user last opened it, or null for never
 */
export function rotationBoost(lastViewedAt: Date | string | null | undefined): number {
  if (lastViewedAt == null) return MAX_BOOST          // never seen by anyone

  const days = daysSince(lastViewedAt)
  if (days == null) return MAX_BOOST                  // unparseable, treat as never

  if (days > 90) return 9
  if (days > 30) return 6
  if (days > 14) return 3
  return 0                                            // seen recently, no help needed
}

/** Whole days between a timestamp and now. Null when the input is unusable. */
export function daysSince(value: Date | string): number | null {
  const then = value instanceof Date ? value : new Date(value)
  const ms = then.getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor((Date.now() - ms) / 86_400_000)
}

/**
 * Recompute the exposure rollup for every place.
 *
 * Runs on an interval from app.ts rather than on the request path: scoring
 * must not scan analytics_events, which is the largest table we have. Internal
 * traffic is excluded, so a QA session poking at a place does not make it look
 * loved and push it back down the rotation queue.
 */
export async function refreshPlaceExposure(): Promise<number> {
  const { rowCount } = await db.query(`
    INSERT INTO place_exposure (place_id, last_viewed_at, views_30d, refreshed_at)
    SELECT p.id,
           (SELECT MAX(ae.created_at)
              FROM analytics_events ae
             WHERE ae.place_id = p.id
               AND ae.event_name IN ('place_view', 'place_open')
               AND NOT ae.is_internal),
           (SELECT COUNT(*)
              FROM analytics_events ae
             WHERE ae.place_id = p.id
               AND ae.event_name IN ('place_view', 'place_open')
               AND NOT ae.is_internal
               AND ae.created_at >= now() - interval '30 days'),
           now()
      FROM places p
    ON CONFLICT (place_id) DO UPDATE SET
      last_viewed_at = EXCLUDED.last_viewed_at,
      views_30d      = EXCLUDED.views_30d,
      refreshed_at   = now()
  `)
  return rowCount ?? 0
}

/**
 * Exposure for a set of places, for surfaces that rank in memory rather than
 * through the NOW scoring engine (Discover's feeds).
 */
export async function getExposureMap(
  placeIds: string[],
): Promise<Map<string, Date | null>> {
  const map = new Map<string, Date | null>()
  if (placeIds.length === 0) return map

  const { rows } = await db.query<{ place_id: string; last_viewed_at: Date | null }>(
    `SELECT place_id, last_viewed_at FROM place_exposure WHERE place_id = ANY($1::uuid[])`,
    [placeIds],
  )
  for (const r of rows) map.set(r.place_id, r.last_viewed_at)

  // A place with no row at all has never been through a refresh, which for
  // rotation purposes is the same as never having been seen.
  for (const id of placeIds) if (!map.has(id)) map.set(id, null)

  return map
}
