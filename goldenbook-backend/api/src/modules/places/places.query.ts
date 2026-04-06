import { db } from '../../db/postgres'

// ─── Main place row ��───────────��───────────��──────────────────────────────────

export interface PlaceRow {
  id: string
  slug: string
  place_type: string
  name: string
  city_slug: string
  city_name: string
  hero_bucket: string | null
  hero_path: string | null
  popularity_score: number | null
  goldenbook_note: string | null
  why_we_love_it: string | null
  insider_tip: string | null
  short_description: string | null
  full_description: string | null
  phone: string | null
  email: string | null
  website_url: string | null
  booking_url: string | null
  address_line: string | null
  latitude: number | null
  longitude: number | null
  brand_id: string | null
  brand_name: string | null
  brand_slug: string | null
  // Booking fields (from migration 20260328000000 — may not exist yet)
  booking_enabled: boolean
  booking_mode: string
  booking_label: string | null
  reservation_relevant: boolean
  reservation_confidence: number | null
  reservation_source: string | null
  reservation_last_reviewed_at: string | null
  // Suggestion fields (from migration 20260328100000 — may not exist yet)
  suggestion_relevant: boolean | null
  suggestion_mode: string | null
  suggestion_label: string | null
  suggestion_url: string | null
  suggestion_confidence: number | null
  suggestion_reason: string | null
  suggestion_source: string | null
  suggestion_generated_at: string | null
  suggestion_dismissed: boolean
  // Auto-generated context engine fields
  classification_auto: unknown | null
  context_windows_auto: unknown | null
  context_tags_auto: unknown | null
  moment_tags_auto: unknown | null
}

// ─── Shared query fragments ──────────────────────────────────────────────────

const CORE_SELECT = `
  p.id,
  p.slug,
  p.place_type,
  COALESCE(NULLIF(pt.name,''),      NULLIF(pt_lang.name,''),      NULLIF(pt_fb.name,''),      p.name)                              AS name,
  d.slug                                                                                            AS city_slug,
  COALESCE(NULLIF(dt.name,''),      NULLIF(dt_lang.name,''),      NULLIF(dt_fb.name,''),      d.name)                              AS city_name,
  hero_img.bucket                                                                                   AS hero_bucket,
  hero_img.path                                                                                     AS hero_path,
  ps.popularity_score,
  COALESCE(NULLIF(pt.goldenbook_note,''), NULLIF(pt_lang.goldenbook_note,''), NULLIF(pt_fb.goldenbook_note,''))                     AS goldenbook_note,
  COALESCE(NULLIF(pt.why_we_love_it,''),  NULLIF(pt_lang.why_we_love_it,''),  NULLIF(pt_fb.why_we_love_it,''))                     AS why_we_love_it,
  COALESCE(NULLIF(pt.insider_tip,''),     NULLIF(pt_lang.insider_tip,''),     NULLIF(pt_fb.insider_tip,''))                         AS insider_tip,
  COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) AS short_description,
  COALESCE(NULLIF(pt.full_description,''),  NULLIF(pt_lang.full_description,''),  NULLIF(pt_fb.full_description,''),  p.full_description)  AS full_description,
  p.phone,
  p.email,
  p.website_url,
  p.booking_url,
  p.address_line,
  p.latitude,
  p.longitude,
  p.brand_id,
  br.name  AS brand_name,
  br.slug  AS brand_slug`

const BOOKING_SELECT = `,
  p.booking_enabled,
  p.booking_mode::text          AS booking_mode,
  p.booking_label,
  p.reservation_relevant,
  p.reservation_confidence,
  p.reservation_source::text    AS reservation_source,
  p.reservation_last_reviewed_at,
  p.suggestion_relevant,
  p.suggestion_mode,
  p.suggestion_label,
  p.suggestion_url,
  p.suggestion_confidence,
  p.suggestion_reason,
  p.suggestion_source,
  p.suggestion_generated_at,
  p.suggestion_dismissed,
  p.classification_auto,
  p.context_windows_auto,
  p.context_tags_auto,
  p.moment_tags_auto`

const FROM_CLAUSE = `
FROM places p
LEFT JOIN brands br ON br.id = p.brand_id
JOIN destinations d
       ON d.id = p.destination_id
LEFT JOIN destination_translations dt
       ON dt.destination_id = d.id AND dt.locale = $2
LEFT JOIN destination_translations dt_lang
       ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
LEFT JOIN destination_translations dt_fb
       ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
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
LEFT JOIN place_stats ps ON ps.place_id = p.id
WHERE p.slug = $1
  AND p.status = 'published'
LIMIT 1`

// ─── Safe defaults for when booking/suggestion columns don't exist ───────────

function withBookingDefaults(row: Record<string, unknown>): PlaceRow {
  const r = row as any
  r.booking_enabled             = r.booking_enabled ?? false
  r.booking_mode                = r.booking_mode ?? 'none'
  r.booking_label               = r.booking_label ?? null
  r.reservation_relevant        = r.reservation_relevant ?? false
  r.reservation_confidence      = r.reservation_confidence ?? null
  r.reservation_source          = r.reservation_source ?? null
  r.reservation_last_reviewed_at = r.reservation_last_reviewed_at ?? null
  r.suggestion_relevant         = r.suggestion_relevant ?? null
  r.suggestion_mode             = r.suggestion_mode ?? null
  r.suggestion_label            = r.suggestion_label ?? null
  r.suggestion_url              = r.suggestion_url ?? null
  r.suggestion_confidence       = r.suggestion_confidence ?? null
  r.suggestion_reason           = r.suggestion_reason ?? null
  r.suggestion_source           = r.suggestion_source ?? null
  r.suggestion_generated_at     = r.suggestion_generated_at ?? null
  r.suggestion_dismissed        = r.suggestion_dismissed ?? false
  r.classification_auto         = r.classification_auto ?? null
  r.context_windows_auto        = r.context_windows_auto ?? null
  r.context_tags_auto           = r.context_tags_auto ?? null
  r.moment_tags_auto            = r.moment_tags_auto ?? null
  return r as PlaceRow
}

// ─── getPlaceBySlug ──────────────────────────────────────────────────────────
// Tries the full query first. If booking/suggestion columns don't exist yet
// (migrations not applied), falls back to the core query without those columns.

export async function getPlaceBySlug(slug: string, locale: string): Promise<PlaceRow | null> {
  try {
    // Full query — includes booking + suggestion columns
    const { rows } = await db.query<PlaceRow>(
      `SELECT ${CORE_SELECT}${BOOKING_SELECT} ${FROM_CLAUSE}`,
      [slug, locale],
    )
    return rows[0] ?? null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('does not exist')) {
      // Booking/suggestion migrations not applied yet — fall back to core columns
      const { rows } = await db.query<Record<string, unknown>>(
        `SELECT ${CORE_SELECT} ${FROM_CLAUSE}`,
        [slug, locale],
      )
      return rows[0] ? withBookingDefaults(rows[0]) : null
    }
    throw err
  }
}

// ─── Categories + subcategories ───────────────────────────────────────────────

export interface CategoryRow {
  id: string
  slug: string
  name: string
  type: 'category' | 'subcategory'
}

export async function getPlaceCategories(placeId: string, locale: string): Promise<CategoryRow[]> {
  const { rows } = await db.query<CategoryRow>(
    `
    SELECT
      c.id,
      c.slug,
      COALESCE(NULLIF(ct.name,''), NULLIF(ct_lang.name,''), NULLIF(ct_fb.name,''), c.slug) AS name,
      'category'                                           AS type
    FROM place_categories pc
    JOIN categories c ON c.id = pc.category_id
    LEFT JOIN category_translations ct
           ON ct.category_id = c.id AND ct.locale = $2
    LEFT JOIN category_translations ct_lang
           ON ct_lang.category_id = c.id AND ct_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN category_translations ct_fb
           ON ct_fb.category_id = c.id AND ct_fb.locale = 'en'
    WHERE pc.place_id = $1

    UNION ALL

    SELECT
      s.id,
      s.slug,
      COALESCE(NULLIF(st.name,''), NULLIF(st_lang.name,''), NULLIF(st_fb.name,''), s.slug) AS name,
      'subcategory'                                        AS type
    FROM place_categories pc
    JOIN subcategories s ON s.id = pc.subcategory_id
    LEFT JOIN subcategory_translations st
           ON st.subcategory_id = s.id AND st.locale = $2
    LEFT JOIN subcategory_translations st_lang
           ON st_lang.subcategory_id = s.id AND st_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN subcategory_translations st_fb
           ON st_fb.subcategory_id = s.id AND st_fb.locale = 'en'
    WHERE pc.place_id = $1
      AND pc.subcategory_id IS NOT NULL
    `,
    [placeId, locale],
  )
  return rows
}

// ─── Opening hours ────────────────────────────────────────────────────────────

export interface OpeningHourRow {
  day_of_week: number
  opens_at: string | null
  closes_at: string | null
  is_closed: boolean
}

export async function getOpeningHours(placeId: string): Promise<OpeningHourRow[]> {
  const { rows } = await db.query<OpeningHourRow>(
    `
    SELECT day_of_week, opens_at, closes_at, is_closed
    FROM   opening_hours
    WHERE  place_id = $1
    ORDER  BY day_of_week ASC, slot_order ASC
    `,
    [placeId],
  )
  return rows
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

export interface GalleryRow {
  bucket: string
  path: string
  sort_order: number | null
}

export async function getPlaceGallery(placeId: string): Promise<GalleryRow[]> {
  const { rows } = await db.query<GalleryRow>(
    `
    SELECT ma.bucket, ma.path, pi.sort_order
    FROM   place_images pi
    JOIN   media_assets ma ON ma.id = pi.asset_id
    WHERE  pi.place_id = $1
      AND  pi.image_role = 'gallery'
    ORDER  BY pi.sort_order ASC
    `,
    [placeId],
  )
  return rows
}

// ─── Other locations (same brand) ────────────────────────────────────────────

export interface OtherLocationRow {
  id: string
  slug: string
  name: string
  city_name: string
  hero_bucket: string | null
  hero_path: string | null
}

export async function getOtherLocations(
  brandId: string,
  excludePlaceId: string,
  locale: string,
  limit: number = 8,
): Promise<OtherLocationRow[]> {
  const { rows } = await db.query<OtherLocationRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''),   NULLIF(pt_lang.name,''),   NULLIF(pt_fb.name,''),   p.name)   AS name,
      COALESCE(NULLIF(dt.name,''),   NULLIF(dt_lang.name,''),   NULLIF(dt_fb.name,''),   d.name)   AS city_name,
      hero_img.bucket                                              AS hero_bucket,
      hero_img.path                                               AS hero_path
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $3
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($3, '-', 1) AND $3 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $3
    LEFT JOIN place_translations pt_lang
           ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($3, '-', 1) AND $3 LIKE '%-%'
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
    WHERE p.brand_id = $1
      AND p.id != $2
      AND p.status = 'published'
    ORDER BY d.slug ASC, p.name ASC
    LIMIT $4
    `,
    [brandId, excludePlaceId, locale, limit],
  )
  return rows
}

// ─── Nearby gems ─────────────────────────────────────────────────────────────

export interface NearbyGemRow {
  id: string
  slug: string
  name: string
  hero_bucket: string | null
  hero_path: string | null
  distance_m: number
}

export async function getNearbyGems(
  placeId: string,
  refLat: number,
  refLon: number,
  locale: string,
  radiusMeters: number = 1000,
  limit: number = 6,
): Promise<NearbyGemRow[]> {
  // Haversine in pure SQL — no PostGIS required
  // Bounding box pre-filter: 1 degree latitude ≈ 111,320 m
  const degLat = radiusMeters / 111320
  const degLon = radiusMeters / (111320 * Math.cos((refLat * Math.PI) / 180))

  const { rows } = await db.query<NearbyGemRow>(
    `
    SELECT * FROM (
      SELECT
        p.id,
        p.slug,
        COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name) AS name,
        hero_img.bucket                                      AS hero_bucket,
        hero_img.path                                        AS hero_path,
        6371000 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS((p.latitude::float  - $2::float) / 2)), 2) +
          COS(RADIANS($2::float)) * COS(RADIANS(p.latitude::float)) *
          POWER(SIN(RADIANS((p.longitude::float - $3::float) / 2)), 2)
        ))                                                   AS distance_m
      FROM places p
      LEFT JOIN place_translations pt
             ON pt.place_id = p.id AND pt.locale = $4
      LEFT JOIN place_translations pt_lang
             ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($4, '-', 1) AND $4 LIKE '%-%'
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
      WHERE p.id != $1
        AND p.status = 'published'
        AND p.latitude  IS NOT NULL
        AND p.longitude IS NOT NULL
        AND p.latitude  BETWEEN ($2::float - $7::float) AND ($2::float + $7::float)
        AND p.longitude BETWEEN ($3::float - $8::float) AND ($3::float + $8::float)
    ) candidates
    WHERE distance_m <= $5::float
    ORDER BY distance_m ASC
    LIMIT $6
    `,
    [placeId, refLat, refLon, locale, radiusMeters, limit, degLat, degLon],
  )
  return rows
}
