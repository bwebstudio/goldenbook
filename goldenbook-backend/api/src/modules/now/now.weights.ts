// ─── Configurable Scoring Weights ─────────────────────────────────────────────
//
// Resolution order:
//   1. A/B experiment variant weights (if active for this city)
//   2. Segment-specific + city-specific weights (most specific)
//   3. City-specific weights
//   4. Segment-specific weights (global)
//   5. Global weights from DB
//   6. Hardcoded DEFAULT_WEIGHTS (failsafe)
//
// Auto-optimization deltas are applied additively on top of the resolved base.
// Weights are cached in-memory for 5 minutes to avoid DB pressure.

import { db } from '../../db/postgres'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NowWeights {
  proximity:     number
  moment:        number
  time:          number
  weather:       number
  base_quality:  number  // was editorial — now auto-computed: saves + images + freshness
  user:          number
  commercial:    number
  now_tags:      number
}

/**
 * Rebalanced defaults.
 * base_quality replaces editorial — calculated from saves, image completeness, freshness.
 * No manual editorial boosts, no ratings, no manual curation flags.
 */
export const DEFAULT_WEIGHTS: NowWeights = {
  proximity:     0.10,
  moment:        0.15,
  time:          0.10,
  weather:       0.08,
  base_quality:  0.22,
  user:          0.10,
  commercial:    0.05,
  now_tags:      0.20,
}

const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS) as (keyof NowWeights)[]

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  weights: NowWeights
  fetchedAt: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const weightCache = new Map<string, CacheEntry>()

function cacheKey(city: string | null, segment: string | null): string {
  return `${city ?? '_'}:${segment ?? '_'}`
}

// ─── Weight resolution ───────────────────────────────────────────────────────

/**
 * Resolve the effective scoring weights for a given context.
 *
 * Resolution: DB (city+segment → city → segment → global) + adjustments → fallback
 */
export async function resolveWeights(
  city?: string | null,
  segment?: string | null,
): Promise<NowWeights> {
  const key = cacheKey(city ?? null, segment ?? null)

  const cached = weightCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.weights
  }

  try {
    // Fetch the best-matching base weights from DB
    const base = await fetchBaseWeights(city, segment)

    // Fetch the latest auto-optimization adjustment
    const delta = await fetchLatestAdjustment(city, segment)

    // Merge: base + delta, clamped to [0.01, 0.80]
    const merged = applyDelta(base, delta)

    // Normalize so weights sum to 1.0
    const normalized = normalizeWeights(merged)

    weightCache.set(key, { weights: normalized, fetchedAt: Date.now() })
    return normalized
  } catch {
    // DB failure → hardcoded fallback
    return DEFAULT_WEIGHTS
  }
}

/**
 * Fetch best-matching base weights from scoring_weights table.
 * Priority: city+segment > city > segment > global
 */
async function fetchBaseWeights(
  city?: string | null,
  segment?: string | null,
): Promise<NowWeights> {
  const { rows } = await db.query<{ weights: NowWeights }>(`
    SELECT weights FROM scoring_weights
    WHERE is_active = true
      AND (city = $1 OR city IS NULL)
      AND (segment = $2 OR segment IS NULL)
    ORDER BY
      (city IS NOT NULL)::int DESC,
      (segment IS NOT NULL)::int DESC
    LIMIT 1
  `, [city ?? null, segment ?? null])

  if (rows.length === 0) return { ...DEFAULT_WEIGHTS }
  return validateWeights(rows[0].weights)
}

/**
 * Fetch the latest auto-optimization delta for this context.
 */
async function fetchLatestAdjustment(
  city?: string | null,
  segment?: string | null,
): Promise<Partial<NowWeights> | null> {
  const { rows } = await db.query<{ delta_weights: Partial<NowWeights> }>(`
    SELECT delta_weights FROM scoring_weight_adjustments
    WHERE (city = $1 OR city IS NULL)
      AND (segment = $2 OR segment IS NULL)
    ORDER BY created_at DESC
    LIMIT 1
  `, [city ?? null, segment ?? null])

  return rows[0]?.delta_weights ?? null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateWeights(raw: any): NowWeights {
  const result = { ...DEFAULT_WEIGHTS }
  if (typeof raw !== 'object' || raw === null) return result
  for (const key of WEIGHT_KEYS) {
    if (typeof raw[key] === 'number' && raw[key] >= 0 && raw[key] <= 1) {
      result[key] = raw[key]
    }
  }
  return result
}

function applyDelta(base: NowWeights, delta: Partial<NowWeights> | null): NowWeights {
  if (!delta) return base
  const result = { ...base }
  for (const key of WEIGHT_KEYS) {
    if (typeof delta[key] === 'number') {
      // Clamp individual weights to [0.01, 0.80]
      result[key] = Math.max(0.01, Math.min(0.80, result[key] + delta[key]))
    }
  }
  return result
}

export function normalizeWeights(w: NowWeights): NowWeights {
  const sum = WEIGHT_KEYS.reduce((s, k) => s + w[k], 0)
  if (sum === 0) return { ...DEFAULT_WEIGHTS }
  const result = { ...w }
  for (const key of WEIGHT_KEYS) {
    result[key] = Math.round((w[key] / sum) * 1000) / 1000
  }
  return result
}

/**
 * Clear the weight cache. Used after auto-optimization writes new adjustments.
 */
export function clearWeightCache(): void {
  weightCache.clear()
}