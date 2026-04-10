// ─── Unified Scoring Engine ──────────────────────────────────────────────────
//
// Single scoring pipeline shared by NOW and Concierge.
//
// ── Pipeline (strict order) ────────────────────────────────────────────────
//
// STEP 0 — Hard eligibility filters (before ANY scoring):
//   - Excluded IDs (session, cooldown)
//   - Time-of-day hard exclusions (type × time window matrix)
//   - Shopping curfew (22:00–08:00 — NEVER)
//   - Dinner-only restaurants in afternoon → excluded unless they have lunch/terrace/coffee
//   - Bars in morning → excluded
//   - Paid placements: still excluded if the place is truly absurd for the time
//     (closed restaurant at 04:00) — commercial contract doesn't override physics
//
// STEP 1 — Base Score (computed in scoreCandidate):
//
//   baseScore =
//     w.commercial × commercialScore
//   + w.context    × contextScore
//   + w.editorial  × editorialScore
//   + w.quality    × qualityScore
//   + w.proximity  × proximityScore
//   + 0.12         × personalization
//
// STEP 2 — Time-of-day adjustments (additive boosts/penalties)
//
// STEP 3 — Adjustments (applied by route handler after scoreCandidate):
//   intentMatch, refinement, antiRepetition, heroHistory, frequencyCap
//
// STEP 4 — Diversity (applied LAST by applyDiversityRules):
//   category/tag penalties, plateau rotation, paid exemptions
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
import type { NowTimeOfDay } from './types'
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

// ═══════════════════════════════════════════════════════════════════════════
// STEP 0: HARD ELIGIBILITY FILTERS
// ═══════════════════════════════════════════════════════════════════════════
//
// These rules REMOVE candidates from the pool BEFORE scoring.
// A filtered candidate NEVER enters ranking, regardless of score.
//
// Eligibility is binary: eligible or not. No grey area.

/**
 * Check if a candidate is eligible for the current time window.
 * Returns false if the place should be EXCLUDED from the candidate pool.
 *
 * Rules are strict and context-aware:
 * - Shopping: excluded 22:00–08:00 (hard curfew)
 * - Museums: excluded 23:00–08:00
 * - Bars: excluded 07:00–11:00 (morning)
 * - Daytime cafes: excluded 02:00–07:00 (unless late-night tag)
 * - Dinner-only restaurants: excluded 15:00–18:00 (afternoon)
 *   unless they also have lunch, terrace, coffee, or quick-stop tags
 */
function isEligibleForTimeWindow(
  place: UnifiedCandidate,
  timeOfDay: NowTimeOfDay,
): boolean {
  const pt = place.place_type
  const tags = place.context_tag_slugs ?? []
  const hasTag = (t: string) => tags.includes(t)

  // ── Untagged restaurants: assume dinner-only ──────────────────────────
  // A restaurant with zero context tags has no editorial signal about when
  // it's appropriate. Default to dinner-only behaviour: block from
  // morning / midday / afternoon to prevent leaking dinner venues into
  // daytime NOW results. (Also blocked from deep_night below.)
  if (pt === 'restaurant' && tags.length === 0) {
    if (
      timeOfDay === 'morning' ||
      timeOfDay === 'midday' ||
      timeOfDay === 'afternoon'
    ) {
      return false
    }
  }

  // ── Shopping curfew: most shops close 19:00–20:00 ─────────────────────
  // Exclude from evening onwards. A few design shops stay open later but
  // the general rule is: no shops after 18:00 for recommendation purposes.
  if (pt === 'shop') {
    if (timeOfDay === 'evening' || timeOfDay === 'late_evening' || timeOfDay === 'deep_night' || timeOfDay === 'night') {
      return false
    }
  }

  // ── Museums: excluded evening onwards (most close 18:00–19:00) ────────
  if (pt === 'museum') {
    if (timeOfDay === 'evening' || timeOfDay === 'late_evening' || timeOfDay === 'deep_night' || timeOfDay === 'night') {
      return false
    }
  }

  // ── Bars: excluded in morning (07:00–11:00) ───────────────────────────
  if (pt === 'bar' && timeOfDay === 'morning') {
    return false
  }

  // ── Cafes: only morning + afternoon ──────────────────────────────────
  // Cafes like Nicolau are daytime places. Exclude from evening onwards
  // unless they have explicit evening-relevant tags (cocktails, wine, late-night).
  if (pt === 'cafe') {
    const hasEveningRelevance = hasTag('cocktails') || hasTag('wine') || hasTag('late-night') || hasTag('dinner')
    if ((timeOfDay === 'evening' || timeOfDay === 'late_evening' || timeOfDay === 'deep_night' || timeOfDay === 'night') && !hasEveningRelevance) {
      return false
    }
  }

  // ── Dinner-only restaurants in afternoon (15:00–18:00) ────────────────
  // If a restaurant ONLY has dinner-related tags and NO daytime tags,
  // it shouldn't appear at 16:00. A dinner restaurant with a terrace
  // or lunch service is fine — it has daytime relevance.
  if (pt === 'restaurant' && timeOfDay === 'afternoon') {
    const hasDinnerTag = hasTag('dinner') || hasTag('fine-dining')
    const hasDaytimeTag = hasTag('lunch') || hasTag('terrace') || hasTag('coffee')
      || hasTag('brunch') || hasTag('quick-stop') || hasTag('wine')
    if (hasDinnerTag && !hasDaytimeTag) {
      return false
    }
  }

  // ── Restaurants without late-night in deep night ──────────────────────
  if (pt === 'restaurant' && timeOfDay === 'deep_night' && !hasTag('late-night')) {
    return false
  }

  // ── Activities without evening relevance: excluded from evening ───────
  // Activities like tours, gardens, boardwalks close by sunset.
  // Only activities tagged late-night or viewpoint survive into evening.
  if (pt === 'activity' && timeOfDay === 'evening') {
    if (!hasTag('late-night') && !hasTag('viewpoint') && !hasTag('live-music')) {
      return false
    }
  }

  // ── Landmarks without viewpoint: excluded from evening ──────────────
  // Most landmarks (churches, palaces, gardens) close by 18:00–19:00.
  // Viewpoints and waterfront spots remain valid for evening/sunset.
  if (pt === 'landmark' && timeOfDay === 'evening') {
    if (!hasTag('viewpoint') && !hasTag('sunset')) {
      return false
    }
  }

  // ── Landmarks/activities in late evening ──────────────────────────────
  // Almost everything is closed. Only viewpoints survive.
  if ((pt === 'landmark' || pt === 'activity') && timeOfDay === 'late_evening') {
    if (!hasTag('viewpoint') && !hasTag('late-night')) {
      return false
    }
  }

  // ── Landmarks/activities/hotels in deep night ─────────────────────────
  if (pt === 'landmark' && timeOfDay === 'deep_night' && !hasTag('viewpoint')) {
    return false
  }
  if (pt === 'activity' && timeOfDay === 'deep_night') {
    return false
  }

  return true
}

// ─── STEP 1: Base Score (single candidate) ──────────────────────────────────

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

  // ── STEP 2: Time-of-day appropriateness boosts + penalties ─────────────
  // These are SOFT adjustments for places that passed eligibility.
  // They fine-tune ranking, not eligibility.
  let timeAdjustment = 0
  const tod = ctx.timeOfDay
  const pt = place.place_type
  const tags = place.context_tag_slugs ?? []
  const hasTag = (t: string) => tags.includes(t)

  if (tod === 'morning') {
    // 08:00–11:00: cafes, bakeries, brunch → boost; everything else neutral
    if (pt === 'cafe')                                   timeAdjustment += 12
    if (hasTag('coffee') || hasTag('brunch'))             timeAdjustment += 10
    if (hasTag('culture'))                                timeAdjustment += 5
    if (hasTag('viewpoint'))                              timeAdjustment += 5
    // Restaurants: only if they have breakfast/brunch/coffee
    if (pt === 'restaurant' && !hasTag('brunch') && !hasTag('coffee') && !hasTag('lunch'))
                                                         timeAdjustment -= 15
  }
  else if (tod === 'midday') {
    // 11:00–15:00: lunch time
    if (hasTag('lunch') || hasTag('brunch'))              timeAdjustment += 10
    if (hasTag('quick-stop'))                             timeAdjustment += 5
    if (pt === 'bar' && !hasTag('lunch') && !hasTag('wine'))
                                                         timeAdjustment -= 20
  }
  else if (tod === 'afternoon') {
    // 15:00–18:00: culture, coffee, shopping, terraces, viewpoints
    if (hasTag('coffee') || hasTag('culture'))            timeAdjustment += 8
    if (hasTag('terrace') || hasTag('viewpoint'))         timeAdjustment += 6
    if (hasTag('shopping'))                               timeAdjustment += 5
    if (hasTag('wellness'))                               timeAdjustment += 5
    if (hasTag('sunset'))                                 timeAdjustment += 4
    // Wine bars are fine in afternoon
    if (pt === 'bar' && hasTag('wine'))                   timeAdjustment += 3
    // Regular bars without wine/terrace: penalize
    if (pt === 'bar' && !hasTag('wine') && !hasTag('terrace'))
                                                         timeAdjustment -= 15
    // Dinner restaurants that passed eligibility (they have daytime tags)
    // get a small boost for their daytime side
    if (pt === 'restaurant' && hasTag('lunch'))           timeAdjustment += 5
  }
  else if (tod === 'evening') {
    // 18:00–23:00: dinner, drinks, sunset, nightlife ramp-up
    if (hasTag('dinner') || hasTag('fine-dining'))        timeAdjustment += 10
    if (hasTag('cocktails') || hasTag('wine'))            timeAdjustment += 8
    if (hasTag('sunset'))                                 timeAdjustment += 8
    if (hasTag('rooftop'))                                timeAdjustment += 6
    if (hasTag('romantic'))                               timeAdjustment += 5
    if (hasTag('live-music'))                             timeAdjustment += 5
    // Shops, museums and cafes are now hard-excluded in evening (isEligibleForTimeWindow)
  }
  else if (tod === 'late_evening') {
    // 23:00–02:00: bars, late restaurants, hotel F&B
    if (pt === 'bar')                                    timeAdjustment += 15
    if (pt === 'restaurant' && hasTag('late-night'))      timeAdjustment += 12
    if (pt === 'restaurant' && hasTag('dinner'))          timeAdjustment += 5
    if (pt === 'hotel' && (hasTag('cocktails') || hasTag('rooftop') || hasTag('wine')))
                                                         timeAdjustment += 10
    if (hasTag('cocktails') || hasTag('wine'))            timeAdjustment += 8
    if (hasTag('rooftop'))                                timeAdjustment += 5
    if (hasTag('live-music'))                             timeAdjustment += 5
    // Cafes without evening relevance are now hard-excluded (isEligibleForTimeWindow)
    // Hotels without F&B tags: mild penalty
    if (pt === 'hotel' && !hasTag('cocktails') && !hasTag('wine') && !hasTag('rooftop'))
                                                         timeAdjustment -= 10
  }
  else if (tod === 'deep_night') {
    // 02:00–07:00: late bars, viewpoints as scenic fallback
    if (pt === 'bar')                                    timeAdjustment += 12
    if (hasTag('late-night'))                             timeAdjustment += 15
    if (hasTag('viewpoint'))                              timeAdjustment += 12
    if (pt === 'beach')                                  timeAdjustment += 8
    // Hotels with bar/lounge
    if (pt === 'hotel' && (hasTag('cocktails') || hasTag('wine')))
                                                         timeAdjustment += 8
    if (pt === 'hotel' && !hasTag('cocktails') && !hasTag('wine'))
                                                         timeAdjustment -= 15
  }
  else if (tod === 'night') {
    // 22:00–23:00 (legacy transition window)
    if (pt === 'bar')                                    timeAdjustment += 10
    if (hasTag('cocktails') || hasTag('wine'))            timeAdjustment += 8
    if (hasTag('late-night'))                             timeAdjustment += 5
    if (hasTag('live-music'))                             timeAdjustment += 5
  }

  // totalScore = baseScore + personalization + time adjustment
  const totalScore = baseScore + personalizationBonus + timeAdjustment

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

// ═══════════════════════════════════════════════════════════════════════════
// Pipeline: eligibility → score → rank
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score all candidates, apply hard eligibility filters, and sort by total score.
 *
 * Pipeline:
 *   1. Remove excluded IDs (session, cooldown)
 *   2. Apply hard time-of-day eligibility (isEligibleForTimeWindow)
 *      — Paid placements are NOT exempt: a closed restaurant at 04:00
 *        must not appear regardless of commercial contract.
 *   3. Score remaining candidates
 *   4. Sort by total score
 */
export function rankCandidates(
  candidates: UnifiedCandidate[],
  ctx: ScoringContext,
): ScoredCandidate[] {
  return candidates
    // Step 0a: remove excluded IDs
    .filter((p) => !ctx.excludeIds.has(p.id))
    // Step 0b: hard time-of-day eligibility (ALL candidates, including paid)
    .filter((p) => isEligibleForTimeWindow(p, ctx.timeOfDay))
    // Step 1+2: score + time adjustments
    .map((place) => scoreCandidate(place, ctx))
    // Sort by total score descending
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
