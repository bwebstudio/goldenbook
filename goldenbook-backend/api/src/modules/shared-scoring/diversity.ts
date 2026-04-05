// ─── Diversity Adjustment ────────────────────────────────────────────────────
//
// Prevents repetitive results by penalizing adjacent same-category and
// same-tag candidates, and introducing variety when scores are close.
//
// Applied AFTER scoring, BEFORE final selection.

import type { ScoredCandidate } from './types'

// ─── Config ─────────────────────────────────────────────────────────────────

const SAME_CATEGORY_PENALTY = 0.85   // 15% penalty for same place_type in a row
const SAME_TAG_PENALTY      = 0.90   // 10% penalty for same bestTag in a row
const PLATEAU_THRESHOLD     = 0.05   // 5% score difference = "similar enough to swap"

// ─── Main function ──────────────────────────────────────────────────────────

/**
 * Apply diversity rules to a sorted candidate list.
 *
 * Rules:
 *   1. Same category penalty: if a candidate has the same place_type as the
 *      previous one in the list, reduce its score.
 *   2. Same tag penalty: if a candidate has the same bestTag as the previous
 *      one, reduce its score.
 *   3. Score plateau rotation: when consecutive candidates have scores within
 *      5% of each other, randomly swap them for variety.
 *
 * Returns a new sorted array.
 */
export function applyDiversityRules(sorted: ScoredCandidate[]): ScoredCandidate[] {
  if (sorted.length <= 1) return sorted

  // Clone to avoid mutating input
  const arr = sorted.map((r) => ({ ...r }))

  // Pass 1: apply penalties for adjacent same-category and same-tag
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1]
    const curr = arr[i]

    if (curr.place.place_type === prev.place.place_type) {
      curr.totalScore *= SAME_CATEGORY_PENALTY
    }

    if (curr.bestTag && curr.bestTag === prev.bestTag) {
      curr.totalScore *= SAME_TAG_PENALTY
    }
  }

  // Re-sort after penalties
  arr.sort((a, b) => b.totalScore - a.totalScore)

  // Pass 2: plateau rotation — swap adjacent candidates with similar scores
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i]
    const b = arr[i + 1]

    if (a.totalScore === 0) continue

    const diff = Math.abs(a.totalScore - b.totalScore) / a.totalScore
    if (diff < PLATEAU_THRESHOLD && Math.random() < 0.4) {
      arr[i] = b
      arr[i + 1] = a
    }
  }

  return arr
}
