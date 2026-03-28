import { db } from '../../db/postgres'

// ─── Main place row ───────────────────────────────────────────────────────────

export interface PlaceRow {
  id: string
  slug: string
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
}

export async function getPlaceBySlug(slug: string, locale: string): Promise<PlaceRow | null> {
  const { rows } = await db.query<PlaceRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(pt.name,      pt_lang.name,      pt_fb.name,      p.name)                              AS name,
      d.slug                                                                                            AS city_slug,
      COALESCE(dt.name,      dt_lang.name,      dt_fb.name,      d.name)                              AS city_name,
      hero_img.bucket                                                                                   AS hero_bucket,
      hero_img.path                                                                                     AS hero_path,
      ps.popularity_score,
      COALESCE(pt.goldenbook_note, pt_lang.goldenbook_note, pt_fb.goldenbook_note)                    AS goldenbook_note,
      COALESCE(pt.why_we_love_it,  pt_lang.why_we_love_it,  pt_fb.why_we_love_it)                    AS why_we_love_it,
      COALESCE(pt.insider_tip,     pt_lang.insider_tip,     pt_fb.insider_tip)                        AS insider_tip,
      COALESCE(pt.short_description, pt_lang.short_description, pt_fb.short_description, p.short_description) AS short_description,
      COALESCE(pt.full_description,  pt_lang.full_description,  pt_fb.full_description,  p.full_description)  AS full_description,
      p.phone,
      p.email,
      p.website_url,
      p.booking_url,
      p.address_line,
      p.latitude,
      p.longitude,
      p.brand_id,
      br.name  AS brand_name,
      br.slug  AS brand_slug
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
    LIMIT 1
    `,
    [slug, locale],
  )
  return rows[0] ?? null
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
      COALESCE(ct.name, ct_lang.name, ct_fb.name, c.slug) AS name,
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
      COALESCE(st.name, st_lang.name, st_fb.name, s.slug) AS name,
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
      COALESCE(pt.name,   pt_lang.name,   pt_fb.name,   p.name)   AS name,
      COALESCE(dt.name,   dt_lang.name,   dt_fb.name,   d.name)   AS city_name,
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
        COALESCE(pt.name, pt_lang.name, pt_fb.name, p.name) AS name,
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
