// ─── Unified Scoring Engine ──────────────────────────────────────────────────
//
// Single scoring pipeline shared by NOW and Concierge.
//
// ── Scoring Formula (explicit order of operations) ──────────────────────────
//
// STEP 1 — Base Score (computed here in scoreCandidate):
//
//   baseScore =
//     0.15 × commercialScore   (paid placement boost, dashboard priority)
//   + 0.30 × contextScore      (context tags × time-of-day × weather × intent overlap)
//   + 0.15 × editorialScore    (editorial tags, NOW featured, time window match)
//   + 0.25 × qualityScore      (popularity, hero image, recency)
//   + 0.15 × proximityScore    (distance from user, or neutral if unavailable)
//   + 0.12 × personalization   (onboarding interests + exploration style)
//
// STEP 2 — Adjustments (applied by the route handler AFTER scoreCandidate):
//
//   adjustedScore = baseScore
//     + intentMatchAdjustment   (+5 match, -5/-12/-20 mismatch for paid)
//     + refinementAdjustment    (+8 per boosted tag, -6 per reduced tag)
//     - antiRepetitionPenalty   (-20 for already-shown places)
//     - heroHistoryPenalty      (-18 for places that were hero before)
//     - heroRotationPenalty     (-12 for the immediately previous hero)
//     - frequencyCapPenalty     (-20 for over-exposed places, paid exempt)
//
// STEP 3 — Diversity (applied LAST by applyDiversityRules):
//
//   finalScore = adjustedScore × diversityMultiplier
//     (0.85 for adjacent same place_type, 0.90 for same bestTag)
//     (paid placements are EXEMPT from diversity penalties)
//
// Weather NEVER eliminates candidates. It adjusts context score up or down.

import type {
  UnifiedCandidate,
  ScoredCandidate,
  ScoringContext,
  ScoringWeights,
  ScoreBreakdown,
} from './types'
import { DEFAULT_WEIGHTS } from './types'
import {
  TIME_TAG_BOOSTS,
  WEATHER_TAG_BOOSTS,
  EDITORIAL_TAGS,
  BASE_TIME_SCORE,
  type ContextTag,
} from './context-tags'

// ─── Component scorers ──────────────────────────────────────────────────────

/**
 * Commercial score (0–100).
 * Boosts paid NOW slots and dashboard-prioritized places.
 */
function scoreCommercial(place: UnifiedCandidate, isPaid: boolean): number {
  let score = 0

  if (isPaid) score += 70

  if (place.now_enabled) {
    score += Math.min(place.now_priority, 10) * 3 // 0–30
  }

  if (place.now_featured) score += 15

  return Math.min(score, 100)
}

/**
 * Context score (0–100).
 * Uses the place's dashboard context tags combined with time-of-day and weather boosts.
 * Returns the score AND the best-matching tag (used for copy generation).
 *
 * For Concierge: intent tag overlap provides an additional boost.
 */
function scoreContext(
  place: UnifiedCandidate,
  ctx: ScoringContext,
): { score: number; bestTag: string | null } {
  const tags = place.context_tag_slugs
  if (tags.length === 0) return { score: 0, bestTag: null }

  let bestScore = 0
  let bestTag: string | null = null

  const timeBoosts = TIME_TAG_BOOSTS[ctx.timeOfDay] ?? {}
  const weatherBoosts = ctx.weather ? (WEATHER_TAG_BOOSTS[ctx.weather] ?? {}) : {}

  for (const tag of tags) {
    const t = tag as ContextTag

    // Time relevance: explicit boost or base
    const timeBoost = timeBoosts[t] ?? BASE_TIME_SCORE
    // Weather adjustment: positive, negative, or zero
    const weatherBoost = weatherBoosts[t] ?? 0
    // Tag weight from dashboard editor (1.0 normal, up to 2.0 strong)
    const tagWeight = place.context_tag_max_weight

    const combined = (timeBoost + weatherBoost) * Math.min(tagWeight, 2.0)

    if (combined > bestScore) {
      bestScore = combined
      bestTag = tag
    }
  }

  // Concierge intent overlap: if intent tags match place tags, boost
  if (ctx.intentTags?.length) {
    const placeTagSet = new Set(tags)
    for (const intentTag of ctx.intentTags) {
      const normalized = intentTag.toLowerCase().replace(/[^a-z0-9]/g, '-')
      if (placeTagSet.has(normalized)) {
        bestScore += 0.15 // additive per matching intent tag
      }
    }
  }

  // Scale to 0–100 (max theoretical combined is ~2.8 with high tag weight + boosts)
  const scaled = Math.round(Math.min(bestScore / 1.8, 1) * 100)

  return { score: scaled, bestTag }
}

/**
 * Editorial score (0–100).
 * Rewards curated editorial tags (local-secret, romantic, fine-dining, etc.)
 * and NOW-specific editorial fields.
 */
function scoreEditorial(place: UnifiedCandidate): number {
  let score = 0

  // Editorial tag presence
  for (const tag of place.context_tag_slugs) {
    if (EDITORIAL_TAGS.has(tag as ContextTag)) {
      score += 20
    }
  }

  // NOW editorial flags
  if (place.now_featured) score += 20
  if (place.now_enabled && place.now_time_window_match) score += 15

  return Math.min(score, 100)
}

/**
 * Quality score (0–100).
 * Auto-computed from objective signals: popularity, image, freshness.
 * No manual editorial boosts.
 */
function scoreQuality(place: UnifiedCandidate): number {
  let score = 0

  // Popularity (from place_stats saves)
  const saves = place.popularity_score ?? 0
  if      (saves >= 80) score += 35
  else if (saves >= 60) score += 25
  else if (saves >= 40) score += 15
  else if (saves >= 20) score += 8
  else                  score += 3

  // Image quality
  if (place.hero_bucket && place.hero_path) {
    score += 30
  }

  // Freshness
  if (place.created_at) {
    const daysSince = (Date.now() - new Date(place.created_at).getTime()) / 86_400_000
    if      (daysSince <= 30)  score += 20
    else if (daysSince <= 90)  score += 12
    else if (daysSince <= 180) score += 5
  }

  return Math.min(score, 100)
}

/**
 * Proximity score (0–100).
 * When coordinates are available, closer = higher.
 * When unavailable, returns a neutral score (not zero).
 */
function scoreProximity(distanceMeters: number | null): number {
  if (distanceMeters == null) return 30 // neutral — don't penalize missing location
  if (distanceMeters <= 500)  return 100
  if (distanceMeters >= 5000) return 0
  return Math.round(100 * (1 - (distanceMeters - 500) / 4500))
}

// ─── Personalization scoring ────────────────────────────────────────────────

/**
 * Map onboarding interest IDs to context tag slugs.
 * When a user selects "Wine & Tastings", places tagged with "wine" get a boost.
 */
const INTEREST_TO_TAGS: Record<string, string[]> = {
  'fine-dining':  ['fine-dining', 'dinner', 'lunch', 'romantic'],
  'wine':         ['wine', 'sunset', 'terrace'],
  'culture':      ['culture', 'viewpoint', 'local-secret'],
  'hidden-gems':  ['local-secret', 'culture', 'viewpoint'],
  'hotels':       ['wellness', 'rooftop', 'terrace'],
  'nature':       ['viewpoint', 'sunset', 'terrace'],
  'nightlife':    ['cocktails', 'late-night', 'live-music'],
  'wellness':     ['wellness', 'coffee', 'terrace'],
  'shopping':     ['shopping', 'quick-stop'],
  'history':      ['culture', 'viewpoint', 'local-secret'],
}

/**
 * Map exploration style to preferred context tags.
 */
const STYLE_TO_TAGS: Record<string, string[]> = {
  'solo':    ['coffee', 'culture', 'quick-stop', 'viewpoint'],
  'couple':  ['romantic', 'fine-dining', 'wine', 'sunset', 'terrace'],
  'friends': ['cocktails', 'live-music', 'late-night', 'rooftop'],
  'family':  ['family', 'culture', 'viewpoint', 'brunch', 'lunch', 'quick-stop'],
}

/**
 * Personalization score (0–100).
 * Boosts places that match the user's onboarding preferences.
 */
function scorePersonalization(
  place: UnifiedCandidate,
  ctx: ScoringContext,
): number {
  if (!ctx.userInterests?.length && !ctx.userStyle) return 0

  const placeTags = new Set(place.context_tag_slugs ?? [])
  if (placeTags.size === 0) return 0

  let score = 0

  // Interest matching: each matching tag adds points
  if (ctx.userInterests?.length) {
    for (const interest of ctx.userInterests) {
      const matchTags = INTEREST_TO_TAGS[interest]
      if (!matchTags) continue
      for (const tag of matchTags) {
        if (placeTags.has(tag)) {
          score += 12
          break // count each interest once
        }
      }
    }
  }

  // Style matching: exploration style preferences
  if (ctx.userStyle) {
    const styleTags = STYLE_TO_TAGS[ctx.userStyle]
    if (styleTags) {
      for (const tag of styleTags) {
        if (placeTags.has(tag)) {
          score += 8
          break // count style once
        }
      }
    }
  }

  return Math.min(score, 100)
}

// ─── STEP 1: Base Score (single candidate) ──────────────────────────────────
//
// Computes the base score from objective signals only.
// Route handlers apply STEP 2 (adjustments) and STEP 3 (diversity) afterward.

export function scoreCandidate(
  place: UnifiedCandidate,
  ctx: ScoringContext,
): ScoredCandidate {
  const isPaid = ctx.paidPlaceIds.has(place.id)
  const w = ctx.weights

  // ── Component scores (each 0–100) ──────────────────────────────────────
  const commercialScore      = scoreCommercial(place, isPaid)
  const { score: contextScore, bestTag } = scoreContext(place, ctx)
  const editorialScore       = scoreEditorial(place)
  const qualityScore         = scoreQuality(place)
  const proximityScore       = scoreProximity(place.distance_meters)
  const personalizationScore = scorePersonalization(place, ctx)

  // ── Base score: weighted sum + personalization bonus ────────────────────
  const baseScore =
    w.commercial * commercialScore +
    w.context    * contextScore +
    w.editorial  * editorialScore +
    w.quality    * qualityScore +
    w.proximity  * proximityScore

  const personalizationBonus = personalizationScore * 0.12

  // totalScore = baseScore + personalization (STEP 2 adjustments added by route)
  const totalScore = baseScore + personalizationBonus

  const breakdown: ScoreBreakdown = {
    commercial: { raw: commercialScore, weighted: round2(w.commercial * commercialScore) },
    context:    { raw: contextScore,    weighted: round2(w.context * contextScore) },
    editorial:  { raw: editorialScore,  weighted: round2(w.editorial * editorialScore) },
    quality:    { raw: qualityScore,    weighted: round2(w.quality * qualityScore) },
    proximity:  { raw: proximityScore,  weighted: round2(w.proximity * proximityScore) },
  }

  return {
    place,
    totalScore,
    commercialScore,
    contextScore,
    editorialScore,
    qualityScore,
    proximityScore,
    bestTag,
    isSponsored: isPaid,
    breakdown,
  }
}

// ─── Pipeline: score → filter → rank ────────────────────────────────────────

/**
 * Score all candidates, exclude filtered IDs, and sort by total score.
 * This is the shared pipeline entry point for both NOW and Concierge.
 *
 * Unlike the old system, candidates with zero context score are NOT removed.
 * They simply rank lower. The only hard filter is the excludeIds set.
 */
export function rankCandidates(
  candidates: UnifiedCandidate[],
  ctx: ScoringContext,
): ScoredCandidate[] {
  return candidates
    .filter((p) => !ctx.excludeIds.has(p.id))
    .map((place) => scoreCandidate(place, ctx))
    .sort((a, b) => b.totalScore - a.totalScore)
}

/**
 * Select top N candidates with paid placement visibility guarantee.
 *
 * Rules:
 *   - Valid paid placements are guaranteed a slot (contractual obligation)
 *   - Max 1 sponsored per selection
 *   - Remaining slots filled from organic via weighted random
 *   - No duplicate place IDs in results
 */
export function selectTopN(
  ranked: ScoredCandidate[],
  count: number,
): ScoredCandidate[] {
  if (ranked.length === 0) return []
  if (ranked.length <= count) return deduplicateResults(ranked)

  const selected: ScoredCandidate[] = []
  const usedIds = new Set<string>()

  // 1. Visibility floor: guarantee paid placement appears (max 1)
  const topSponsored = ranked.find((r) => r.isSponsored && !usedIds.has(r.place.id))
  if (topSponsored) {
    selected.push(topSponsored)
    usedIds.add(topSponsored.place.id)
  }

  // 2. Fill remaining from organic via weighted random
  const organic = ranked.filter((r) => !r.isSponsored && !usedIds.has(r.place.id))
  const remaining = count - selected.length
  const picked = weightedRandomPick(organic, remaining)
  for (const p of picked) {
    if (!usedIds.has(p.place.id)) {
      selected.push(p)
      usedIds.add(p.place.id)
    }
  }

  // 3. If still short, fill from whatever is left (no duplicates)
  if (selected.length < count) {
    for (const r of ranked) {
      if (selected.length >= count) break
      if (!usedIds.has(r.place.id)) {
        selected.push(r)
        usedIds.add(r.place.id)
      }
    }
  }

  return selected
}

/**
 * Ensure no duplicate place IDs in a result set.
 */
function deduplicateResults(results: ScoredCandidate[]): ScoredCandidate[] {
  const seen = new Set<string>()
  return results.filter((r) => {
    if (seen.has(r.place.id)) return false
    seen.add(r.place.id)
    return true
  })
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function weightedRandomPick(items: ScoredCandidate[], count: number): ScoredCandidate[] {
  if (items.length <= count) return items.slice()

  const pool = items.slice(0, Math.min(items.length, count * 3))
  const picked: ScoredCandidate[] = []
  const used = new Set<number>()

  for (let i = 0; i < count && used.size < pool.length; i++) {
    const totalWeight = pool.reduce((s, r, idx) => used.has(idx) ? s : s + Math.max(r.totalScore, 0.1), 0)
    let rand = Math.random() * totalWeight
    for (let j = 0; j < pool.length; j++) {
      if (used.has(j)) continue
      rand -= Math.max(pool[j].totalScore, 0.1)
      if (rand <= 0) {
        picked.push(pool[j])
        used.add(j)
        break
      }
    }
  }

  return picked
}
