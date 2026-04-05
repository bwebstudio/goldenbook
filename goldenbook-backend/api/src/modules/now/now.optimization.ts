// ─── NOW Auto-Weight Optimization ────────────────────────────────────────────
//
// Safe, rule-based weight tuning. NOT machine learning.
//
// Logic:
//   1. Compute CTR by factor (moment, time_of_day, weather)
//   2. If a factor consistently selects low-CTR places → reduce its weight
//   3. If a factor consistently selects high-CTR places → increase its weight
//   4. Cap adjustments at ±5% per cycle
//   5. Store delta in scoring_weight_adjustments table
//
// Designed to run as a daily scheduled job.

import { db } from '../../db/postgres'
import { DEFAULT_WEIGHTS, type NowWeights, normalizeWeights, clearWeightCache } from './now.weights'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum delta per weight per cycle: ±5% */
const MAX_DELTA = 0.05

/** Minimum impressions needed to make any adjustment */
const MIN_IMPRESSIONS = 50

/** CTR thresholds for adjustment decisions */
const LOW_CTR_THRESHOLD = 0.02    // < 2% CTR = underperforming
const HIGH_CTR_THRESHOLD = 0.08   // > 8% CTR = overperforming

// ─── Main optimization function ──────────────────────────────────────────────

/**
 * Run the auto-optimization for a specific city (or globally).
 * Should be called once daily (e.g. via cron or manual trigger).
 *
 * @returns The computed delta, or null if insufficient data
 */
export async function runAutoOptimization(
  city?: string | null,
  days = 7,
): Promise<Partial<NowWeights> | null> {
  const cityFilter = city ? 'AND i.city = $2' : ''
  const params: unknown[] = [days]
  if (city) params.push(city)

  // Check if we have enough data
  const { rows: [countRow] } = await db.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count FROM now_impressions i
    WHERE i.created_at >= now() - ($1 || ' days')::interval ${cityFilter}
  `, params)

  const totalImpressions = parseInt(countRow?.count ?? '0', 10)
  if (totalImpressions < MIN_IMPRESSIONS) return null

  // Get global CTR as baseline
  const { rows: [globalRow] } = await db.query<{ impressions: string; clicks: string }>(`
    SELECT
      COUNT(DISTINCT i.id)::text AS impressions,
      COUNT(DISTINCT c.id)::text AS clicks
    FROM now_impressions i
    LEFT JOIN now_clicks c ON c.place_id = i.place_id
      AND c.session_id = i.session_id
      AND c.created_at BETWEEN i.created_at AND i.created_at + interval '30 minutes'
    WHERE i.created_at >= now() - ($1 || ' days')::interval ${cityFilter}
  `, params)

  const globalImpressions = parseInt(globalRow?.impressions ?? '0', 10)
  const globalClicks = parseInt(globalRow?.clicks ?? '0', 10)
  const globalCTR = globalImpressions > 0 ? globalClicks / globalImpressions : 0

  // Compute CTR by moment factor
  const momentCTR = await getFactorCTR('moment', city, days)
  const timeCTR = await getFactorCTR('time_of_day', city, days)
  const weatherCTR = await getFactorCTR('weather', city, days)

  // Compute deltas based on factor performance
  const delta: Partial<NowWeights> = {}

  // Moment weight: the most important contextual signal
  delta.moment = computeDelta(momentCTR, globalCTR)

  // Time weight
  delta.time = computeDelta(timeCTR, globalCTR)

  // Weather weight
  delta.weather = computeDelta(weatherCTR, globalCTR)

  // If CTR is generally low, boost proximity (closer places = more clicks)
  if (globalCTR < LOW_CTR_THRESHOLD) {
    delta.proximity = MAX_DELTA * 0.5 // small positive bump
  }

  // If CTR is generally high, slightly boost editorial (quality is working)
  if (globalCTR > HIGH_CTR_THRESHOLD) {
    delta.base_quality = MAX_DELTA * 0.3
  }

  // Only save if there's a meaningful delta
  const hasChange = Object.values(delta).some((v) => v !== undefined && Math.abs(v) > 0.001)
  if (!hasChange) return null

  // Store the adjustment
  await db.query(`
    INSERT INTO scoring_weight_adjustments (city, segment, delta_weights, reason)
    VALUES ($1, NULL, $2, 'auto_ctr_optimization')
  `, [city ?? null, JSON.stringify(delta)])

  // Clear cache so next request picks up new weights
  clearWeightCache()

  return delta
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get average CTR for impressions where a specific context factor was present.
 */
async function getFactorCTR(
  factor: string,
  city: string | null | undefined,
  days: number,
): Promise<number> {
  const cityFilter = city ? 'AND i.city = $2' : ''
  const params: unknown[] = [days]
  if (city) params.push(city)

  const { rows: [r] } = await db.query<{ impressions: string; clicks: string }>(`
    SELECT
      COUNT(DISTINCT i.id)::text AS impressions,
      COUNT(DISTINCT c.id)::text AS clicks
    FROM now_impressions i
    LEFT JOIN now_clicks c ON c.place_id = i.place_id
      AND c.session_id = i.session_id
      AND c.created_at BETWEEN i.created_at AND i.created_at + interval '30 minutes'
    WHERE i.created_at >= now() - ($1 || ' days')::interval
      AND i.context->>'${factor}' IS NOT NULL
      ${cityFilter}
  `, params)

  const imp = parseInt(r?.impressions ?? '0', 10)
  const clk = parseInt(r?.clicks ?? '0', 10)
  return imp > 0 ? clk / imp : 0
}

/**
 * Compute a weight delta based on factor CTR vs global CTR.
 *
 * - Factor CTR >> global → small positive delta (this factor helps)
 * - Factor CTR << global → small negative delta (this factor hurts)
 * - Similar → no change
 */
function computeDelta(factorCTR: number, globalCTR: number): number {
  if (globalCTR === 0) return 0

  const ratio = factorCTR / globalCTR

  if (ratio > 1.3) {
    // Factor outperforms global → boost (up to +5%)
    return Math.min(MAX_DELTA, (ratio - 1) * MAX_DELTA)
  }
  if (ratio < 0.7) {
    // Factor underperforms → reduce (down to -5%)
    return Math.max(-MAX_DELTA, (ratio - 1) * MAX_DELTA)
  }

  return 0 // Within normal range, no adjustment
}