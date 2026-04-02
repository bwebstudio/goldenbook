import { db } from '../../db/postgres'

// ─── Row types (raw DB output) ────────────────────────────────────────────────

export interface SavedPlaceRow {
  id: string
  slug: string
  name: string
  short_description: string | null
  saved_at: Date
  image_bucket: string | null
  image_path: string | null
}

export interface SavedRouteRow {
  id: string
  slug: string
  title: string
  summary: string | null
  saved_at: Date
  image_bucket: string | null
  image_path: string | null
}

export interface RecentlyViewedRow {
  id: string
  slug: string
  name: string
  short_description: string | null
  viewed_at: Date
  image_bucket: string | null
  image_path: string | null
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSavedPlaces(userId: string, locale: string): Promise<SavedPlaceRow[]> {
  const { rows } = await db.query<SavedPlaceRow>(
    `SELECT
       p.id,
       p.slug,
       COALESCE(NULLIF(pt.name,''),  NULLIF(pt_lang.name,''),  NULLIF(pt_fb.name,''),  p.name)                             AS name,
       COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''),
                p.short_description)                                                        AS short_description,
       uf.created_at                                                                        AS saved_at,
       hero_img.bucket                                                                      AS image_bucket,
       hero_img.path                                                                        AS image_path
     FROM user_favorites uf
     JOIN places p ON p.id = uf.place_id
     LEFT JOIN place_translations pt
            ON pt.place_id = p.id AND pt.locale = $2
     LEFT JOIN place_translations pt_lang
            ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
     LEFT JOIN place_translations pt_fb
            ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
     LEFT JOIN LATERAL (
       SELECT ma.bucket, ma.path
       FROM place_images pi
       JOIN media_assets ma ON ma.id = pi.asset_id
       WHERE pi.place_id = p.id
         AND pi.image_role IN ('hero', 'cover')
       ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
       LIMIT 1
     ) hero_img ON true
     WHERE uf.user_id = $1
       AND p.status = 'published'
     ORDER BY uf.created_at DESC`,
    [userId, locale],
  )
  return rows
}

export async function getSavedRoutes(userId: string, locale: string): Promise<SavedRouteRow[]> {
  const { rows } = await db.query<SavedRouteRow>(
    `SELECT
       r.id,
       r.slug,
       COALESCE(NULLIF(rt.title,''),   NULLIF(rt_lang.title,''),   NULLIF(rt_fb.title,''),   r.title)   AS title,
       COALESCE(NULLIF(rt.summary,''), NULLIF(rt_lang.summary,''), NULLIF(rt_fb.summary,''), r.summary)  AS summary,
       usr.created_at                                                    AS saved_at,
       ma.bucket                                                         AS image_bucket,
       ma.path                                                           AS image_path
     FROM user_saved_routes usr
     JOIN routes r ON r.id = usr.route_id
     LEFT JOIN route_translations rt
            ON rt.route_id = r.id AND rt.locale = $2
     LEFT JOIN route_translations rt_lang
            ON rt_lang.route_id = r.id AND rt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
     LEFT JOIN route_translations rt_fb
            ON rt_fb.route_id = r.id AND rt_fb.locale = 'en'
     LEFT JOIN media_assets ma ON ma.id = r.cover_asset_id
     WHERE usr.user_id = $1
       AND r.status = 'published'
     ORDER BY usr.created_at DESC`,
    [userId, locale],
  )
  return rows
}

export async function getRecentlyViewed(userId: string, locale: string): Promise<RecentlyViewedRow[]> {
  const { rows } = await db.query<RecentlyViewedRow>(
    `SELECT
       p.id,
       p.slug,
       COALESCE(NULLIF(pt.name,''),  NULLIF(pt_lang.name,''),  NULLIF(pt_fb.name,''),  p.name)                             AS name,
       COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''),
                p.short_description)                                                        AS short_description,
       urvp.viewed_at,
       hero_img.bucket                                                                      AS image_bucket,
       hero_img.path                                                                        AS image_path
     FROM user_recently_viewed_places urvp
     JOIN places p ON p.id = urvp.place_id
     LEFT JOIN place_translations pt
            ON pt.place_id = p.id AND pt.locale = $2
     LEFT JOIN place_translations pt_lang
            ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
     LEFT JOIN place_translations pt_fb
            ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
     LEFT JOIN LATERAL (
       SELECT ma.bucket, ma.path
       FROM place_images pi
       JOIN media_assets ma ON ma.id = pi.asset_id
       WHERE pi.place_id = p.id
         AND pi.image_role IN ('hero', 'cover')
       ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
       LIMIT 1
     ) hero_img ON true
     WHERE urvp.user_id = $1
       AND p.status = 'published'
     ORDER BY urvp.viewed_at DESC
     LIMIT 50`,
    [userId, locale],
  )
  return rows
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function savePlace(userId: string, placeId: string): Promise<void> {
  await db.query(
    `INSERT INTO user_favorites (user_id, place_id, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, place_id) DO NOTHING`,
    [userId, placeId],
  )
}

export async function unsavePlace(userId: string, placeId: string): Promise<void> {
  await db.query(
    `DELETE FROM user_favorites WHERE user_id = $1 AND place_id = $2`,
    [userId, placeId],
  )
}

export async function saveRoute(userId: string, routeId: string): Promise<void> {
  await db.query(
    `INSERT INTO user_saved_routes (user_id, route_id, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, route_id) DO NOTHING`,
    [userId, routeId],
  )
}

export async function unsaveRoute(userId: string, routeId: string): Promise<void> {
  await db.query(
    `DELETE FROM user_saved_routes WHERE user_id = $1 AND route_id = $2`,
    [userId, routeId],
  )
}

export async function trackRecentlyViewed(userId: string, placeId: string): Promise<void> {
  await db.query(
    `INSERT INTO user_recently_viewed_places (user_id, place_id, viewed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, place_id) DO UPDATE SET viewed_at = NOW()`,
    [userId, placeId],
  )
}
