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
      COALESCE(dt.name, dt_lang.name, dt_fb.name, d.name) AS name
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
      COALESCE(dt.name, dt_lang.name, dt_fb.name, d.name) AS name
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
  // $1 = citySlug, $2 = locale, $3..N = place types, $N+1 = fetchLimit
  const typeParams = intent.placeTypes
    .map((_, i) => `$${i + 3}`)
    .join(', ')

  const { rows } = await db.query<ScoredPlace>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(pt.name, pt_lang.name, pt_fb.name, p.name)                                     AS name,
      d.slug                                                                                   AS city_slug,
      COALESCE(dt.name, dt_lang.name, dt_fb.name, d.name)                                     AS city_name,
      p.place_type,
      COALESCE(pt.short_description, pt_lang.short_description, pt_fb.short_description, p.short_description) AS short_description,
      COALESCE(pt.editorial_summary, pt_lang.editorial_summary, pt_fb.editorial_summary, p.editorial_summary) AS editorial_summary,
      p.featured,
      ps.popularity_score,
      hero_img.bucket                                                            AS hero_bucket,
      hero_img.path                                                              AS hero_path,
      p.created_at
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
    ORDER BY p.featured DESC, ps.popularity_score DESC NULLS LAST, p.created_at DESC
    LIMIT $${intent.placeTypes.length + 3}
    `,
    [citySlug, locale, ...intent.placeTypes, fetchLimit],
  )

  return rows
}
