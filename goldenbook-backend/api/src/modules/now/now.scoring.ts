// @ts-nocheck
// ─── DEPRECATED: Replaced by ../shared-scoring/scoring-engine.ts ────────────
// ─── NOW Contextual Scoring Engine ──────────────────────────────────────────
//
// NOW is a contextual promotion surface. It must always return a
// recommendation, even without user location.
//
// Final ranking formula:
//   final_score = base_quality_score + context_score + sponsored_boost
//
// base_quality_score = save_score + image_quality_score + freshness_score
//   (NO manual editorial boosts, NO ratings, NO manual curation flags)
//
// context_score depends on: time of day, context tags, destination, user intent
//
// Selection: top-3 weighted random, max 1 sponsored per window.

import {
  type MomentTag,
  type NowTimeOfDay,
  type WeatherCondition,
  filterMomentsForTime,
  getTimeMomentWeight,
  getWeatherMomentBoost,
} from './now.moments'
import type { NowScoredPlace } from './now.query'
import { type NowWeights, DEFAULT_WEIGHTS } from './now.weights'

// ─── Base quality score ─────────────────────────────────────────────────────
// Replaces editorial_score. Auto-computed from objective signals only.

function scoreBaseQuality(place: NowScoredPlace): number {
  let score = 0

  // Save score: based on favorites/bookmarks count (from place_stats)
  const saves = (place.popularity_score ?? 0)
  if      (saves >= 80) score += 35
  else if (saves >= 60) score += 25
  else if (saves >= 40) score += 15
  else if (saves >= 20) score += 8
  else                  score += 3

  // Image quality score: presence and completeness of hero image
  if (place.hero_bucket && place.hero_path) {
    score += 30
  } else {
    score += 0 // no penalty, just no boost
  }

  // Freshness score: slight boost for recently added places
  if (place.created_at) {
    const daysSince = (Date.now() - new Date(place.created_at).getTime()) / 86_400_000
    if      (daysSince <= 30)  score += 20
    else if (daysSince <= 90)  score += 12
    else if (daysSince <= 180) score += 5
  }

  return Math.min(score, 100)
}

// ─── Proximity scoring ──────────────────────────────────────────────────────

function scoreProximity(distanceMeters: number | null): number {
  if (distanceMeters == null) return 30
  if (distanceMeters <= 500) return 100
  if (distanceMeters >= 5000) return 0
  return Math.round(100 * (1 - (distanceMeters - 500) / 4500))
}

// ─── Moment scoring ──────────────────────────────────────────────────────────

function scoreMomentMatch(
  placeType: string,
  timeOfDay: NowTimeOfDay,
  weather?: WeatherCondition,
): { score: number; bestMoment: MomentTag | null } {
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

function scoreNowTags(place: NowScoredPlace): number {
  if (!place.now_enabled) return 0

  let score = 50

  score += Math.min(place.now_priority, 10) * 3

  if (place.now_featured) score += 20

  if (!place.now_time_window_match) {
    score *= 0.5
  }

  score *= Math.min(place.now_tag_max_weight, 2.0)

  return Math.round(Math.min(score, 100))
}

// ─── Commercial scoring ──────────────────────────────────────────────────────

function scoreCommercial(isPaid: boolean): number {
  if (!isPaid) return 0
  return 70 // flat boost — commercial relevance is gated by context, not distance
}

// ─── Score breakdown ────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  proximity:     { raw: number; weighted: number }
  moment:        { raw: number; weighted: number }
  time:          { raw: number; weighted: number }
  weather:       { raw: number; weighted: number }
  base_quality:  { raw: number; weighted: number }
  commercial:    { raw: number; weighted: number }
  now_tags:      { raw: number; weighted: number }
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
  baseQualityScore: number
  isSponsored: boolean
  breakdown: ScoreBreakdown
}

// ─── Defensive time-of-day safety penalty ────────────────────────────────────
//
// Reinforces the hard time-window filter from rankNowCandidates with a tag-
// level safeguard: a place tagged dinner / fine-dining should never appear in
// morning / midday / afternoon results, even if its editorial windows are
// imperfect or its now_time_window_match leaks through.
//
// Applied as a post-score subtraction so it composes with the existing
// proximity/moment/time/etc. signals without touching their weights.

const DAYTIME_WINDOWS = new Set<NowTimeOfDay>(['morning', 'midday', 'afternoon'])
const DINNER_ONLY_TAGS = new Set(['dinner', 'fine-dining'])

function dinnerSafetyPenalty(place: NowScoredPlace, timeOfDay: NowTimeOfDay): number {
  if (!DAYTIME_WINDOWS.has(timeOfDay)) return 0
  const tags = place.context_tag_slugs ?? []
  if (tags.length === 0) return 0
  const isDinnerOnly = tags.some((t) => DINNER_ONLY_TAGS.has(t))
  if (!isDinnerOnly) return 0
  // If the place ALSO has a daytime tag (lunch / brunch), it's a dual-shift
  // venue and should not be penalised.
  const hasDaytimeTag = tags.some((t) => t === 'lunch' || t === 'brunch' || t === 'coffee')
  if (hasDaytimeTag) return 0
  return -50
}

export function scoreNowPlace(
  place: NowScoredPlace,
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  paidPlaceIds: Set<string>,
  weights: NowWeights = DEFAULT_WEIGHTS,
): NowScoreResult {
  const proximityScore = scoreProximity(place.distance_meters)
  const { score: momentScore, bestMoment } = scoreMomentMatch(place.place_type, timeOfDay, weather)
  const timeScore = getTimeMomentWeight(timeOfDay, bestMoment ?? 'coffee_break') * 100
  const weatherScore = weather && bestMoment ? getWeatherMomentBoost(weather, bestMoment) * 100 : 0
  const baseQualityScore = scoreBaseQuality(place)
  const isSponsored = paidPlaceIds.has(place.id)
  const commercialScore = scoreCommercial(isSponsored)
  const nowTagsScore = scoreNowTags(place)
  // Defensive layer: dinner/fine-dining at daytime → -50 (see above)
  const timeAdjustment = dinnerSafetyPenalty(place, timeOfDay)

  const nowTagsWeight = weights.now_tags ?? 0.20
  const totalScore =
    weights.proximity     * proximityScore +
    weights.moment        * momentScore +
    weights.time          * timeScore +
    weights.weather       * weatherScore +
    weights.base_quality  * baseQualityScore +
    weights.commercial    * commercialScore +
    nowTagsWeight         * nowTagsScore +
    timeAdjustment

  const breakdown: ScoreBreakdown = {
    proximity:    { raw: proximityScore,    weighted: Math.round(weights.proximity * proximityScore * 100) / 100 },
    moment:       { raw: momentScore,       weighted: Math.round(weights.moment * momentScore * 100) / 100 },
    time:         { raw: Math.round(timeScore), weighted: Math.round(weights.time * timeScore * 100) / 100 },
    weather:      { raw: Math.round(weatherScore), weighted: Math.round(weights.weather * weatherScore * 100) / 100 },
    base_quality: { raw: baseQualityScore,  weighted: Math.round(weights.base_quality * baseQualityScore * 100) / 100 },
    commercial:   { raw: commercialScore,   weighted: Math.round(weights.commercial * commercialScore * 100) / 100 },
    now_tags:     { raw: nowTagsScore,      weighted: Math.round(nowTagsWeight * nowTagsScore * 100) / 100 },
  }

  return {
    place,
    totalScore,
    bestMoment,
    proximityScore,
    momentScore,
    commercialScore,
    nowTagsScore,
    baseQualityScore,
    isSponsored,
    breakdown,
  }
}

/**
 * Score, rank, and select top-3 candidates with weighted random selection.
 *
 * Rules:
 *   - HARD time-window filter: places whose editorial windows don't include
 *     the current time are excluded entirely (not just downranked). Places
 *     with no editorial windows assigned fall through (now_time_window_match
 *     defaults to `true` in the SQL).
 *   - Max 1 sponsored candidate in the top 3
 *   - Diversity quotas per time-of-day (max restaurants/bars, required scenic)
 *   - Editorial fallback when all top results are gastronomic — swap one for
 *     a scenic/culture pick.
 *   - Weighted random selection within the candidate window for variety
 *   - Hard gate: momentScore > 0 (no place passes without valid moment)
 */
/** Hard cap on the scoring pool. Above this size we trim by popularity_score
 *  to avoid wasting CPU on long-tail candidates that won't make the top 3. */
const MAX_SCORING_POOL = 150

export function rankNowCandidates(
  candidates: NowScoredPlace[],
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  paidPlaceIds: Set<string>,
  excludeIds: Set<string>,
  weights: NowWeights = DEFAULT_WEIGHTS,
): NowScoreResult[] {
  // Hard filters first (cheap)
  const filtered = candidates
    .filter((p) => !excludeIds.has(p.id))
    // HARD time-window filter — see now_time_window_match SQL fallback
    .filter((p) => p.now_time_window_match !== false)

  // Performance cap: if the post-filter pool is huge, keep the top 150 by
  // popularity_score (NULLS treated as 0) before running full scoring. This
  // bounds work without changing ranking quality — long-tail candidates
  // wouldn't have made the top 3 anyway.
  const pool =
    filtered.length > MAX_SCORING_POOL
      ? [...filtered]
          .sort((a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0))
          .slice(0, MAX_SCORING_POOL)
      : filtered

  const scored = pool
    .map((place) => scoreNowPlace(place, timeOfDay, weather, paidPlaceIds, weights))
    .filter((r) => r.momentScore > 0 && r.bestMoment !== null)
    .sort((a, b) => b.totalScore - a.totalScore)

  if (scored.length === 0) return []

  // Select top 3 with sponsored cap + diversity quotas + editorial fallback
  return selectTop3WithSponsoredCap(scored, timeOfDay)
}

// ─── Diversity quotas per time-of-day ────────────────────────────────────────

interface DiversityLimits {
  /** Max places with place_type = 'restaurant' allowed in the top 3 */
  maxRestaurants: number
  /** Max places with place_type = 'bar' allowed in the top 3 */
  maxBars: number
  /** Top 3 must include at least one place tagged scenic/culture/nature */
  requireScenic: boolean
  /** Top 3 must include at least one place tagged drinks OR scenic */
  requireDrinksOrScenic: boolean
  /** Prefer bars/viewpoints in late_evening/deep_night */
  preferBarsAndViewpoints: boolean
}

const SCENIC_TAGS = new Set(['viewpoint', 'nature', 'sunset', 'culture', 'rooftop'])
const DRINKS_OR_SCENIC_TAGS = new Set([
  'cocktails', 'wine', 'rooftop', 'viewpoint', 'sunset', 'nature',
])

function getDiversityLimits(timeOfDay: NowTimeOfDay): DiversityLimits {
  switch (timeOfDay) {
    case 'morning':
      return { maxRestaurants: 1, maxBars: 0, requireScenic: false, requireDrinksOrScenic: false, preferBarsAndViewpoints: false }
    case 'midday':
      return { maxRestaurants: 2, maxBars: 0, requireScenic: false, requireDrinksOrScenic: false, preferBarsAndViewpoints: false }
    case 'afternoon':
      return { maxRestaurants: 1, maxBars: 1, requireScenic: true,  requireDrinksOrScenic: false, preferBarsAndViewpoints: false }
    case 'evening':
      return { maxRestaurants: 2, maxBars: 2, requireScenic: false, requireDrinksOrScenic: true,  preferBarsAndViewpoints: false }
    case 'late_evening':
    case 'night':
    case 'deep_night':
      return { maxRestaurants: 1, maxBars: 3, requireScenic: false, requireDrinksOrScenic: true,  preferBarsAndViewpoints: true }
  }
}

function isScenic(r: NowScoreResult): boolean {
  const tags = r.place.context_tag_slugs ?? []
  return tags.some((t) => SCENIC_TAGS.has(t))
}

function isDrinksOrScenic(r: NowScoreResult): boolean {
  const tags = r.place.context_tag_slugs ?? []
  return tags.some((t) => DRINKS_OR_SCENIC_TAGS.has(t))
}

function isGastronomic(r: NowScoreResult): boolean {
  return r.place.place_type === 'restaurant' || r.place.place_type === 'bar' || r.place.place_type === 'cafe'
}

/**
 * Top-3 selection with sponsored cap, diversity quotas, and editorial fallback.
 * Process:
 *   1. Separate sponsored vs organic candidates
 *   2. Pick at most 1 sponsored from top sponsored candidates (respecting quotas)
 *   3. Fill remaining slots from organic pool via weighted random + quotas
 *   4. Editorial fallback: if all 3 are gastronomic OR a required scenic/drinks
 *      slot is missing, swap the weakest pick for the highest-ranked candidate
 *      that fills the gap
 *   5. Shuffle the final 3 using weighted randomness based on score
 */
function selectTop3WithSponsoredCap(
  sorted: NowScoreResult[],
  timeOfDay: NowTimeOfDay,
): NowScoreResult[] {
  const TARGET = 3
  const limits = getDiversityLimits(timeOfDay)

  const sponsored = sorted.filter((r) => r.isSponsored)
  const organic = sorted.filter((r) => !r.isSponsored)
  const selected: NowScoreResult[] = []
  const counts = { restaurant: 0, bar: 0 }

  const canAdd = (r: NowScoreResult): boolean => {
    if (r.place.place_type === 'restaurant' && counts.restaurant >= limits.maxRestaurants) return false
    if (r.place.place_type === 'bar' && counts.bar >= limits.maxBars) return false
    return true
  }
  const accept = (r: NowScoreResult) => {
    selected.push(r)
    if (r.place.place_type === 'restaurant') counts.restaurant++
    if (r.place.place_type === 'bar') counts.bar++
  }

  // 1. At most 1 sponsored — top one that fits the quotas
  for (const s of sponsored) {
    if (canAdd(s)) { accept(s); break }
  }

  // 2. Fill remaining slots from organic via weighted random within quotas
  const remaining = TARGET - selected.length
  if (remaining > 0) {
    const eligibleOrganic = organic.filter(canAdd)
    const organicPicked = weightedRandomPick(eligibleOrganic, remaining)
    for (const r of organicPicked) {
      if (selected.length >= TARGET) break
      if (canAdd(r)) accept(r)
    }
  }

  // 3. Top-up with anyone left if quotas were so tight we ran short
  if (selected.length < TARGET) {
    const selectedIds = new Set(selected.map((r) => r.place.id))
    for (const r of sorted) {
      if (selected.length >= TARGET) break
      if (selectedIds.has(r.place.id)) continue
      // ignore quotas in the topup pass — better to surface 3 than to return 1
      selected.push(r)
      if (r.place.place_type === 'restaurant') counts.restaurant++
      if (r.place.place_type === 'bar') counts.bar++
    }
  }

  // 4. Editorial fallback — apply gap-filling swaps
  return finalizeWithEditorialFallback(selected, sorted, limits)
}

/**
 * Apply editorial fallback rules in order:
 *   a) If `requireScenic` and the picks contain no scenic place, swap the
 *      weakest non-scenic pick for the highest-ranked scenic candidate.
 *   b) If `requireDrinksOrScenic` and the picks contain no drinks/scenic
 *      place, swap the weakest non-matching pick for the best matching one.
 *   c) If all picks are gastronomic, force-insert one scenic place — even
 *      when not strictly required by the time-of-day rules. This is the
 *      "never recommend 3 restaurants in a row" guarantee.
 */
function finalizeWithEditorialFallback(
  selected: NowScoreResult[],
  sorted: NowScoreResult[],
  limits: DiversityLimits,
): NowScoreResult[] {
  const trySwap = (
    predicate: (r: NowScoreResult) => boolean,
    avoidPredicate: (r: NowScoreResult) => boolean,
  ): void => {
    if (selected.some(predicate)) return
    const candidate = sorted.find(
      (r) => predicate(r) && !selected.some((s) => s.place.id === r.place.id),
    )
    if (!candidate) return
    // Find the weakest pick that does NOT match avoidPredicate (i.e. is "safe to remove")
    let weakestIdx = -1
    let weakestScore = Infinity
    for (let i = 0; i < selected.length; i++) {
      const r = selected[i]
      if (avoidPredicate(r)) continue
      // Don't drop the only sponsored pick
      if (r.isSponsored) continue
      if (r.totalScore < weakestScore) {
        weakestScore = r.totalScore
        weakestIdx = i
      }
    }
    if (weakestIdx >= 0) selected[weakestIdx] = candidate
  }

  // (a) Required scenic
  if (limits.requireScenic) {
    trySwap(isScenic, isScenic)
  }
  // (b) Required drinks-or-scenic
  if (limits.requireDrinksOrScenic) {
    trySwap(isDrinksOrScenic, isDrinksOrScenic)
  }
  // (c) Universal "no all-gastronomic top-3" guard
  if (selected.length > 0 && selected.every(isGastronomic)) {
    trySwap(isScenic, isScenic)
  }

  return weightedShuffle(selected)
}

/**
 * Pick `count` items from a sorted list using weighted random selection.
 * Higher-scored items are more likely to be picked but not guaranteed.
 */
function weightedRandomPick(items: NowScoreResult[], count: number): NowScoreResult[] {
  if (items.length <= count) return items.slice()

  const pool = items.slice(0, Math.min(items.length, count * 3)) // candidate window
  const picked: NowScoreResult[] = []
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

/** Shuffle a small array by weighted randomness (Fisher-Yates with score bias). */
function weightedShuffle(items: NowScoreResult[]): NowScoreResult[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    // Bias toward keeping higher-scored items earlier
    const weights = arr.slice(0, i + 1).map((r) => Math.max(r.totalScore, 0.1))
    const total = weights.reduce((s, w) => s + w, 0)
    let rand = Math.random() * total
    let j = 0
    for (; j < i; j++) {
      rand -= weights[j]
      if (rand <= 0) break
    }
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
