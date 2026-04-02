// ─── NOW Contextual Scoring Engine ──────────────────────────────────────────
//
// NOW is a HYBRID editorial-commercial surface. It must always return a
// recommendation, even without user location.
//
// Ranking priority:
//   1. Dashboard-configured tags / editorial intent (now_tags weight)
//   2. Active destination / selected city (implicit via query filter)
//   3. Time-of-day context (moment + time weights)
//   4. Seasonal / temporal context (weather weight)
//   5. Optional location boost (proximity weight — 0.10 default, was 0.30)
//   6. Commercial priority (commercial weight)
//   7. Editorial quality (editorial weight)
//
// Location is an OPTIONAL BOOST, not a requirement.
// NOW must never disappear because location is missing.

import {
  type MomentTag,
  type NowTimeOfDay,
  type WeatherCondition,
  filterMomentsForTime,
  getTimeMomentWeight,
  getWeatherMomentBoost,
} from './now.moments'
import {
  type OnboardingProfile,
  scoreFinalPlace,
} from '../../shared/ranking/place.ranking'
import type { NowScoredPlace } from './now.query'
import { type NowWeights, DEFAULT_WEIGHTS } from './now.weights'

// ─── Proximity scoring ──────────────────────────────────────────────────────

/**
 * Proximity score: 0 → 100.
 * Within 500m = 100, linear decay to 0 at 5km.
 * No location = neutral score (30) — proximity is an optional boost.
 */
function scoreProximity(distanceMeters: number | null): number {
  if (distanceMeters == null) return 30 // no location = neutral score
  if (distanceMeters <= 500) return 100
  if (distanceMeters >= 5000) return 0
  return Math.round(100 * (1 - (distanceMeters - 500) / 4500))
}

// ─── Moment scoring ──────────────────────────────────────────────────────────

/**
 * Moment match score: 0 → 100.
 * How well the place's moment tags match the current time + weather context.
 *
 * HARD GATE: Only moments allowed for the current time window are considered.
 * This prevents absurd results like "dinner at 15:00".
 */
function scoreMomentMatch(
  placeType: string,
  timeOfDay: NowTimeOfDay,
  weather?: WeatherCondition,
): { score: number; bestMoment: MomentTag | null } {
  // Hard gate: only consider moments valid for this time window
  const { allowed } = filterMomentsForTime(placeType, timeOfDay)
  if (allowed.length === 0) return { score: 0, bestMoment: null }

  let bestScore = 0
  let bestMoment: MomentTag | null = null

  for (const moment of allowed) {
    const timeWeight = getTimeMomentWeight(timeOfDay, moment)
    const weatherBoost = weather ? getWeatherMomentBoost(weather, moment) : 0
    const combined = timeWeight + weatherBoost

    if (combined > bestScore) {
      bestScore = combined
      bestMoment = moment
    }
  }

  return {
    score: Math.round(Math.min(bestScore / 1.6, 1) * 100),
    bestMoment,
  }
}

// ─── NOW tags scoring ────────────────────────────────────────────────────────

/**
 * Score based on dashboard-configured NOW context tags.
 * Places with now_enabled + matching tags + time window get a significant boost.
 *
 * Scoring factors:
 * - now_enabled: base eligibility (50 points)
 * - now_priority: 0-10 mapped to 0-30 points
 * - now_featured: +20 points
 * - now_time_window_match: ×1.0 if matching, ×0.5 if not
 * - now_tag_max_weight: multiplier from tag weight (1.0-2.0)
 */
function scoreNowTags(place: NowScoredPlace): number {
  if (!place.now_enabled) return 0

  let score = 50 // base for being NOW-enabled

  // Priority: 0-10 → 0-30 points
  score += Math.min(place.now_priority, 10) * 3

  // Featured boost
  if (place.now_featured) score += 20

  // Time window match multiplier
  if (!place.now_time_window_match) {
    score *= 0.5
  }

  // Tag weight multiplier (1.0 = normal, 2.0 = strong match)
  score *= Math.min(place.now_tag_max_weight, 2.0)

  return Math.round(Math.min(score, 100))
}

// ─── Commercial scoring ──────────────────────────────────────────────────────

function scoreCommercial(isPaid: boolean, distanceMeters: number | null): number {
  if (!isPaid) return 0
  // Commercial boost is independent of distance — NOW is not proximity-first
  if (distanceMeters == null) return 70
  if (distanceMeters <= 1500) return 100
  if (distanceMeters >= 3000) return 50
  return Math.round(100 * (1 - (distanceMeters - 1500) / 3000))
}

// ─── Score breakdown (for debug mode) ────────────────────────────────────────

export interface ScoreBreakdown {
  proximity:  { raw: number; weighted: number }
  moment:     { raw: number; weighted: number }
  time:       { raw: number; weighted: number }
  weather:    { raw: number; weighted: number }
  editorial:  { raw: number; weighted: number }
  commercial: { raw: number; weighted: number }
  now_tags:   { raw: number; weighted: number }
}

// ─── Main scoring function ───────────────────────────────────────────────────

export interface NowScoreResult {
  place: NowScoredPlace
  totalScore: number
  bestMoment: MomentTag | null
  proximityScore: number
  momentScore: number
  commercialScore: number
  nowTagsScore: number
  /** Full breakdown — populated for all results, cheap to compute */
  breakdown: ScoreBreakdown
}

/**
 * Score a single place for the NOW recommendation.
 *
 * @param weights - Resolved weights (from DB/experiment/segment). Defaults to hardcoded.
 */
export function scoreNowPlace(
  place: NowScoredPlace,
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  profile: OnboardingProfile | undefined,
  paidPlaceIds: Set<string>,
  weights: NowWeights = DEFAULT_WEIGHTS,
): NowScoreResult {
  // 1. Proximity (optional boost)
  const proximityScore = scoreProximity(place.distance_meters)

  // 2. Moment + time + weather
  const { score: momentScore, bestMoment } = scoreMomentMatch(
    place.place_type, timeOfDay, weather,
  )

  // 3. Time match
  const timeScore = getTimeMomentWeight(timeOfDay, bestMoment ?? 'coffee_break') * 100

  // 4. Weather match
  const weatherScore = weather && bestMoment
    ? getWeatherMomentBoost(weather, bestMoment) * 100
    : 0

  // 5. Editorial/quality/onboarding via existing ranking system
  const rawEditorial = scoreFinalPlace(0, place, 'now', profile)
  const editorialScore = Math.min(rawEditorial * 2, 100)

  // 6. Commercial
  const isPaid = paidPlaceIds.has(place.id)
  const commercialScore = scoreCommercial(isPaid, place.distance_meters)

  // 7. NOW tags (dashboard-configured editorial intent)
  const nowTagsScore = scoreNowTags(place)

  // ── Weighted total ──
  const nowTagsWeight = (weights as any).now_tags ?? 0.20
  const totalScore =
    weights.proximity   * proximityScore +
    weights.moment      * momentScore +
    weights.time        * timeScore +
    weights.weather     * weatherScore +
    weights.editorial   * editorialScore +
    // user weight is folded into editorial via scoreFinalPlace
    weights.commercial  * commercialScore +
    nowTagsWeight       * nowTagsScore

  const breakdown: ScoreBreakdown = {
    proximity:  { raw: proximityScore,  weighted: Math.round(weights.proximity * proximityScore * 100) / 100 },
    moment:     { raw: momentScore,     weighted: Math.round(weights.moment * momentScore * 100) / 100 },
    time:       { raw: Math.round(timeScore), weighted: Math.round(weights.time * timeScore * 100) / 100 },
    weather:    { raw: Math.round(weatherScore), weighted: Math.round(weights.weather * weatherScore * 100) / 100 },
    editorial:  { raw: Math.round(editorialScore), weighted: Math.round(weights.editorial * editorialScore * 100) / 100 },
    commercial: { raw: commercialScore, weighted: Math.round(weights.commercial * commercialScore * 100) / 100 },
    now_tags:   { raw: nowTagsScore,    weighted: Math.round(nowTagsWeight * nowTagsScore * 100) / 100 },
  }

  return {
    place,
    totalScore,
    bestMoment,
    proximityScore,
    momentScore,
    commercialScore,
    nowTagsScore,
    breakdown,
  }
}

/**
 * Score and rank all candidates. Returns sorted by totalScore descending.
 */
export function rankNowCandidates(
  candidates: NowScoredPlace[],
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  profile: OnboardingProfile | undefined,
  paidPlaceIds: Set<string>,
  excludeIds: Set<string>,
  weights: NowWeights = DEFAULT_WEIGHTS,
): NowScoreResult[] {
  return candidates
    .filter((p) => !excludeIds.has(p.id))
    .map((place) => scoreNowPlace(place, timeOfDay, weather, profile, paidPlaceIds, weights))
    // Hard requirement: must have a valid moment for this time window.
    // No place passes on proximity alone — that caused "dinner at 15:00".
    .filter((r) => r.momentScore > 0 && r.bestMoment !== null)
    .sort((a, b) => b.totalScore - a.totalScore)
}
