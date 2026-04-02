import { db } from '../../db/postgres'
import type { ConciergeIntent } from './concierge.intents'
import type { ScoredPlace } from './concierge.service'

// ─── City lookup ──────────────────────────────────────────────────────────────

export async function getConciergeCity(
  slug: string,
  locale: string,
): Promise<{ slug: string; name: string } | null> {
  const { rows } = await db.query<{ slug: string; name: string }>(
    `
    SELECT
      d.slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name) AS name
    FROM destinations d
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    WHERE d.slug = $1
      AND d.is_active = true
    LIMIT 1
    `,
    [slug, locale],
  )
  return rows[0] ?? null
}

export async function getDefaultConciergeCity(
  locale: string,
): Promise<{ slug: string; name: string }> {
  const { rows } = await db.query<{ slug: string; name: string }>(
    `
    SELECT
      d.slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name) AS name
    FROM destinations d
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $1
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($1, '-', 1) AND $1 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    WHERE d.destination_type = 'city'
      AND d.is_active = true
    ORDER BY d.featured DESC, d.sort_order ASC
    LIMIT 1
    `,
    [locale],
  )
  // Dev fallback: no cities in DB yet → pretend Lisbon
  return rows[0] ?? { slug: 'lisbon', name: 'Lisbon' }
}

// ─── Place candidates for recommendations ─────────────────────────────────────
//
// Fetches more places than the requested limit so the application-layer scorer
// (scoreConciergePlace) can select the best N results.
//
// Filters:
//   - published & not temporarily closed
//   - city matches
//   - place_type within intent.placeTypes
//
// Pre-sorts by featured DESC + popularity DESC so the most likely candidates
// rise first even before scoring.
//
// V2 TODO: join on a future place_tags table for richer tag matching.

export async function getConciergeRecommendations(
  citySlug: string,
  intent: ConciergeIntent,
  locale: string,
  fetchLimit: number,
): Promise<ScoredPlace[]> {
  if (intent.placeTypes.length === 0) return []

  // Build parameterised IN clause for placeTypes
  // $1 = citySlug, $2 = locale, $3..N = place types, $N+1..M = editorial intents, $M+1 = fetchLimit
  const typeParams = intent.placeTypes.map((_, i) => `$${i + 3}`).join(', ')

  // Editorial intents: primary + fallback
  const allIntents = [...(intent.editorialIntents ?? []), ...(intent.fallbackIntents ?? [])]
  const intentStartIdx = 3 + intent.placeTypes.length
  const intentParams = allIntents.map((_, i) => `$${intentStartIdx + i}`).join(', ')
  const intentFilter = allIntents.length > 0
    ? `AND (p.intents && ARRAY[${intentParams}]::text[] OR p.intents = ARRAY[]::text[])`
    : ''

  // Context tags aggregation (shared with NOW — editorial relevance metadata)
  const contextTagsExpr = `
    COALESCE(
      (SELECT array_agg(nct.slug)
       FROM place_now_tags pnt
       JOIN now_context_tags nct ON nct.id = pnt.tag_id
       WHERE pnt.place_id = p.id),
      ARRAY[]::text[]
    )
  `

  // Time window slugs (editor-defined time relevance)
  const timeWindowsExpr = `
    COALESCE(
      (SELECT array_agg(tw.time_window)
       FROM place_now_time_windows tw
       WHERE tw.place_id = p.id),
      ARRAY[]::text[]
    )
  `

  const { rows } = await db.query<ScoredPlace>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name)                                     AS name,
      d.slug                                                                                   AS city_slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name)                                     AS city_name,
      p.place_type,
      COALESCE(NULLIF(pt.short_description,''), NULLIF(pt_lang.short_description,''), NULLIF(pt_fb.short_description,''), p.short_description) AS short_description,
      COALESCE(NULLIF(pt.editorial_summary,''), NULLIF(pt_lang.editorial_summary,''), NULLIF(pt_fb.editorial_summary,''), p.editorial_summary) AS editorial_summary,
      p.featured,
      ps.popularity_score,
      hero_img.bucket                                                            AS hero_bucket,
      hero_img.path                                                              AS hero_path,
      p.created_at,
      (${contextTagsExpr}) AS context_tag_slugs,
      (${timeWindowsExpr}) AS time_window_slugs
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
      FROM   place_images pi
      JOIN   media_assets ma ON ma.id = pi.asset_id
      WHERE  pi.place_id = p.id
        AND  pi.image_role IN ('hero', 'cover')
      ORDER  BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
      LIMIT  1
    ) hero_img ON true
    LEFT JOIN place_stats ps ON ps.place_id = p.id
    WHERE d.slug = $1
      AND p.status = 'published'
      AND p.is_active = true
      AND p.is_temporarily_closed = false
      AND p.place_type IN (${typeParams})
      ${intentFilter}
    ORDER BY
      -- Places with matching primary intents first
      CASE WHEN p.intents && ARRAY[${allIntents.length > 0 ? allIntents.slice(0, (intent.editorialIntents ?? []).length).map((_, i) => `$${intentStartIdx + i}`).join(', ') : "'__none__'"  }]::text[] THEN 0 ELSE 1 END,
      p.featured DESC,
      ps.popularity_score DESC NULLS LAST,
      p.created_at DESC
    LIMIT $${intentStartIdx + allIntents.length}
    `,
    [citySlug, locale, ...intent.placeTypes, ...allIntents, fetchLimit],
  )

  return rows
}

/**
 * Get viable intent tags: only intents that have >= minPlaces published places.
 */
export async function getViableIntents(citySlug: string, minPlaces = 2): Promise<Set<string>> {
  const { rows } = await db.query<{ intent: string; count: string }>(`
    SELECT unnest(p.intents) AS intent, COUNT(DISTINCT p.id)::text AS count
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
    WHERE p.status = 'published' AND p.is_active = true
      AND d.slug = $1
      AND p.intents != ARRAY[]::text[]
    GROUP BY unnest(p.intents)
    HAVING COUNT(DISTINCT p.id) >= $2
  `, [citySlug, minPlaces]).catch(() => ({ rows: [] as { intent: string; count: string }[] }))

  return new Set(rows.map((r) => r.intent))
}

// Related place_type expansion: if searching for 'bar', also try 'restaurant', etc.
const RELATED_TYPES: Record<string, string[]> = {
  bar: ['restaurant', 'cafe'],
  restaurant: ['bar', 'cafe'],
  cafe: ['restaurant', 'bar'],
  museum: ['activity'],
  activity: ['museum'],
  hotel: [],
  shop: [],
  beach: ['activity'],
  transport: [],
  other: [],
}

/**
 * Fallback: get top places for a city using related place_types,
 * prioritizing tracking data. Never falls back to unrelated types (no shops for bars).
 */
export async function getFallbackPlaces(
  citySlug: string,
  locale: string,
  excludeIds: string[],
  limit: number,
  originalPlaceTypes?: string[],
): Promise<ScoredPlace[]> {
  // Build expanded type list: original types + related types
  const typeSet = new Set<string>()
  if (originalPlaceTypes) {
    for (const t of originalPlaceTypes) {
      typeSet.add(t)
      for (const related of (RELATED_TYPES[t] ?? [])) typeSet.add(related)
    }
  }
  // If no types provided, use food & drink as default (never shops/transport)
  if (typeSet.size === 0) {
    typeSet.add('restaurant')
    typeSet.add('bar')
    typeSet.add('cafe')
  }

  const types = [...typeSet]
  // Build params: $1=city, $2=locale, $3..$N=types, $N+1..$M=excludeIds, $M+1=limit
  let idx = 2
  const typeParams = types.map(() => `$${++idx}`).join(', ')
  const excludeParams = excludeIds.map(() => `$${++idx}`).join(', ')
  const excludeClause = excludeIds.length > 0 ? `AND p.id NOT IN (${excludeParams})` : ''
  const limitParam = `$${++idx}`

  const { rows } = await db.query<ScoredPlace>(
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
      COALESCE(
        (SELECT array_agg(nct.slug) FROM place_now_tags pnt JOIN now_context_tags nct ON nct.id = pnt.tag_id WHERE pnt.place_id = p.id),
        ARRAY[]::text[]
      ) AS context_tag_slugs,
      COALESCE(
        (SELECT array_agg(tw.time_window) FROM place_now_time_windows tw WHERE tw.place_id = p.id),
        ARRAY[]::text[]
      ) AS time_window_slugs
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
    LEFT JOIN (
      SELECT place_id, COUNT(*) AS event_count
      FROM place_analytics_events
      WHERE event_type IN ('view_place', 'save_place')
        AND created_at >= now() - '30 days'::interval
      GROUP BY place_id
    ) tracking ON tracking.place_id = p.id
    WHERE d.slug = $1
      AND p.status = 'published' AND p.is_active = true AND p.is_temporarily_closed = false
      AND p.place_type IN (${typeParams})
      ${excludeClause}
    ORDER BY
      p.featured DESC,
      COALESCE(tracking.event_count, 0) DESC,
      ps.popularity_score DESC NULLS LAST,
      p.created_at DESC
    LIMIT ${limitParam}
    `,
    [citySlug, locale, ...types, ...excludeIds, limit],
  )

  return rows
}
