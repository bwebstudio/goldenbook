import { db } from '../../db/postgres'
import { getActiveVisibilityPlaceIds } from '../visibility/visibility.query'

// ─── Shared hero image lateral ────────────────────────────────────────────────
// Reused across multiple queries as an inline comment — see LATERAL blocks below.

// ─── City header ──────────────────────────────────────────────────────────────

export interface CityHeaderRow {
  slug: string
  name: string
  country: string
  hero_bucket: string | null
  hero_path: string | null
}

export async function getCityHeader(
  citySlug: string,
  locale: string,
): Promise<CityHeaderRow | null> {
  const { rows } = await db.query<CityHeaderRow>(
    `
    SELECT
      d.slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name)  AS name,
      COALESCE(co.name, d.slug)                             AS country,
      ma.bucket                                             AS hero_bucket,
      ma.path                                               AS hero_path
    FROM destinations d
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    LEFT JOIN countries co ON co.id = d.country_id
    LEFT JOIN media_assets ma ON ma.id = d.hero_image_asset_id
    WHERE d.slug = $1
      AND d.is_active = true
    LIMIT 1
    `,
    [citySlug, locale],
  )
  return rows[0] ?? null
}

// ─── Editorial hero ───────────────────────────────────────────────────────────
// Uses collection_type = 'hero_candidates'.
// No subtitle/cta_label in schema — those fields are returned as null.
// Hero image comes from the first place in the collection.

export interface EditorialHeroRow {
  title: string
  image_bucket: string | null
  image_path: string | null
  target_slug: string
}

export async function getEditorialHero(
  citySlug: string,
  locale: string,
): Promise<EditorialHeroRow | null> {
  const { rows } = await db.query<EditorialHeroRow>(
    `
    SELECT
      ec.title,
      hero_img.bucket AS image_bucket,
      hero_img.path   AS image_path,
      p.slug          AS target_slug
    FROM editorial_collections ec
    JOIN destinations d
           ON d.id = ec.destination_id AND d.slug = $1
    JOIN editorial_collection_items eci
           ON eci.collection_id = ec.id
    JOIN places p
           ON p.id = eci.place_id AND p.status = 'published'
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path
      FROM   place_images pi
      JOIN   media_assets ma ON ma.id = pi.asset_id
      WHERE  pi.place_id = p.id
        AND  pi.image_role IN ('hero', 'cover')
      ORDER  BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
      LIMIT  1
    ) hero_img ON true
    WHERE ec.collection_type = 'hero_candidates'
      AND ec.is_active = true
    ORDER BY eci.sort_order ASC
    LIMIT 1
    `,
    [citySlug],
  )
  if (rows[0]) return rows[0]

  // Fallback: featured place with a hero image — locale-aware name
  const { rows: fb } = await db.query<EditorialHeroRow>(
    `
    SELECT
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name) AS title,
      hero_img.bucket AS image_bucket,
      hero_img.path   AS image_path,
      p.slug          AS target_slug
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
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
      AND hero_img.bucket IS NOT NULL
    ORDER BY p.featured DESC, p.created_at ASC
    LIMIT 1
    `,
    [citySlug, locale],
  )
  return fb[0] ?? null
}

// ─── Place card (shared shape) ────────────────────────────────────────────────

export interface PlaceCardRow {
  id: string
  slug: string
  name: string
  hero_bucket: string | null
  hero_path: string | null
  short_description: string | null
  place_type: string | null
  city_name: string | null
  /** Localized name of the place's primary category (e.g. "Gastronomía") */
  category_name: string | null
  /** Localized name of the place's primary subcategory (e.g. "Cocina internacional") */
  subcategory_name: string | null
  is_sponsored?: boolean
}

// Reusable LATERAL fragment that resolves the localized primary category +
// subcategory for a place. Assumes parent query has `p` (places) in scope and
// uses `$2` as the locale parameter — keep these conventions when adding new
// queries that return PlaceCardRow.
const PRIMARY_CATEGORY_LATERAL = /* sql */ `
LEFT JOIN LATERAL (
  SELECT
    COALESCE(NULLIF(ct.name,''), NULLIF(ct_lang.name,''), NULLIF(ct_fb.name,''), c.slug)         AS category_name,
    COALESCE(NULLIF(sct.name,''), NULLIF(sct_lang.name,''), NULLIF(sct_fb.name,''), s.slug)      AS subcategory_name
  FROM   place_categories pc
  JOIN   categories c                  ON c.id = pc.category_id
  LEFT   JOIN subcategories s          ON s.id = pc.subcategory_id
  LEFT   JOIN category_translations ct      ON ct.category_id      = c.id AND ct.locale      = $2
  LEFT   JOIN category_translations ct_lang ON ct_lang.category_id = c.id AND ct_lang.locale = split_part($2,'-',1) AND $2 LIKE '%-%'
  LEFT   JOIN category_translations ct_fb   ON ct_fb.category_id   = c.id AND ct_fb.locale   = 'en'
  LEFT   JOIN subcategory_translations sct      ON sct.subcategory_id      = s.id AND sct.locale      = $2
  LEFT   JOIN subcategory_translations sct_lang ON sct_lang.subcategory_id = s.id AND sct_lang.locale = split_part($2,'-',1) AND $2 LIKE '%-%'
  LEFT   JOIN subcategory_translations sct_fb   ON sct_fb.subcategory_id   = s.id AND sct_fb.locale   = 'en'
  WHERE  pc.place_id = p.id
  ORDER  BY pc.is_primary DESC, pc.sort_order ASC
  LIMIT  1
) prim_cat ON true
`

// ─── Editorial collection places (editors_picks, hidden_spots, etc.) ──────────

async function getCollectionPlaces(
  citySlug: string,
  locale: string,
  collectionType: string,
  limit: number,
): Promise<PlaceCardRow[]> {
  const { rows } = await db.query<PlaceCardRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name)                                        AS name,
      hero_img.bucket                                                                              AS hero_bucket,
      hero_img.path                                                                                AS hero_path,
      COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) AS short_description,
      p.place_type,
      d.name                AS city_name,
      prim_cat.category_name,
      prim_cat.subcategory_name
    FROM editorial_collections ec
    JOIN destinations d
           ON d.id = ec.destination_id AND d.slug = $1
    JOIN editorial_collection_items eci
           ON eci.collection_id = ec.id
    JOIN places p
           ON p.id = eci.place_id AND p.status = 'published'
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
    ${PRIMARY_CATEGORY_LATERAL}
    WHERE ec.collection_type = $3
      AND ec.is_active = true
    ORDER BY eci.sort_order ASC
    LIMIT $4
    `,
    [citySlug, locale, collectionType, limit],
  )
  return rows
}

// Shared fallback: published places with a hero/cover image, offset to vary results
async function getPlacesFallback(
  citySlug: string,
  locale: string,
  limit: number,
  offset: number,
): Promise<PlaceCardRow[]> {
  const { rows } = await db.query<PlaceCardRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name)                                        AS name,
      hero_img.bucket                                                                              AS hero_bucket,
      hero_img.path                                                                                AS hero_path,
      COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) AS short_description,
      p.place_type,
      d.name                AS city_name,
      prim_cat.category_name,
      prim_cat.subcategory_name
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
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
    ${PRIMARY_CATEGORY_LATERAL}
    WHERE p.status = 'published'
      AND hero_img.bucket IS NOT NULL
    ORDER BY p.featured DESC, p.created_at ASC
    LIMIT $3
    OFFSET $4
    `,
    [citySlug, locale, limit, offset],
  )
  return rows
}

// ─── Visibility-driven places ────────────────────────────────────────────────
// Fetches places assigned via place_visibility table for a given surface.

async function getVisibilityPlaces(
  citySlug: string,
  locale: string,
  surface: string,
  limit: number,
): Promise<PlaceCardRow[]> {
  try {
    const placeIds = await getActiveVisibilityPlaceIds(surface, limit)
    if (placeIds.length === 0) return []

    const { rows } = await db.query<PlaceCardRow>(`
      SELECT
        p.id, p.slug,
        COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name) AS name,
        hero_img.bucket AS hero_bucket, hero_img.path AS hero_path,
        COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) AS short_description,
        p.place_type,
        d.name                AS city_name,
        prim_cat.category_name,
        prim_cat.subcategory_name
      FROM places p
      JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
      LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = $2
      LEFT JOIN place_translations pt_lang ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
      LEFT JOIN place_translations pt_fb ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
      LEFT JOIN LATERAL (
        SELECT ma.bucket, ma.path FROM place_images pi JOIN media_assets ma ON ma.id = pi.asset_id
        WHERE pi.place_id = p.id AND pi.image_role IN ('hero','cover')
        ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC LIMIT 1
      ) hero_img ON true
      ${PRIMARY_CATEGORY_LATERAL}
      WHERE p.id = ANY($3) AND p.status = 'published'
    `, [citySlug, locale, placeIds])

    // Preserve priority order from placeIds
    const byId = new Map(rows.map(r => [r.id, r]))
    return placeIds.map(id => byId.get(id)).filter((r): r is PlaceCardRow => !!r)
  } catch {
    return [] // table may not exist yet
  }
}

function deduplicatePlaces(places: PlaceCardRow[]): PlaceCardRow[] {
  const seen = new Set<string>()
  return places.filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}

export async function getEditorsPicks(citySlug: string, locale: string, limit = 8): Promise<PlaceCardRow[]> {
  // 1. Manual visibility assignments
  const promoted = await getVisibilityPlaces(citySlug, locale, 'golden_picks', limit)
  if (promoted.length >= limit) return promoted
  // 2. Curated editorial collections
  const curated = await getCollectionPlaces(citySlug, locale, 'editors_picks', limit - promoted.length)
  const combined = deduplicatePlaces([...promoted, ...curated])
  if (combined.length >= limit) return combined.slice(0, limit)
  // 3. Fallback
  const fallback = await getPlacesFallback(citySlug, locale, limit - combined.length, 0)
  return deduplicatePlaces([...combined, ...fallback]).slice(0, limit)
}

export async function getHiddenSpots(citySlug: string, locale: string, limit = 6): Promise<PlaceCardRow[]> {
  const promoted = await getVisibilityPlaces(citySlug, locale, 'hidden_spots', limit)
  if (promoted.length >= limit) return promoted
  const curated = await getCollectionPlaces(citySlug, locale, 'hidden_spots', limit - promoted.length)
  const combined = deduplicatePlaces([...promoted, ...curated])
  if (combined.length >= limit) return combined.slice(0, limit)
  const fallback = await getPlacesFallback(citySlug, locale, limit - combined.length, 8)
  return deduplicatePlaces([...combined, ...fallback]).slice(0, limit)
}

// ─── New on Goldenbook ────────────────────────────────────────────────────────
// No flag on places — use collection_type='new_on_goldenbook' if curated,
// fallback to recently published places for the city.

export async function getNewPlaces(
  citySlug: string,
  locale: string,
  limit = 8,
): Promise<PlaceCardRow[]> {
  // 1. Visibility-promoted new place (sponsored/superadmin)
  const promoted = await getVisibilityPlaces(citySlug, locale, 'new_on_goldenbook', 1)

  // 2. Curated collection
  const curated = await getCollectionPlaces(citySlug, locale, 'new_on_goldenbook', limit)
  const combined = deduplicatePlaces([...promoted, ...curated])
  if (combined.length >= limit) return combined.slice(0, limit)

  // 3. Fallback: most recently published places
  const { rows } = await db.query<PlaceCardRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name)                                        AS name,
      hero_img.bucket                                                                              AS hero_bucket,
      hero_img.path                                                                                AS hero_path,
      COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) AS short_description,
      p.place_type,
      d.name                AS city_name,
      prim_cat.category_name,
      prim_cat.subcategory_name
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
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
    ${PRIMARY_CATEGORY_LATERAL}
    WHERE p.status = 'published'
    ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
    LIMIT $3
    `,
    [citySlug, locale, limit - combined.length],
  )
  return deduplicatePlaces([...combined, ...rows]).slice(0, limit)
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface DiscoverCategoryRow {
  id: string
  slug: string
  name: string
  icon_name: string | null
}

export async function getDiscoverCategories(
  citySlug: string,
  locale: string,
): Promise<DiscoverCategoryRow[]> {
  const { rows } = await db.query<DiscoverCategoryRow>(
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
    ORDER BY c.sort_order ASC, c.id ASC
    `,
    [citySlug, locale],
  )
  return rows
}

// ─── Now Recommendation candidates ───────────────────────────────────────────
// Returns published places with a hero image plus their category slugs.
// The caller scores/ranks these by time segment.

export interface NowCandidateRow {
  id: string
  slug: string
  name: string
  image_bucket: string | null
  image_path: string | null
  featured: boolean
  category_slugs: string[]
}

export async function getNowCandidates(
  citySlug: string,
  locale: string,
  limit = 24,
): Promise<NowCandidateRow[]> {
  const { rows } = await db.query<NowCandidateRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name)                                AS name,
      hero_img.bucket                                                                      AS image_bucket,
      hero_img.path                                                                        AS image_path,
      p.featured,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.slug), NULL)                                     AS category_slugs
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
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
    LEFT JOIN place_categories pc ON pc.place_id = p.id
    LEFT JOIN categories c        ON c.id = pc.category_id AND c.is_active = true
    WHERE p.status = 'published'
      AND hero_img.bucket IS NOT NULL
    GROUP BY
      p.id, p.slug, p.name, p.featured, hero_img.bucket, hero_img.path,
      pt.name, pt_lang.name, pt_fb.name
    ORDER BY p.featured DESC, p.created_at ASC
    LIMIT $3
    `,
    [citySlug, locale, limit],
  )
  return rows
}

// ─── Golden Routes ────────────────────────────────────────────────────────────

export interface RouteCardRow {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_bucket: string | null
  hero_path: string | null
  places_count: number
}

export async function getGoldenRoutes(
  citySlug: string,
  locale: string,
  limit = 4,
): Promise<RouteCardRow[]> {
  const lang = locale.split('-')[0]

  // 1. Curated routes (active, auto-generated/sponsored) — take priority
  const { rows: curatedRows } = await db.query<RouteCardRow>(
    `
    SELECT
      cr.id,
      cr.id::text AS slug,
      COALESCE(cr.title_translations ->> $2, cr.title) AS title,
      COALESCE(cr.summary_translations ->> $2, cr.summary) AS summary,
      (SELECT ma.bucket FROM curated_route_stops crs
       JOIN place_images pi ON pi.place_id = crs.place_id AND pi.image_role IN ('hero','cover')
       JOIN media_assets ma ON ma.id = pi.asset_id
       WHERE crs.route_id = cr.id ORDER BY crs.stop_order LIMIT 1) AS hero_bucket,
      (SELECT ma.path FROM curated_route_stops crs
       JOIN place_images pi ON pi.place_id = crs.place_id AND pi.image_role IN ('hero','cover')
       JOIN media_assets ma ON ma.id = pi.asset_id
       WHERE crs.route_id = cr.id ORDER BY crs.stop_order LIMIT 1) AS hero_path,
      (SELECT COUNT(*)::int FROM curated_route_stops crs WHERE crs.route_id = cr.id) AS places_count
    FROM curated_routes cr
    WHERE cr.city_slug = $1
      AND cr.is_active = true
      AND cr.starts_at <= now()
      AND cr.expires_at > now()
    ORDER BY cr.route_type = 'sponsored' DESC, cr.created_at DESC
    LIMIT $3
    `,
    [citySlug, lang, limit],
  )

  return curatedRows
}
