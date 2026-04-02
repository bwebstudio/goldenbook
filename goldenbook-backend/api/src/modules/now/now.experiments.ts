// ─── A/B Experiment System ────────────────────────────────────────────────────
//
// Lightweight A/B testing for NOW scoring weights.
//
// Assignment:
//   - Deterministic via hash(sessionId) — same session always gets same variant
//   - 50/50 split: even hash → A, odd hash → B
//
// Behavior:
//   - Variant A uses default weights (or variant_a override if set)
//   - Variant B uses experimental weights (variant_b)
//   - Tracks experiment variant in impression context for metrics

import { db } from '../../db/postgres'
import { type NowWeights, DEFAULT_WEIGHTS } from './now.weights'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ABExperiment {
  id: string
  name: string
  city: string | null
  variantA: Partial<NowWeights>
  variantB: NowWeights
  isActive: boolean
}

export interface ExperimentAssignment {
  experimentId: string
  experimentName: string
  variant: 'A' | 'B'
  weights: NowWeights | null  // null = use default weights
}

// ─── Cache ───────────────────────────────────────────────────────────────────

let experimentCache: { experiments: ABExperiment[]; fetchedAt: number } | null = null
const CACHE_TTL = 2 * 60 * 1000 // 2 min

async function getActiveExperiments(): Promise<ABExperiment[]> {
  if (experimentCache && Date.now() - experimentCache.fetchedAt < CACHE_TTL) {
    return experimentCache.experiments
  }

  try {
    const { rows } = await db.query<{
      id: string; name: string; city: string | null
      variant_a: Partial<NowWeights>; variant_b: NowWeights; is_active: boolean
    }>(`
      SELECT id, name, city, variant_a, variant_b, is_active
      FROM ab_experiments
      WHERE is_active = true
        AND (ends_at IS NULL OR ends_at > now())
      ORDER BY created_at DESC
    `)

    const experiments = rows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      variantA: r.variant_a,
      variantB: r.variant_b,
      isActive: r.is_active,
    }))

    experimentCache = { experiments, fetchedAt: Date.now() }
    return experiments
  } catch {
    return []
  }
}

// ─── Assignment ──────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash for A/B assignment.
 * Returns a number 0-99 from the session ID string.
 */
function hashSessionId(sessionId: string): number {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 100
}

/**
 * Resolve the A/B experiment assignment for a session + city context.
 *
 * Returns null if no active experiment matches, otherwise returns the
 * experiment details and assigned variant.
 */
export async function resolveExperiment(
  sessionId: string,
  city: string,
): Promise<ExperimentAssignment | null> {
  const experiments = await getActiveExperiments()

  // Find first experiment matching this city (most specific wins)
  const match = experiments.find((e) => e.city === city)
    ?? experiments.find((e) => e.city === null) // global fallback

  if (!match) return null

  // Deterministic assignment: hash(sessionId) → 50/50 split
  const bucket = hashSessionId(sessionId)
  const variant: 'A' | 'B' = bucket < 50 ? 'A' : 'B'

  // Resolve weights for this variant
  let weights: NowWeights | null = null
  if (variant === 'B') {
    weights = { ...DEFAULT_WEIGHTS, ...match.variantB }
  } else if (Object.keys(match.variantA).length > 0) {
    weights = { ...DEFAULT_WEIGHTS, ...match.variantA }
  }
  // null = use default resolution path

  return {
    experimentId: match.id,
    experimentName: match.name,
    variant,
    weights,
  }
}