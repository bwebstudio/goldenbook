// ─── STEP 3: Diversity Multiplier ────────────────────────────────────────────
//
// Applied as the LAST step in the scoring pipeline (after STEP 1 base score
// and STEP 2 adjustments). Multiplies totalScore, does not add/subtract.
//
// Rules:
//   - Adjacent same place_type: totalScore × 0.85 (15% penalty)
//   - Adjacent same bestTag: totalScore × 0.90 (10% penalty)
//   - Score plateau (<5% diff): 40% chance of random swap for variety
//   - Paid placements get a SOFT penalty (×0.95) instead of being exempt,
//     so a single sponsored slot still has the edge but cannot dominate
//     the entire result set.
//   - At most ONE sponsored item is allowed in the final result set.
//   - Pool ≤ 3 candidates: diversity is skipped entirely

import type { ScoredCandidate } from './types'

// ─── Config ─────────────────────────────────────────────────────────────────

const SAME_CATEGORY_PENALTY  = 0.85   // 15% penalty for same place_type in a row
const SAME_TAG_PENALTY       = 0.90   // 10% penalty for same bestTag in a row
const PLATEAU_THRESHOLD      = 0.05   // 5% score difference = "similar enough to swap"
// Soft penalty for sponsored items when they would otherwise stack with the
// previous item's category/tag. Keeps them eligible (still ranked highly) but
// prevents wall-to-wall sponsored stacking of identical categories.
const SPONSORED_SOFT_PENALTY = 0.95

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

  // Low-candidate pool: relax diversity to avoid over-filtering
  if (sorted.length <= 3) return sorted

  // Clone to avoid mutating input
  const arr = sorted.map((r) => ({ ...r }))

  // Pass 1: apply penalties for adjacent same-category and same-tag.
  // Sponsored placements get a SOFT penalty instead of being skipped entirely
  // — they retain their visibility advantage but cannot stack uncontested.
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1]
    const curr = arr[i]

    const sameType = curr.place.place_type === prev.place.place_type
    const sameTag  = !!(curr.bestTag && curr.bestTag === prev.bestTag)

    if (curr.isSponsored) {
      // Soft, single shared penalty when stacking next to a similar slot.
      if (sameType || sameTag) {
        curr.totalScore *= SPONSORED_SOFT_PENALTY
      }
      continue
    }

    if (sameType) {
      curr.totalScore *= SAME_CATEGORY_PENALTY
    }

    if (sameTag) {
      curr.totalScore *= SAME_TAG_PENALTY
    }
  }

  // Re-sort after penalties
  arr.sort((a, b) => b.totalScore - a.totalScore)

  // Pass 1b: cap to a maximum of one sponsored item in the result set.
  // We keep the highest-scoring sponsored entry and demote any additional
  // sponsored entries to the bottom of the list so they don't reach the
  // top-N slice consumers will display.
  let sponsoredKept = false
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i].isSponsored) continue
    if (!sponsoredKept) {
      sponsoredKept = true
      continue
    }
    // Demote: subtract enough to push to the back of the array on re-sort.
    arr[i].totalScore = -Math.abs(arr[i].totalScore) - 1
  }
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
