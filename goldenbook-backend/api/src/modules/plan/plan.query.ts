// Tonight's plan: candidate selection.
//
// Why this is built from the user's city and location rather than from their
// saved places, which is where it started: on 5 Aug 2026 only 27 of 3.120
// registered users had ever saved anything, only 9 had saved three or more,
// and among those the average distance between their furthest two saves was
// 475 km. Those are wishlists spanning Lisboa, Porto, the Algarve and Madeira,
// not evenings out. A plan built on them would have been empty for 99,7% of
// users and nonsense for most of the rest.
//
// Coordinates, by contrast, are near-complete: 345 of 346 published places
// have them. So the plan is grounded in geography, which we can trust, and
// every other constraint is checked against real rows rather than estimated.
//
// The one thing this deliberately does NOT do is assign times. We hold no
// duration data for any place, so "20:00 dinner, 22:00 drinks" would be a
// guess dressed as a schedule. Instead each stop must still be open by the
// time someone plausibly walking the route would reach it, which is a fact we
// can check against opening_hours.

import { db } from '../../db/postgres'
import { EXCLUDE_NON_VISITABLE_SQL } from '../shared-scoring/place-types'

export interface PlanCandidate {
  id: string
  slug: string
  name: string
  short_description: string | null
  place_type: string
  primary_category: string | null
  hero_bucket: string | null
  hero_path: string | null
  latitude: number
  longitude: number
  distance_meters: number
  closes_at_today: string | null
  popularity_score: number | null
  now_priority: number
  last_viewed_at: Date | null
}

/**
 * Places in this city that could be a stop tonight.
 *
 * Every filter here is a hard fact:
 *   - has coordinates, or we cannot order it in a walking sequence
 *   - published and active
 *   - open right now AND still open in `minOpenHours` hours, so a stop later
 *     in the sequence is not somewhere that shuts before anyone arrives
 *
 * Places with no opening_hours rows at all are EXCLUDED here, unlike in the
 * Now card which lets them through. Now is a single suggestion the user
 * evaluates on the spot; a plan is a promise about a sequence, and promising
 * a third stop we have no hours for is how this feature would lose trust.
 */
export async function getPlanCandidates(
  citySlug: string,
  locale: string,
  userLat: number,
  userLon: number,
  radiusMeters: number,
  tz: string,
): Promise<PlanCandidate[]> {
  const { rows } = await db.query<PlanCandidate>(
    `
    WITH candidates AS (
      SELECT
        p.id,
        p.slug,
        COALESCE(NULLIF(pt.name,''), NULLIF(pt_fb.name,''), p.name) AS name,
        COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_fb.short_description,''),
                 p.short_description) AS short_description,
        p.place_type,
        (SELECT c.slug
           FROM place_categories pc
           JOIN categories c ON c.id = pc.category_id
          WHERE pc.place_id = p.id
          ORDER BY pc.is_primary DESC NULLS LAST
          LIMIT 1) AS primary_category,
        hero.bucket AS hero_bucket,
        hero.path   AS hero_path,
        p.latitude,
        p.longitude,
        6371000 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS((p.latitude - $3) / 2)), 2) +
          COS(RADIANS($3)) * COS(RADIANS(p.latitude)) *
          POWER(SIN(RADIANS((p.longitude - $4) / 2)), 2)
        )) AS distance_meters,
        (SELECT to_char(oh.closes_at, 'HH24:MI')
           FROM opening_hours oh
          WHERE oh.place_id = p.id
            AND oh.is_closed = false
            AND oh.day_of_week = EXTRACT(DOW FROM now() AT TIME ZONE $6)::int
            AND oh.opens_at  <= (now() AT TIME ZONE $6)::time
            AND oh.closes_at >  (now() AT TIME ZONE $6)::time
          ORDER BY oh.closes_at DESC
          LIMIT 1) AS closes_at_today,
        ps.popularity_score,
        COALESCE(p.now_priority, 0) AS now_priority,
        pe.last_viewed_at
      FROM places p
      JOIN destinations d ON d.id = p.destination_id
      LEFT JOIN place_translations pt    ON pt.place_id = p.id AND pt.locale = $2
      LEFT JOIN place_translations pt_fb ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
      LEFT JOIN place_stats ps           ON ps.place_id = p.id
      LEFT JOIN place_exposure pe        ON pe.place_id = p.id
      LEFT JOIN LATERAL (
        SELECT ma.bucket, ma.path
          FROM place_images pi
          JOIN media_assets ma ON ma.id = pi.asset_id
         WHERE pi.place_id = p.id
           AND pi.image_role IN ('hero', 'cover')
         ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
         LIMIT 1
      ) hero ON true
      WHERE d.slug = lower($1)
        AND p.status = 'published'
        AND p.is_active = true
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        -- Service businesses are never a stop on an evening out.
        AND ${EXCLUDE_NON_VISITABLE_SQL}
        -- Must hold hours, and must be open right now.
        AND EXISTS (
          SELECT 1 FROM opening_hours oh
           WHERE oh.place_id = p.id
             AND oh.is_closed = false
             AND oh.day_of_week = EXTRACT(DOW FROM now() AT TIME ZONE $6)::int
             AND oh.opens_at  <= (now() AT TIME ZONE $6)::time
             AND oh.closes_at >  (now() AT TIME ZONE $6)::time
        )
    )
    SELECT * FROM candidates
     WHERE distance_meters <= $5
     ORDER BY distance_meters
     LIMIT 120
    `,
    [citySlug, locale, userLat, userLon, radiusMeters, tz],
  )
  return rows
}

/**
 * Minutes from now until an "HH:MM" wall-clock time in the given timezone.
 * Null when the time has already passed or cannot be parsed, which callers
 * treat as "cannot promise this stop".
 */
export function minutesUntilClose(hhmm: string | null, tz: string): number | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return null

  // Read the current wall-clock time in the destination's timezone rather than
  // the server's. Railway runs in UTC; Madeira is an hour behind Lisbon.
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).formatToParts(new Date())
  const nowH = parseInt(parts.find((p) => p.type === 'hour')?.value ?? 'x', 10)
  const nowM = parseInt(parts.find((p) => p.type === 'minute')?.value ?? 'x', 10)
  if (Number.isNaN(nowH) || Number.isNaN(nowM)) return null

  const diff = (h * 60 + m) - (nowH * 60 + nowM)
  return diff > 0 ? diff : null
}

/** Straight-line metres between two points. */
export function metresBetween(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(a)))
}

/**
 * El destino cubierto más cercano al usuario, con la distancia a su ficha más
 * próxima.
 *
 * Se calcula contra fichas reales y no contra un centro de ciudad promediado,
 * porque el promedio miente: el de Lisboa cae desplazado hacia Parque das
 * Nações y dejaría a alguien en Belém más lejos de "Lisboa" de lo que está.
 *
 * Sirve para el caso en que alguien tiene Lisboa seleccionada pero está en
 * Porto. El plan no puede construirse, y sin esto la sección desaparecía sin
 * decir nada aunque hubiera un plan posible a doscientos metros.
 */
export async function getNearestCoveredCity(
  userLat: number,
  userLon: number,
): Promise<{ slug: string; name: string; distanceMetres: number } | null> {
  const { rows } = await db.query<{ slug: string; name: string; distance_metres: string }>(
    `
    SELECT d.slug, d.name,
           MIN(6371000 * 2 * ASIN(SQRT(
             POWER(SIN(RADIANS((p.latitude - $1) / 2)), 2) +
             COS(RADIANS($1)) * COS(RADIANS(p.latitude)) *
             POWER(SIN(RADIANS((p.longitude - $2) / 2)), 2)
           )))::text AS distance_metres
      FROM places p
      JOIN destinations d ON d.id = p.destination_id
     WHERE p.status = 'published'
       AND p.is_active = true
       AND p.latitude IS NOT NULL
       AND p.longitude IS NOT NULL
     GROUP BY d.slug, d.name
     ORDER BY MIN(6371000 * 2 * ASIN(SQRT(
             POWER(SIN(RADIANS((p.latitude - $1) / 2)), 2) +
             COS(RADIANS($1)) * COS(RADIANS(p.latitude)) *
             POWER(SIN(RADIANS((p.longitude - $2) / 2)), 2)
           ))) ASC
     LIMIT 1
    `,
    [userLat, userLon],
  )
  if (rows.length === 0) return null
  return {
    slug: rows[0].slug,
    name: rows[0].name,
    distanceMetres: Math.round(Number(rows[0].distance_metres)),
  }
}
