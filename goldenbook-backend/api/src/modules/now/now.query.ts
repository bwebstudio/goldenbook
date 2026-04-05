// ─── NOW Database Queries ────────────────────────────────────────────────────
//
// Fetches candidate places for the NOW recommendation.
// Distance calculation is OPTIONAL — NOW works without user coordinates.
// When no location is available, ranking relies on editorial priority,
// context tags, time windows, and moment match.

import { db } from '../../db/postgres'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NowScoredPlace {
  id: string
  slug: string
  name: string
  city_slug: string
  city_name: string
  place_type: string
  short_description: string | null
  editorial_summary: string | null
  featured: boolean
  popularity_score: number | null
  hero_bucket: string | null
  hero_path: string | null
  created_at: Date
  latitude: number | null
  longitude: number | null
  distance_meters: number | null
  category_slugs: string[]
  // ── NOW editorial fields ──
  now_enabled: boolean
  now_priority: number
  now_featured: boolean
  context_tag_slugs: string[]
  context_tag_max_weight: number
  now_time_window_match: boolean
}

// ─── Main query ──────────────────────────────────────────────────────────────

/**
 * Fetch NOW candidates for a city, optionally with distance from user location.
 *
 * NOW-enabled places are prioritised in the ORDER BY but non-NOW places
 * are still included as fallback candidates (the scoring engine handles
 * the boost via now_priority / now_tags weights).
 *
 * @param citySlug - Destination slug to filter by
 * @param locale - Locale for translations
 * @param limit - Maximum candidates to fetch (fetch more than needed for scoring)
 * @param timeWindow - Current time-of-day window (for time_window match)
 * @param userLat - User latitude (optional, enables distance calculation)
 * @param userLon - User longitude (optional, enables distance calculation)
 */
export async function getNowCandidates(
  citySlug: string,
  locale: string,
  limit: number,
  timeWindow: string,
  userLat?: number,
  userLon?: number,
): Promise<NowScoredPlace[]> {
  const hasCoords = userLat != null && userLon != null

  // Build distance expression
  const distanceExpr = hasCoords
    ? `
      CASE
        WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN
          6371000 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS((p.latitude - $3) / 2)), 2) +
            COS(RADIANS($3)) * COS(RADIANS(p.latitude)) *
            POWER(SIN(RADIANS((p.longitude - $4) / 2)), 2)
          ))
        ELSE NULL
      END
    `
    : 'NULL'

  // Category slugs aggregation
  const categorySlugsExpr = `
    COALESCE(
      (SELECT array_agg(DISTINCT c.slug)
       FROM place_categories pc
       JOIN categories c ON c.id = pc.category_id
       WHERE pc.place_id = p.id),
      ARRAY[]::text[]
    )
  `

  // NOW context tags aggregation
  const nowTagsExpr = `
    COALESCE(
      (SELECT array_agg(nct.slug)
       FROM place_now_tags pnt
       JOIN now_context_tags nct ON nct.id = pnt.tag_id
       WHERE pnt.place_id = p.id),
      ARRAY[]::text[]
    )
  `

  // Max tag weight for this place (used as a scoring multiplier)
  const nowTagMaxWeightExpr = `
    COALESCE(
      (SELECT MAX(pnt.weight)
       FROM place_now_tags pnt
       WHERE pnt.place_id = p.id),
      1.0
    )
  `

  // Time window match: does this place have a matching time window entry?
  // If the place has NO time window rows, it's eligible for all windows (legacy).
  const timeWindowMatchExpr = `
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM place_now_time_windows tw WHERE tw.place_id = p.id)
        THEN true
      WHEN EXISTS (SELECT 1 FROM place_now_time_windows tw WHERE tw.place_id = p.id AND tw.time_window = $${hasCoords ? 5 : 3})
        THEN true
      ELSE false
    END
  `

  const params: unknown[] = [citySlug, locale]
  if (hasCoords) {
    params.push(userLat, userLon)
  }
  params.push(timeWindow)
  const limitIdx = params.length + 1
  params.push(limit)

  const { rows } = await db.query<NowScoredPlace>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name) AS name,
      d.slug AS city_slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name) AS city_name,
      p.place_type,
      COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) AS short_description,
      COALESCE(NULLIF(pt.editorial_summary,''), NULLIF(pt_lang.editorial_summary,''), NULLIF(pt_fb.editorial_summary,''), p.editorial_summary) AS editorial_summary,
      p.featured,
      ps.popularity_score,
      hero_img.bucket AS hero_bucket,
      hero_img.path AS hero_path,
      p.created_at,
      p.latitude,
      p.longitude,
      (${distanceExpr}) AS distance_meters,
      (${categorySlugsExpr}) AS category_slugs,
      -- NOW editorial fields
      COALESCE(p.now_enabled, false) AS now_enabled,
      COALESCE(p.now_priority, 0) AS now_priority,
      COALESCE(p.now_featured, false) AS now_featured,
      (${nowTagsExpr}) AS context_tag_slugs,
      (${nowTagMaxWeightExpr}) AS context_tag_max_weight,
      (${timeWindowMatchExpr}) AS now_time_window_match
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
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
      FROM place_images pi
      JOIN media_assets ma ON ma.id = pi.asset_id
      WHERE pi.place_id = p.id
        AND pi.image_role IN ('hero', 'cover')
      ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
      LIMIT 1
    ) hero_img ON true
    LEFT JOIN place_stats ps ON ps.place_id = p.id
    WHERE d.slug = lower($1)
      AND p.status = 'published'
      AND p.is_active = true
      AND p.is_temporarily_closed = false
      -- Eligibility: place must have at least one context tag (curated in dashboard)
      AND EXISTS (SELECT 1 FROM place_now_tags pnt WHERE pnt.place_id = p.id)
      -- NOW date window filter (if set)
      AND (p.now_start_at IS NULL OR p.now_start_at <= now())
      AND (p.now_end_at IS NULL OR p.now_end_at >= now())
    ORDER BY
      -- NOW-enabled + featured places first, then by priority
      p.now_featured DESC NULLS LAST,
      p.now_enabled DESC NULLS LAST,
      p.now_priority DESC NULLS LAST,
      ${hasCoords ? '(CASE WHEN p.latitude IS NOT NULL THEN (' + distanceExpr + ') ELSE 999999 END) ASC,' : ''}
      p.featured DESC,
      ps.popularity_score DESC NULLS LAST,
      p.created_at DESC
    LIMIT $${limitIdx}
    `,
    params,
  )

  return rows
}

/**
 * Fetch a specific place by ID with distance calculation.
 * Used for the "not relevant" → Concierge handoff.
 */
export async function getNowPlaceById(
  placeId: string,
  locale: string,
  userLat?: number,
  userLon?: number,
): Promise<NowScoredPlace | null> {
  const hasCoords = userLat != null && userLon != null

  const distanceExpr = hasCoords
    ? `
      CASE
        WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN
          6371000 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS((p.latitude - $3) / 2)), 2) +
            COS(RADIANS($3)) * COS(RADIANS(p.latitude)) *
            POWER(SIN(RADIANS((p.longitude - $4) / 2)), 2)
          ))
        ELSE NULL
      END
    `
    : 'NULL'

  const categorySlugsExpr = `
    COALESCE(
      (SELECT array_agg(DISTINCT c.slug)
       FROM place_categories pc
       JOIN categories c ON c.id = pc.category_id
       WHERE pc.place_id = p.id),
      ARRAY[]::text[]
    )
  `

  const params: unknown[] = [placeId, locale]
  if (hasCoords) params.push(userLat, userLon)

  const { rows } = await db.query<NowScoredPlace>(
    `
    SELECT
      p.id, p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name) AS name,
      d.slug AS city_slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name) AS city_name,
      p.place_type,
      COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) AS short_description,
      COALESCE(NULLIF(pt.editorial_summary,''), NULLIF(pt_lang.editorial_summary,''), NULLIF(pt_fb.editorial_summary,''), p.editorial_summary) AS editorial_summary,
      p.featured,
      ps.popularity_score,
      hero_img.bucket AS hero_bucket,
      hero_img.path AS hero_path,
      p.created_at,
      p.latitude, p.longitude,
      (${distanceExpr}) AS distance_meters,
      (${categorySlugsExpr}) AS category_slugs,
      COALESCE(p.now_enabled, false) AS now_enabled,
      COALESCE(p.now_priority, 0) AS now_priority,
      COALESCE(p.now_featured, false) AS now_featured,
      ARRAY[]::text[] AS now_tag_slugs,
      1.0::real AS now_tag_max_weight,
      true AS now_time_window_match
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
    LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_lang
           ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN place_translations pt_fb ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    LEFT JOIN destination_translations dt ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path
      FROM place_images pi JOIN media_assets ma ON ma.id = pi.asset_id
      WHERE pi.place_id = p.id AND pi.image_role IN ('hero', 'cover')
      ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC
      LIMIT 1
    ) hero_img ON true
    LEFT JOIN place_stats ps ON ps.place_id = p.id
    WHERE p.id = $1
    `,
    params,
  )

  return rows[0] ?? null
}
