import type { RankCandidate, ScoredPlace, ScoringBreakdown } from './recommendations.dto'

// ─── Time → Window mapping ────────────────────────────────────────────────

const WINDOWS = [
  { name: 'manhã',     start: 6,  end: 11 },
  { name: 'almoço',    start: 11, end: 15 },
  { name: 'tarde',     start: 15, end: 18 },
  { name: 'noite',     start: 18, end: 22 },
  { name: 'madrugada', start: 22, end: 6 },
] as const

export function timeToWindow(time: string): string {
  const [h] = time.split(':').map(Number)
  if (h >= 6 && h < 11)  return 'manhã'
  if (h >= 11 && h < 15) return 'almoço'
  if (h >= 15 && h < 18) return 'tarde'
  if (h >= 18 && h < 22) return 'noite'
  return 'madrugada'
}

export function timeToTimeOfDay(time: string): string {
  const [h] = time.split(':').map(Number)
  if (h >= 6 && h < 11)  return 'morning'
  if (h >= 11 && h < 15) return 'midday'
  if (h >= 15 && h < 18) return 'afternoon'
  if (h >= 18 && h < 22) return 'evening'
  return 'night'
}

// ─── Budget → price_tier mapping ──────────────────────────────────────────

function budgetToTier(budget: string | undefined): number | null {
  switch (budget) {
    case '€':    return 1
    case '€€':   return 2
    case '€€€':  return 3
    case '€€€€': return 4
    default:     return null
  }
}

// ─── Intent → moment tag matching ─────────────────────────────────────────
// Each intent maps to one or more moment_tags_auto that increase relevance.

const INTENT_MOMENT_MAP: Record<string, string[]> = {
  // Dining
  dinner:           ['dinner', 'romantic-dinner', 'late-dinner'],
  lunch:            ['lunch', 'business-lunch'],
  breakfast:        ['breakfast', 'brunch', 'coffee'],
  brunch:           ['brunch', 'breakfast', 'coffee'],
  'quick-bite':     ['lunch', 'breakfast', 'coffee'],

  // Drinks & nightlife
  drinks:           ['drinks', 'evening-out', 'late-night', 'nightlife'],
  cocktails:        ['drinks', 'evening-out', 'nightlife'],
  wine:             ['drinks', 'evening-out'],
  'late-night':     ['late-night', 'nightlife', 'drinks'],

  // Romance & celebration
  romantic:         ['romantic-dinner', 'romantic', 'fine-dining', 'special-occasion'],
  celebration:      ['celebration', 'special-occasion', 'romantic-dinner', 'fine-dining'],
  'fine-dining':    ['fine-dining', 'romantic-dinner', 'special-occasion'],

  // Culture & activities
  culture:          ['culture', 'morning-visit', 'afternoon-visit', 'indoor'],
  museum:           ['culture', 'indoor', 'morning-visit', 'afternoon-visit', 'rainy-day'],
  'rainy-day':      ['rainy-day', 'indoor', 'culture', 'shopping'],

  // Nature & outdoor
  sunset:           ['sunset', 'viewpoint', 'beach-day'],
  beach:            ['beach-day', 'morning-swim', 'outdoor', 'sunset'],
  viewpoint:        ['viewpoint', 'sunset'],
  outdoor:          ['outdoor', 'beach-day', 'walk'],
  walk:             ['walk', 'outdoor', 'morning-visit', 'afternoon-visit'],

  // Shopping
  shopping:         ['shopping', 'afternoon-shopping', 'local-experience'],

  // Wellness
  wellness:         ['wellness', 'relax', 'stay'],
  relax:            ['relax', 'wellness', 'stay'],

  // Family
  family:           ['family', 'beach-day', 'outdoor', 'culture'],

  // Discovery
  'hidden-gem':     ['hidden-gem', 'local-experience', 'local-cuisine'],
  explore:          ['explore', 'hidden-gem', 'local-experience', 'local-cuisine'],
}

// ─── Haversine distance (km) ──────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Scoring weight profiles ──────────────────────────────────────────────
// NOW = immediate, nearby, time-sensitive
// Concierge = intentional, quality-driven, occasion-aware

export type Surface = 'now' | 'concierge' | 'default'

interface WeightProfile {
  moment:    number
  distance:  number
  quality:   number
  editorial: number
}

const WEIGHT_PROFILES: Record<Surface, WeightProfile> = {
  now: {
    moment:    0.25,  // Time relevance matters but less than immediacy
    distance:  0.35,  // Proximity is king for NOW
    quality:   0.20,  // Google rating + price
    editorial: 0.20,  // Featured + image
  },
  concierge: {
    moment:    0.40,  // Intent match is critical
    distance:  0.10,  // Distance matters less — user is planning
    quality:   0.25,  // Quality & price alignment matter more
    editorial: 0.25,  // Editorial signals = trust
  },
  default: {
    moment:    0.35,
    distance:  0.25,
    quality:   0.20,
    editorial: 0.20,
  },
}

// ─── STEP 1: Time filter ──────────────────────────────────────────────────

function filterByWindow(candidates: RankCandidate[], window: string): RankCandidate[] {
  return candidates.filter(c => {
    const windows = c.context_windows_auto
    if (!windows || windows.length === 0) return true  // No windows = always eligible
    return windows.includes(window)
  })
}

// ─── STEP 2: Category filter ──────────────────────────────────────────────

function filterByCategory(candidates: RankCandidate[], category: string): RankCandidate[] {
  return candidates.filter(c => {
    const cls = c.classification_auto
    if (!cls) return false
    return cls.category === category
  })
}

// ─── STEP 3: Budget filter ────────────────────────────────────────────────

function filterByBudget(candidates: RankCandidate[], budgetTier: number): RankCandidate[] {
  return candidates.filter(c => {
    if (c.price_tier == null) return true  // Unknown price = include
    // Allow ±1 tier tolerance
    return Math.abs(c.price_tier - budgetTier) <= 1
  })
}

// ─── Score: Moment match (0-100) ──────────────────────────────────────────

function scoreMoment(candidate: RankCandidate, intent: string | undefined): { score: number; matched: string[] } {
  const momentTags = candidate.moment_tags_auto ?? []
  if (momentTags.length === 0) return { score: 10, matched: [] }

  if (!intent) {
    // No intent → score based on tag richness (more tags = more versatile)
    return { score: Math.min(30 + momentTags.length * 5, 60), matched: [] }
  }

  const targetTags = INTENT_MOMENT_MAP[intent] ?? [intent]
  const matched = momentTags.filter(t => targetTags.includes(t))

  if (matched.length === 0) {
    // Partial: check context_tags_auto as fallback
    const contextTags = candidate.context_tags_auto ?? []
    const contextMatch = contextTags.filter(t => targetTags.includes(t) || t === intent)
    if (contextMatch.length > 0) return { score: 30, matched: contextMatch }
    return { score: 5, matched: [] }
  }

  // Scale: 1 match = 60, 2 = 80, 3+ = 100
  const score = Math.min(40 + matched.length * 20, 100)
  return { score, matched }
}

// ─── Score: Distance (0-100) ──────────────────────────────────────────────

function scoreDistance(
  candidate: RankCandidate,
  userLat: number | undefined,
  userLng: number | undefined,
): { score: number; distanceM: number | null } {
  if (userLat == null || userLng == null || candidate.latitude == null || candidate.longitude == null) {
    return { score: 40, distanceM: null }  // Neutral — no penalty, no boost
  }

  const km = haversineKm(userLat, userLng, candidate.latitude, candidate.longitude)
  const m = Math.round(km * 1000)

  let score: number
  if (km <= 0.5)       score = 100       // Walking distance
  else if (km <= 1.5)  score = 80        // Short walk / quick ride
  else if (km <= 4)    score = 50        // Reachable
  else if (km <= 10)   score = 25        // Far but possible
  else                 score = 5         // Very far

  return { score, distanceM: m }
}

// ─── Score: Quality (0-100) ───────────────────────────────────────────────

function scoreQuality(
  candidate: RankCandidate,
  budgetTier: number | null,
  intent: string | undefined,
): number {
  let score = 30  // Base

  // Google rating: 4.5+ = strong, 4.0+ = good, below = neutral
  if (candidate.google_rating != null) {
    if (candidate.google_rating >= 4.5)      score += 30
    else if (candidate.google_rating >= 4.0) score += 20
    else if (candidate.google_rating >= 3.5) score += 10
  }

  // Price alignment: if user wants romantic/fine-dining, prefer higher price
  if (candidate.price_tier != null) {
    const romanticIntents = ['romantic', 'celebration', 'fine-dining']
    const budgetIntents = ['quick-bite', 'breakfast']

    if (intent && romanticIntents.includes(intent) && candidate.price_tier >= 3) {
      score += 20  // High price matches luxury intent
    } else if (intent && budgetIntents.includes(intent) && candidate.price_tier <= 2) {
      score += 15  // Low price matches budget intent
    } else if (budgetTier != null) {
      // Penalize mismatch with budget
      const diff = Math.abs(candidate.price_tier - budgetTier)
      if (diff === 0) score += 15
      else if (diff === 1) score += 5
      else score -= 10
    }
  }

  return Math.max(0, Math.min(100, score))
}

// ─── Score: Editorial (0-100) ─────────────────────────────────────────────

function scoreEditorial(candidate: RankCandidate): number {
  let score = 20  // Base

  if (candidate.featured) score += 30
  if (candidate.hero_bucket) score += 20  // Has image
  if (candidate.short_description) score += 15  // Has description
  if (candidate.google_rating != null) score += 10  // Enriched
  // Classification available = well-cataloged
  if (candidate.classification_auto) score += 5

  return Math.min(100, score)
}

// ─── STEP 5: Category diversity ───────────────────────────────────────────

function applyDiversity(scored: Array<{ candidate: RankCandidate; total: number; breakdown: ScoringBreakdown }>): void {
  // Track category counts in result set
  const categoryCounts: Record<string, number> = {}

  for (let i = 0; i < scored.length; i++) {
    const cat = scored[i].candidate.classification_auto?.category ?? scored[i].candidate.place_type
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1

    // Penalize 3rd+ of same category
    if (categoryCounts[cat] >= 3) {
      const penalty = 0.85
      scored[i].total *= penalty
      scored[i].breakdown.diversityAdjustment = penalty
    }
    // Penalize adjacent same place_type
    if (i > 0) {
      const prevType = scored[i - 1].candidate.place_type
      if (scored[i].candidate.place_type === prevType) {
        scored[i].total *= 0.90
        scored[i].breakdown.diversityAdjustment *= 0.90
      }
    }
  }

  // Re-sort after diversity adjustments
  scored.sort((a, b) => b.total - a.total)
}

// ─── Main ranking function ────────────────────────────────────────────────

export interface RankingInput {
  candidates: RankCandidate[]
  time: string            // HH:MM
  intent?: string
  budget?: string
  category?: string
  userLat?: number
  userLng?: number
  limit: number
  surface?: Surface       // 'now' | 'concierge' | 'default'
}

export interface RankingOutput {
  results: ScoredPlace[]
  breakdowns: ScoringBreakdown[]
  window: string
  candidatesTotal: number
  candidatesFiltered: number
}

export function rank(input: RankingInput): RankingOutput {
  const { candidates, time, intent, budget, category, userLat, userLng, limit, surface } = input
  const weights = WEIGHT_PROFILES[surface ?? 'default']
  const window = timeToWindow(time)
  const budgetTier = budgetToTier(budget)
  const candidatesTotal = candidates.length

  // ── Step 1: Time filter ──────────────────────────────────────────────
  let filtered = filterByWindow(candidates, window)

  // ── Step 2: Category filter (optional) ───────────────────────────────
  if (category) {
    filtered = filterByCategory(filtered, category)
  }

  // ── Step 3: Budget filter (optional) ─────────────────────────────────
  if (budgetTier != null) {
    const budgetFiltered = filterByBudget(filtered, budgetTier)
    // Only apply if it leaves enough results
    if (budgetFiltered.length >= Math.min(limit, 5)) {
      filtered = budgetFiltered
    }
  }

  const candidatesFiltered = filtered.length

  // ── Step 4: Score each candidate ─────────────────────────────────────
  const scored = filtered.map(candidate => {
    const moment = scoreMoment(candidate, intent)
    const dist = scoreDistance(candidate, userLat, userLng)
    const quality = scoreQuality(candidate, budgetTier, intent)
    const editorial = scoreEditorial(candidate)

    const total =
      moment.score   * weights.moment +
      dist.score     * weights.distance +
      quality        * weights.quality +
      editorial      * weights.editorial

    const breakdown: ScoringBreakdown = {
      placeId: candidate.id,
      name: candidate.name,
      momentScore: moment.score,
      distanceScore: dist.score,
      qualityScore: quality,
      editorialScore: editorial,
      diversityAdjustment: 1.0,
      totalScore: total,
      matchedMoments: moment.matched,
      distance: dist.distanceM,
    }

    return { candidate, total, breakdown, matchedMoments: moment.matched, distanceM: dist.distanceM }
  })

  // Sort by score descending
  scored.sort((a, b) => b.total - a.total)

  // ── Step 5: Category diversity ───────────────────────────────────────
  applyDiversity(scored)

  // ── Step 6: Take top N ───────────────────────────────────────────────
  const topN = scored.slice(0, limit)

  // ── Build response ───────────────────────────────────────────────────
  const results: ScoredPlace[] = topN.map(s => {
    const cls = s.candidate.classification_auto
    // Build human-readable reasons
    const reason: string[] = []
    if (s.matchedMoments.length > 0) reason.push(...s.matchedMoments.slice(0, 3))
    if (s.distanceM != null && s.distanceM <= 1500) reason.push('nearby')
    if (s.candidate.google_rating != null && s.candidate.google_rating >= 4.5) reason.push('highly-rated')
    if (s.candidate.featured) reason.push('featured')

    return {
      id: s.candidate.id,
      slug: s.candidate.slug,
      name: s.candidate.name,
      placeType: s.candidate.place_type,
      category: cls?.category ?? null,
      subcategory: cls?.subcategory ?? null,
      heroImage: { bucket: s.candidate.hero_bucket, path: s.candidate.hero_path },
      shortDescription: s.candidate.short_description,
      score: Math.round(s.total * 100) / 100,
      reason,
      distance: s.distanceM,
      priceLevel: s.candidate.price_tier,
      googleRating: s.candidate.google_rating,
    }
  })

  const breakdowns = topN.map(s => ({
    ...s.breakdown,
    totalScore: Math.round(s.total * 100) / 100,
  }))

  return { results, breakdowns, window, candidatesTotal, candidatesFiltered }
}
