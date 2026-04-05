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
import { type ScoringWeights, DEFAULT_WEIGHTS, WEIGHT_KEYS } from '../shared-scoring/types'

// Re-export the shared types so existing consumers don't break
export type { ScoringWeights as NowWeights }
export { DEFAULT_WEIGHTS }

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  weights: ScoringWeights
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
): Promise<ScoringWeights> {
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
    return { ...DEFAULT_WEIGHTS }
  }
}

/**
 * Fetch best-matching base weights from scoring_weights table.
 * Handles both old 8-key and new 5-key formats for backwards compatibility.
 */
async function fetchBaseWeights(
  city?: string | null,
  segment?: string | null,
): Promise<ScoringWeights> {
  const { rows } = await db.query<{ weights: Record<string, number> }>(`
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
  return migrateWeights(rows[0].weights)
}

/**
 * Fetch the latest auto-optimization delta for this context.
 */
async function fetchLatestAdjustment(
  city?: string | null,
  segment?: string | null,
): Promise<Partial<ScoringWeights> | null> {
  const { rows } = await db.query<{ delta_weights: Partial<ScoringWeights> }>(`
    SELECT delta_weights FROM scoring_weight_adjustments
    WHERE (city = $1 OR city IS NULL)
      AND (segment = $2 OR segment IS NULL)
    ORDER BY created_at DESC
    LIMIT 1
  `, [city ?? null, segment ?? null])

  return rows[0]?.delta_weights ?? null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Migrate old 8-key weights to new 5-key format.
 * If already in new format, returns as-is.
 */
function migrateWeights(raw: Record<string, number>): ScoringWeights {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_WEIGHTS }

  // New format: has 'context' key
  if (typeof raw.context === 'number') {
    return validateWeights(raw)
  }

  // Old format: has 'moment', 'time', 'weather', 'now_tags' keys — convert
  return {
    commercial: (raw.commercial ?? 0.05) + (raw.now_tags ?? 0.20),
    context:    (raw.moment ?? 0.15) + (raw.time ?? 0.10) + (raw.weather ?? 0.08),
    editorial:  0.15,
    quality:    raw.base_quality ?? 0.22,
    proximity:  raw.proximity ?? 0.10,
  }
}

function validateWeights(raw: Record<string, number>): ScoringWeights {
  const result = { ...DEFAULT_WEIGHTS }
  for (const key of WEIGHT_KEYS) {
    if (typeof raw[key] === 'number' && raw[key] >= 0 && raw[key] <= 1) {
      result[key] = raw[key]
    }
  }
  return result
}

function applyDelta(base: ScoringWeights, delta: Partial<ScoringWeights> | null): ScoringWeights {
  if (!delta) return base
  const result = { ...base }
  for (const key of WEIGHT_KEYS) {
    if (typeof delta[key] === 'number') {
      result[key] = Math.max(0.01, Math.min(0.80, result[key] + delta[key]))
    }
  }
  return result
}

export function normalizeWeights(w: ScoringWeights): ScoringWeights {
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
