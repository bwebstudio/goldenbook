// ─── Place Ranking V2 ─────────────────────────────────────────────────────────
//
// Modular 4-component ranking model:
//   finalScore = baseScore
//              + onboardingScore * weights.onboarding
//              + businessScore   * weights.business
//              + qualityScore    * weights.quality
//
// Surface-aware: each surface applies different multipliers per component.
// Backward-compatible: all business/quality fields are optional.
//
// Consumers can import from this module instead of onboarding.scoring.ts.
// The original onboarding.scoring.ts is kept intact for its internal helpers.

import {
  type OnboardingProfile,
  hasProfile,
  scoreTextForOnboarding,
  scoreCategoriesForOnboarding,
} from '../onboarding/onboarding.scoring'

// Re-export for callers that previously imported from onboarding.scoring
export type { OnboardingProfile }
export {
  hasProfile,
  scoreTextForOnboarding,
  scoreCategoriesForOnboarding,
} from '../onboarding/onboarding.scoring'
export {
  parseInterests,
  scoreIntentForProfile,
  rerankByOnboarding,
} from '../onboarding/onboarding.scoring'

// ─── Surface types ────────────────────────────────────────────────────────────

export type RankingSurface = 'discover' | 'concierge' | 'golden_picks' | 'now' | 'route'

// ─── Field interfaces (all optional for backward compat) ──────────────────────

/** Business promotion signals — populated from places/promotions tables */
export interface BusinessFields {
  featured?: boolean
  trending?: boolean
  /** Merchant subscription tier — higher tiers get a soft visibility boost */
  subscription_tier?: 'free' | 'basic' | 'premium' | null
  is_sponsored?: boolean
  sponsored_from?: Date | string | null
  sponsored_until?: Date | string | null
}

/** Content quality signals — populated from places/media tables */
export interface QualityFields {
  popularity_score?: number | null
  hero_bucket?: string | null
  hero_path?: string | null
  /** Normalised editorial quality score, 0–100 */
  editorial_score?: number | null
  is_curated?: boolean
  rating_avg?: number | null
  rating_count?: number | null
  created_at?: Date | string | null
}

// ─── Surface weight table ─────────────────────────────────────────────────────

interface SurfaceWeights {
  onboarding: number
  business:   number
  quality:    number
}

const SURFACE_WEIGHTS: Record<RankingSurface, SurfaceWeights> = {
  //               onboarding  business  quality
  discover:      { onboarding: 1.0, business: 0.8, quality: 1.0 },
  concierge:     { onboarding: 1.5, business: 0.6, quality: 0.8 },
  golden_picks:  { onboarding: 0.5, business: 1.0, quality: 1.2 },
  now:           { onboarding: 1.2, business: 0.7, quality: 0.6 },
  route:         { onboarding: 0.8, business: 0.5, quality: 1.0 },
}

// ─── Component scorers ────────────────────────────────────────────────────────

/**
 * Onboarding personalization score.
 * Uses text content when available, category slugs otherwise.
 * Takes the higher signal to avoid double-counting.
 */
export function scoreOnboarding(
  textContent: string,
  categorySlugs: string[] | undefined,
  profile?: OnboardingProfile,
): number {
  if (!hasProfile(profile)) return 0
  const textScore = textContent ? scoreTextForOnboarding(textContent, profile!) : 0
  const catScore  = categorySlugs?.length ? scoreCategoriesForOnboarding(categorySlugs, profile!) : 0
  return Math.max(textScore, catScore)
}

/**
 * Business promotion score.
 * featured / trending / subscription tier / active sponsored window.
 */
export function scoreBusiness(place: BusinessFields): number {
  let score = 0

  if (place.featured)           score += 10
  if (place.trending)           score += 6

  if      (place.subscription_tier === 'premium') score += 4
  else if (place.subscription_tier === 'basic')   score += 2

  if (place.is_sponsored) {
    const now   = Date.now()
    const from  = place.sponsored_from  ? new Date(place.sponsored_from).getTime()  : -Infinity
    const until = place.sponsored_until ? new Date(place.sponsored_until).getTime() : Infinity
    if (now >= from && now <= until) score += 8
  }

  return score
}

/**
 * Content quality score.
 * image presence, popularity, editorial quality, curation, ratings, recency.
 */
export function scoreQuality(place: QualityFields): number {
  let score = 0

  // Image presence
  if (place.hero_bucket && place.hero_path) {
    score += 4
  } else {
    score -= 8
  }

  // Popularity
  const pop = place.popularity_score ?? 0
  if      (pop >= 80) score += 5
  else if (pop >= 60) score += 3
  else if (pop >= 40) score += 1

  // Curation & editorial
  if (place.is_curated)               score += 5
  if (place.editorial_score != null)  score += place.editorial_score * 0.1

  // Ratings
  const rating = place.rating_avg ?? 0
  if      (rating >= 4.5) score += 4
  else if (rating >= 4.0) score += 2
  else if (rating >= 3.5) score += 1

  // Recency
  if (place.created_at) {
    const daysSince = (Date.now() - new Date(place.created_at).getTime()) / 86_400_000
    if (daysSince <= 90) score += 3
  }

  return score
}

// ─── Rankable place shape ─────────────────────────────────────────────────────

export type RankablePlace = BusinessFields &
  QualityFields & {
    short_description?: string | null
    editorial_summary?: string | null
    category_slugs?: string[]
  }

// ─── Final scorer ─────────────────────────────────────────────────────────────

/**
 * Compute the total ranking score for a place.
 *
 * @param baseScore  Surface-specific base (e.g. intent match for concierge,
 *                   time-segment match for now). Pass 0 when not applicable.
 * @param place      Partial place shape — missing fields score 0.
 * @param surface    Determines component multipliers.
 * @param profile    User onboarding profile — safe to omit (no-op when absent).
 */
export function scoreFinalPlace(
  baseScore: number,
  place: RankablePlace,
  surface: RankingSurface,
  profile?: OnboardingProfile,
): number {
  const w = SURFACE_WEIGHTS[surface]

  const textContent = [place.short_description, place.editorial_summary]
    .filter(Boolean)
    .join(' ')

  return (
    baseScore +
    scoreOnboarding(textContent, place.category_slugs, profile) * w.onboarding +
    scoreBusiness(place)                                          * w.business  +
    scoreQuality(place)                                           * w.quality
  )
}

// ─── Re-rank helper ───────────────────────────────────────────────────────────

/**
 * Stable-sort a list of places by final ranking score (descending).
 * Passes baseScore = 0, so surface-specific base is not applied here —
 * suitable for lists where editorial position is already implicit in DB order.
 */
export function rerankPlaces<T extends RankablePlace>(
  places: T[],
  surface: RankingSurface,
  profile?: OnboardingProfile,
): T[] {
  return [...places].sort(
    (a, b) =>
      scoreFinalPlace(0, b, surface, profile) -
      scoreFinalPlace(0, a, surface, profile),
  )
}
