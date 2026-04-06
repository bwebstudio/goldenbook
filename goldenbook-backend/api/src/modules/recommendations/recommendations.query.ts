import { db } from '../../db/postgres'
import type { RankCandidate } from './recommendations.dto'

// ─── Fetch candidates ─────────────────────────────────────────────────────
// Returns all published places in a city with auto-generated fields.
// Filtering by time window and scoring happens in the engine, not SQL.

export async function getCandidates(
  citySlug: string,
  locale: string,
): Promise<RankCandidate[]> {
  const { rows } = await db.query<RankCandidate>(`
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name, ''), NULLIF(pt_fb.name, ''), p.name) AS name,
      p.place_type,
      d.slug AS city_slug,
      COALESCE(NULLIF(dt.name, ''), d.name) AS city_name,
      p.latitude::float,
      p.longitude::float,
      p.price_tier,
      p.google_rating::float,
      p.featured,
      hero.bucket AS hero_bucket,
      hero.path   AS hero_path,
      COALESCE(NULLIF(pt.short_description, ''), NULLIF(pt_fb.short_description, ''), p.short_description) AS short_description,
      p.classification_auto,
      p.context_windows_auto,
      p.context_tags_auto,
      p.moment_tags_auto
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
    LEFT JOIN place_translations pt    ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_fb ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    LEFT JOIN destination_translations dt ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path
      FROM place_images pi
      JOIN media_assets ma ON ma.id = pi.asset_id
      WHERE pi.place_id = p.id AND pi.image_role IN ('hero', 'cover')
      ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
      LIMIT 1
    ) hero ON true
    WHERE p.status = 'published'
      AND p.is_active = true
      AND NOT p.is_temporarily_closed
      AND d.slug = $1
      AND p.place_type NOT IN ('transport', 'other')
    ORDER BY p.name
  `, [citySlug, locale])

  return rows
}

// ─── Multi-city candidates (union of join table) ──────────────────────────

export async function getCandidatesMultiCity(
  citySlug: string,
  locale: string,
): Promise<RankCandidate[]> {
  const { rows } = await db.query<RankCandidate>(`
    SELECT DISTINCT ON (p.id)
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name, ''), NULLIF(pt_fb.name, ''), p.name) AS name,
      p.place_type,
      d.slug AS city_slug,
      COALESCE(NULLIF(dt.name, ''), d.name) AS city_name,
      p.latitude::float,
      p.longitude::float,
      p.price_tier,
      p.google_rating::float,
      p.featured,
      hero.bucket AS hero_bucket,
      hero.path   AS hero_path,
      COALESCE(NULLIF(pt.short_description, ''), NULLIF(pt_fb.short_description, ''), p.short_description) AS short_description,
      p.classification_auto,
      p.context_windows_auto,
      p.context_tags_auto,
      p.moment_tags_auto
    FROM places p
    JOIN place_destinations pd ON pd.place_id = p.id
    JOIN destinations d ON d.id = pd.destination_id AND d.slug = $1
    LEFT JOIN place_translations pt    ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_fb ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    LEFT JOIN destination_translations dt ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path
      FROM place_images pi
      JOIN media_assets ma ON ma.id = pi.asset_id
      WHERE pi.place_id = p.id AND pi.image_role IN ('hero', 'cover')
      ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
      LIMIT 1
    ) hero ON true
    WHERE p.status = 'published'
      AND p.is_active = true
      AND NOT p.is_temporarily_closed
      AND p.place_type NOT IN ('transport', 'other')
    ORDER BY p.id, p.name
  `, [citySlug, locale])

  return rows
}

// ─── Log ranking debug ────────────────────────────────────────────────────

export async function logRankingDebug(data: {
  sessionId?: string
  citySlug: string
  timeOfDay: string
  window: string
  intent?: string
  budget?: string
  categoryFilter?: string
  userLat?: number
  userLng?: number
  candidatesTotal: number
  candidatesAfterFilter: number
  results: unknown
  scoringBreakdown?: unknown
}): Promise<void> {
  try {
    await db.query(`
      INSERT INTO ranking_debug (
        session_id, city_slug, time_of_day, time_window, intent, budget,
        category_filter, user_lat, user_lng,
        candidates_total, candidates_after_filter,
        results, scoring_breakdown
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      data.sessionId ?? null,
      data.citySlug,
      data.timeOfDay,
      data.window,
      data.intent ?? null,
      data.budget ?? null,
      data.categoryFilter ?? null,
      data.userLat ?? null,
      data.userLng ?? null,
      data.candidatesTotal,
      data.candidatesAfterFilter,
      JSON.stringify(data.results),
      data.scoringBreakdown ? JSON.stringify(data.scoringBreakdown) : null,
    ])
  } catch (err) {
    // Non-blocking — don't fail the request
    console.error('[ranking-debug] Failed to log:', err)
  }
}
