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

  const nowTagsWeight = weights.now_tags ?? 0.20
  const totalScore =
    weights.proximity     * proximityScore +
    weights.moment        * momentScore +
    weights.time          * timeScore +
    weights.weather       * weatherScore +
    weights.base_quality  * baseQualityScore +
    weights.commercial    * commercialScore +
    nowTagsWeight         * nowTagsScore

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
 *   - Max 1 sponsored candidate in the top 3
 *   - Weighted random selection from the top candidates for variety
 *   - Hard gate: momentScore > 0 (no place passes without valid moment)
 */
export function rankNowCandidates(
  candidates: NowScoredPlace[],
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  paidPlaceIds: Set<string>,
  excludeIds: Set<string>,
  weights: NowWeights = DEFAULT_WEIGHTS,
): NowScoreResult[] {
  const scored = candidates
    .filter((p) => !excludeIds.has(p.id))
    .map((place) => scoreNowPlace(place, timeOfDay, weather, paidPlaceIds, weights))
    .filter((r) => r.momentScore > 0 && r.bestMoment !== null)
    .sort((a, b) => b.totalScore - a.totalScore)

  if (scored.length === 0) return []

  // Select top 3 with weighted random + max 1 sponsored
  return selectTop3WithSponsoredCap(scored)
}

/**
 * Top-3 weighted random selection.
 * Process:
 *   1. Separate sponsored vs organic candidates
 *   2. Pick at most 1 sponsored from top sponsored candidates
 *   3. Fill remaining slots from organic pool via weighted random
 *   4. Shuffle the final 3 using weighted randomness based on score
 */
function selectTop3WithSponsoredCap(sorted: NowScoreResult[]): NowScoreResult[] {
  const TARGET = 3
  const sponsored = sorted.filter((r) => r.isSponsored)
  const organic = sorted.filter((r) => !r.isSponsored)
  const selected: NowScoreResult[] = []

  // At most 1 sponsored — pick the top one if available
  if (sponsored.length > 0) {
    selected.push(sponsored[0])
  }

  // Fill remaining from organic via weighted random
  const remaining = TARGET - selected.length
  const organicPicked = weightedRandomPick(organic, remaining)
  selected.push(...organicPicked)

  // If still short (not enough organic), fill from whatever is left
  if (selected.length < TARGET) {
    const selectedIds = new Set(selected.map((r) => r.place.id))
    const extras = sorted.filter((r) => !selectedIds.has(r.place.id))
    for (const r of extras) {
      if (selected.length >= TARGET) break
      selected.push(r)
    }
  }

  // Final shuffle by weighted random so the #1 slot varies
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
