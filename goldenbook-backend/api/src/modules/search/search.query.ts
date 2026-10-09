import { db } from '../../db/postgres'

// ─── Places ───────────────────────────────────────────────────────────────────

export interface SearchPlaceRow {
  id: string
  slug: string
  name: string
  summary: string | null
  hero_bucket: string | null
  hero_path: string | null
  city_slug: string
  city_name: string
}

type PlaceScope = 'city' | 'elsewhere'

// Shared place matcher. `scope = 'city'` searches the given city only;
// `scope = 'elsewhere'` searches every other active city, so a user in Lisboa
// can still find a place that lives in Madeira.
async function searchPlaces(
  scope: PlaceScope,
  citySlug: string,
  locale: string,
  query: string,
  limit: number,
): Promise<SearchPlaceRow[]> {
  const destinationJoin = scope === 'city'
    ? 'JOIN destinations d ON d.id = p.destination_id AND d.slug = $1'
    : 'JOIN destinations d ON d.id = p.destination_id AND d.slug <> $1 AND d.is_active = true'

  const { rows } = await db.query<SearchPlaceRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name)                                        AS name,
      COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) AS summary,
      hero_img.bucket                                                                               AS hero_bucket,
      hero_img.path                                                                                 AS hero_path,
      d.slug                                                                                        AS city_slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name)         AS city_name
    FROM places p
    ${destinationJoin}
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'pt'
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_lang
           ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path
      FROM   place_images pi
      JOIN   media_assets ma ON ma.id = pi.asset_id
      WHERE  pi.place_id = p.id
        AND  pi.image_role IN ('hero', 'cover')
      ORDER  BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
      LIMIT  1
    ) hero_img ON true
    WHERE p.status = 'published'
      AND (
        COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name) ILIKE '%' || $3 || '%'
        OR COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) ILIKE '%' || $3 || '%'
      )
    ORDER BY p.featured DESC, p.published_at DESC NULLS LAST
    LIMIT $4
    `,
    [citySlug, locale, query, limit],
  )
  return rows
}

export function findPlaces(
  citySlug: string,
  locale: string,
  query: string,
  limit = 10,
): Promise<SearchPlaceRow[]> {
  return searchPlaces('city', citySlug, locale, query, limit)
}

// Published places matching `query` in every city except `citySlug`.
export function findPlacesElsewhere(
  citySlug: string,
  locale: string,
  query: string,
  limit = 5,
): Promise<SearchPlaceRow[]> {
  return searchPlaces('elsewhere', citySlug, locale, query, limit)
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export interface SearchRouteRow {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_bucket: string | null
  hero_path: string | null
}

// Routes live in `curated_routes` (the legacy `routes` table is empty). They
// have no slug: the app addresses them by id, so `slug` is the id, matching
// routes.route.ts. "Active" uses the same window as discover.
export async function findRoutes(
  citySlug: string,
  locale: string,
  query: string,
  limit = 5,
): Promise<SearchRouteRow[]> {
  const { rows } = await db.query<SearchRouteRow>(
    `
    SELECT
      cr.id,
      cr.id::text                                                          AS slug,
      COALESCE(NULLIF(cr.title_translations->>$2, ''), NULLIF(cr.title_translations->>'en', ''), cr.title)       AS title,
      COALESCE(NULLIF(cr.summary_translations->>$2, ''), NULLIF(cr.summary_translations->>'en', ''), cr.summary) AS summary,
      hero.bucket                                                          AS hero_bucket,
      hero.path                                                            AS hero_path
    FROM curated_routes cr
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path
      FROM   curated_route_stops crs
      JOIN   place_images pi ON pi.place_id = crs.place_id AND pi.image_role IN ('hero', 'cover')
      JOIN   media_assets ma ON ma.id = pi.asset_id
      WHERE  crs.route_id = cr.id
      ORDER  BY crs.stop_order ASC, (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
      LIMIT  1
    ) hero ON true
    WHERE cr.city_slug = $1
      AND cr.is_active = true
      AND cr.starts_at <= now()
      AND cr.expires_at > now()
      AND (
        cr.title ILIKE '%' || $3 || '%'
        OR cr.summary ILIKE '%' || $3 || '%'
        OR cr.title_translations->>$2 ILIKE '%' || $3 || '%'
        OR cr.summary_translations->>$2 ILIKE '%' || $3 || '%'
      )
    ORDER BY cr.route_type = 'sponsored' DESC, cr.created_at DESC
    LIMIT $4
    `,
    [citySlug, locale.split('-')[0], query, limit],
  )
  return rows
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface SearchCategoryRow {
  id: string
  slug: string
  name: string
  icon_name: string | null
}

export async function findCategories(
  citySlug: string,
  locale: string,
  query: string,
  limit = 5,
): Promise<SearchCategoryRow[]> {
  const { rows } = await db.query<SearchCategoryRow>(
    `
    SELECT DISTINCT ON (c.sort_order, c.id)
      c.id,
      c.slug,
      COALESCE(NULLIF(ct.name,''), NULLIF(ct_lang.name,''), NULLIF(ct_fb.name,''), c.slug) AS name,
      c.icon_name
    FROM categories c
    JOIN place_categories pc ON pc.category_id = c.id
    JOIN places p            ON p.id = pc.place_id AND p.status = 'published'
    JOIN destinations d      ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN category_translations ct
           ON ct.category_id = c.id AND ct.locale = $2
    LEFT JOIN category_translations ct_lang
           ON ct_lang.category_id = c.id AND ct_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN category_translations ct_fb
           ON ct_fb.category_id = c.id AND ct_fb.locale = 'en'
    WHERE c.is_active = true
      AND COALESCE(NULLIF(ct.name,''), NULLIF(ct_lang.name,''), NULLIF(ct_fb.name,''), c.slug) ILIKE '%' || $3 || '%'
    ORDER BY c.sort_order ASC, c.id ASC
    LIMIT $4
    `,
    [citySlug, locale, query, limit],
  )
  return rows
}
