// ─── NOW Metrics Engine ──────────────────────────────────────────────────────
//
// Computes CTR and engagement metrics for the NOW recommendation system.
// Used by:
//   - Auto-optimization (daily adjustment)
//   - Admin dashboard (performance monitoring)
//   - A/B experiment evaluation

import { db } from '../../db/postgres'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NowPerformanceMetrics {
  impressions: number
  clicks: number
  ctr: number                    // clicks / impressions (0-1)
  /** Per-place breakdown (top 20 by impressions) */
  topPlaces: Array<{
    placeId: string
    impressions: number
    clicks: number
    ctr: number
  }>
  /** Per-moment breakdown */
  byMoment: Record<string, { impressions: number; clicks: number; ctr: number }>
  /** Per-time-of-day breakdown */
  byTimeOfDay: Record<string, { impressions: number; clicks: number; ctr: number }>
}

export interface ExperimentMetrics {
  experimentId: string
  name: string
  variantA: { impressions: number; clicks: number; ctr: number }
  variantB: { impressions: number; clicks: number; ctr: number }
}

// ─── City/timeframe metrics ──────────────────────────────────────────────────

/**
 * Get NOW performance metrics for a city over a timeframe.
 *
 * @param city - City slug (null for global)
 * @param days - Number of days to look back (default 7)
 */
export async function getNowPerformanceMetrics(
  city?: string | null,
  days = 7,
): Promise<NowPerformanceMetrics> {
  const cityFilter = city ? 'AND i.city = $2' : ''
  const cityFilterClicks = city ? 'AND c.city = $2' : ''
  const params: unknown[] = [days]
  if (city) params.push(city)

  // Total impressions
  const { rows: [impRow] } = await db.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count FROM now_impressions i
    WHERE i.created_at >= now() - ($1 || ' days')::interval ${cityFilter}
  `, params)

  // Total clicks
  const { rows: [clickRow] } = await db.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count FROM now_clicks c
    WHERE c.created_at >= now() - ($1 || ' days')::interval ${cityFilterClicks}
  `, params)

  const impressions = parseInt(impRow?.count ?? '0', 10)
  const clicks = parseInt(clickRow?.count ?? '0', 10)
  const ctr = impressions > 0 ? clicks / impressions : 0

  // Top places by impressions
  const { rows: topPlaces } = await db.query<{
    place_id: string; impressions: string; clicks: string
  }>(`
    SELECT
      i.place_id,
      COUNT(DISTINCT i.id)::text AS impressions,
      COUNT(DISTINCT c.id)::text AS clicks
    FROM now_impressions i
    LEFT JOIN now_clicks c ON c.place_id = i.place_id
      AND c.created_at >= now() - ($1 || ' days')::interval
    WHERE i.created_at >= now() - ($1 || ' days')::interval ${cityFilter}
    GROUP BY i.place_id
    ORDER BY COUNT(DISTINCT i.id) DESC
    LIMIT 20
  `, params)

  // By moment
  const { rows: momentRows } = await db.query<{
    moment: string; impressions: string; clicks: string
  }>(`
    SELECT
      i.context->>'moment' AS moment,
      COUNT(DISTINCT i.id)::text AS impressions,
      COUNT(DISTINCT c.id)::text AS clicks
    FROM now_impressions i
    LEFT JOIN now_clicks c ON c.place_id = i.place_id
      AND c.created_at >= now() - ($1 || ' days')::interval
    WHERE i.created_at >= now() - ($1 || ' days')::interval
      AND i.context->>'moment' IS NOT NULL
      ${cityFilter}
    GROUP BY i.context->>'moment'
  `, params)

  // By time of day
  const { rows: todRows } = await db.query<{
    time_of_day: string; impressions: string; clicks: string
  }>(`
    SELECT
      i.context->>'time_of_day' AS time_of_day,
      COUNT(DISTINCT i.id)::text AS impressions,
      COUNT(DISTINCT c.id)::text AS clicks
    FROM now_impressions i
    LEFT JOIN now_clicks c ON c.place_id = i.place_id
      AND c.created_at >= now() - ($1 || ' days')::interval
    WHERE i.created_at >= now() - ($1 || ' days')::interval ${cityFilter}
    GROUP BY i.context->>'time_of_day'
  `, params)

  return {
    impressions,
    clicks,
    ctr,
    topPlaces: topPlaces.map((r) => {
      const imp = parseInt(r.impressions, 10)
      const clk = parseInt(r.clicks, 10)
      return { placeId: r.place_id, impressions: imp, clicks: clk, ctr: imp > 0 ? clk / imp : 0 }
    }),
    byMoment: Object.fromEntries(
      momentRows.map((r) => {
        const imp = parseInt(r.impressions, 10)
        const clk = parseInt(r.clicks, 10)
        return [r.moment, { impressions: imp, clicks: clk, ctr: imp > 0 ? clk / imp : 0 }]
      }),
    ),
    byTimeOfDay: Object.fromEntries(
      todRows.map((r) => {
        const imp = parseInt(r.impressions, 10)
        const clk = parseInt(r.clicks, 10)
        return [r.time_of_day, { impressions: imp, clicks: clk, ctr: imp > 0 ? clk / imp : 0 }]
      }),
    ),
  }
}

// ─── A/B experiment metrics ──────────────────────────────────────────────────

export async function getExperimentMetrics(
  experimentId: string,
  days = 7,
): Promise<ExperimentMetrics | null> {
  const { rows: [exp] } = await db.query<{ id: string; name: string }>(`
    SELECT id, name FROM ab_experiments WHERE id = $1
  `, [experimentId])
  if (!exp) return null

  const variantMetrics = async (variant: string) => {
    const { rows: [r] } = await db.query<{ impressions: string; clicks: string }>(`
      SELECT
        COUNT(DISTINCT i.id)::text AS impressions,
        (SELECT COUNT(*)::text FROM now_clicks c
         WHERE c.created_at >= now() - ($2 || ' days')::interval
           AND c.place_id IN (
             SELECT place_id FROM now_impressions
             WHERE context->>'experiment_variant' = $1
               AND created_at >= now() - ($2 || ' days')::interval
           )
        ) AS clicks
      FROM now_impressions i
      WHERE i.context->>'experiment_variant' = $1
        AND i.created_at >= now() - ($2 || ' days')::interval
    `, [variant, days])
    const imp = parseInt(r?.impressions ?? '0', 10)
    const clk = parseInt(r?.clicks ?? '0', 10)
    return { impressions: imp, clicks: clk, ctr: imp > 0 ? clk / imp : 0 }
  }

  const [variantA, variantB] = await Promise.all([
    variantMetrics(`${experimentId}:A`),
    variantMetrics(`${experimentId}:B`),
  ])

  return { experimentId: exp.id, name: exp.name, variantA, variantB }
}