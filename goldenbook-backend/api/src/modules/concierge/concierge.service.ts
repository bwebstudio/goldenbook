// ─── Concierge Service ────────────────────────────────────────────────────────
//
// Pure deterministic logic — no external services, no AI.
// All recommendation resolution and scoring lives here.

import {
  hasProfile,
  scoreFinalPlace,
  scoreIntentForProfile,
  type OnboardingProfile,
} from '../../shared/ranking/place.ranking'
import {
  TIME_TAG_BOOSTS,
  WEATHER_TAG_BOOSTS,
  getNowTimeOfDay,
  type ContextTag,
} from '../shared-scoring/context-tags'
import type { NowTimeOfDay, WeatherCondition } from '../shared-scoring/types'
import {
  ConciergeIntent,
  INTENT_REGISTRY,
  INTENT_CONFLICTS,
  BOOTSTRAP_MATRIX,
  TimeOfDay,
  getIntentById,
  getIntentLabels,
} from './concierge.intents'

// ─── Time of day ──────────────────────────────────────────────────────────────

/**
 * City-aware time-of-day for Concierge (5-bucket model).
 * Uses the destination's real timezone via shared-scoring, not the server's clock.
 */
export function getTimeOfDay(citySlug?: string): TimeOfDay {
  const nowTod = getNowTimeOfDay(new Date(), citySlug)
  return mapNowTimeOfDayToConcierge(nowTod)
}

/** Map shared-scoring 7-value NowTimeOfDay → Concierge 5-value TimeOfDay */
function mapNowTimeOfDayToConcierge(nowTod: NowTimeOfDay): TimeOfDay {
  switch (nowTod) {
    case 'morning':      return 'morning'
    case 'midday':       return 'afternoon'
    case 'afternoon':    return 'afternoon'
    case 'evening':      return 'evening'
    case 'night':        return 'evening'       // legacy alias
    case 'late_evening': return 'late_evening'
    case 'deep_night':   return 'deep_night'
    default:             return 'morning'
  }
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

type GreetingFn = (city: string) => string

const GREETINGS_I18N: Record<string, Record<TimeOfDay, GreetingFn>> = {
  en: {
    morning:      (city) => `Good morning. I have curated a few elegant starts for your day in ${city}.`,
    afternoon:    (city) => `Good afternoon. I've prepared a few refined selections for your afternoon in ${city}.`,
    evening:      (city) => `Good evening. I have curated some selections for your night in ${city}. What would you prefer?`,
    late_evening: (city) => `The night is young in ${city}. I've curated a few refined selections for you.`,
    deep_night:   (city) => `For the late hours in ${city}, here are a few places that never sleep.`,
  },
  pt: {
    morning:      (city) => `Bom dia. Selecionei alguns começos de dia elegantes para si em ${city}.`,
    afternoon:    (city) => `Boa tarde. Preparei algumas escolhas refinadas para a sua tarde em ${city}.`,
    evening:      (city) => `Boa noite. Selecionei algumas propostas para a sua noite em ${city}. O que prefere?`,
    late_evening: (city) => `A noite é ainda jovem em ${city}. Selecionei algumas sugestões refinadas.`,
    deep_night:   (city) => `Para as horas tardias em ${city}, eis alguns sítios que nunca dormem.`,
  },
  es: {
    morning:      (city) => `Buenos días. He seleccionado algunos comienzos elegantes para tu día en ${city}.`,
    afternoon:    (city) => `Buenas tardes. He preparado algunas opciones refinadas para tu tarde en ${city}.`,
    evening:      (city) => `Buenas noches. He seleccionado algunas propuestas para tu noche en ${city}. ¿Qué prefieres?`,
    late_evening: (city) => `La noche es joven en ${city}. He seleccionado algunas opciones refinadas.`,
    deep_night:   (city) => `Para las horas tardías en ${city}, aquí tienes algunos sitios que nunca duermen.`,
  },
}

export function buildGreeting(timeOfDay: TimeOfDay, cityName: string, locale = 'en'): string {
  const localeFamily = locale.split('-')[0]
  const map = GREETINGS_I18N[locale] ?? GREETINGS_I18N[localeFamily] ?? GREETINGS_I18N['en']
  return map[timeOfDay](cityName)
}

// ─── Bootstrap intents (context-aware) ────────────────────────────────────────
//
// Instead of hardcoded lists, bootstrap intents are derived from the current
// context: time of day + weather + optional profile. This ensures the Concierge
// always starts with suggestions that make sense for the moment.

/** Map Concierge TimeOfDay (3 values) to shared NowTimeOfDay (5 values) */
/**
 * Convert coarse Concierge TimeOfDay to fine-grained NowTimeOfDay.
 * When a citySlug is provided, uses the real local hour for precise mapping
 * (e.g. 12:09 in Porto → 'midday', not 'afternoon').
 */
function toNowTimeOfDay(tod: TimeOfDay, citySlug?: string): NowTimeOfDay {
  if (citySlug) {
    return getNowTimeOfDay(new Date(), citySlug)
  }
  // Direct mapping — Concierge 5 buckets are a subset of NowTimeOfDay
  return tod as NowTimeOfDay
}

/**
 * Score an intent against the current context using the shared tag boost maps.
 * Intents with tags that match high-boost context tags score higher.
 */
function scoreIntentForContext(
  intent: ConciergeIntent,
  timeOfDay: TimeOfDay,
  weather?: string | null,
  citySlug?: string,
): number {
  const nowTod = toNowTimeOfDay(timeOfDay, citySlug)
  const timeBoosts = TIME_TAG_BOOSTS[nowTod] ?? {}
  const weatherBoosts = weather ? (WEATHER_TAG_BOOSTS[weather as WeatherCondition] ?? {}) : {}

  let contextScore = 0

  // Score intent tags against current context boosts
  for (const tag of intent.tags) {
    const normalized = tag.toLowerCase().replace(/[^a-z0-9]/g, '-') as ContextTag
    const timeBoost = timeBoosts[normalized] ?? 0
    const weatherBoost = weatherBoosts[normalized] ?? 0
    contextScore += timeBoost + weatherBoost
  }

  // Also check categorySlugs
  for (const slug of intent.categorySlugs) {
    const normalized = slug.toLowerCase() as ContextTag
    const timeBoost = timeBoosts[normalized] ?? 0
    contextScore += timeBoost * 0.5
  }

  return contextScore
}

/**
 * Get bootstrap intents using the curated editorial matrix.
 *
 * Instead of picking "top 3 by score", this uses BOOTSTRAP_MATRIX to return
 * editorially curated sets of pills that are guaranteed to be:
 *   - appropriate for the time of day
 *   - diverse (no conflicting intents in the same set)
 *   - viable (each intent has places in the city)
 *
 * The viabilityFn is injected by the route handler since it requires DB access.
 * If not provided, returns the first set without viability checks.
 */
export function getBootstrapIntents(
  timeOfDay: TimeOfDay,
  _profile?: OnboardingProfile,
  _weather?: string | null,
  _citySlug?: string,
  viabilityFn?: (intentId: string) => boolean,
): ConciergeIntent[] {
  const matrix = BOOTSTRAP_MATRIX[timeOfDay]
  if (!matrix || matrix.length === 0) {
    // Fallback: time-eligible intents by priority (should not happen with a complete matrix)
    return INTENT_REGISTRY
      .filter((i) => i.preferredTimeOfDay.includes(timeOfDay))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
  }

  // Try each curated set in order — return the first where all intents are viable
  for (const set of matrix) {
    const intents = set
      .map((id) => getIntentById(id))
      .filter((i): i is ConciergeIntent => i != null)

    if (intents.length < 3) continue // set references unknown intent — skip

    if (!viabilityFn) return intents // no viability check available — use first set

    const allViable = intents.every((i) => viabilityFn(i.id))
    if (allViable) return intents
  }

  // No fully viable set — build a partial set from the first matrix row,
  // filling gaps with other time-eligible intents
  const firstSet = matrix[0]
  const result: ConciergeIntent[] = []
  const usedIds = new Set<string>()

  for (const id of firstSet) {
    const intent = getIntentById(id)
    if (intent && (!viabilityFn || viabilityFn(id))) {
      result.push(intent)
      usedIds.add(id)
    }
  }

  // Fill remaining slots from time-eligible intents, respecting conflicts
  if (result.length < 3) {
    const fillers = INTENT_REGISTRY
      .filter((i) =>
        !usedIds.has(i.id)
        && i.preferredTimeOfDay.includes(timeOfDay)
        && (!viabilityFn || viabilityFn(i.id))
        && !hasConflict(i.id, usedIds),
      )
      .sort((a, b) => b.priority - a.priority)

    for (const filler of fillers) {
      if (result.length >= 3) break
      result.push(filler)
      usedIds.add(filler.id)
    }
  }

  return result
}

/** Check if an intent conflicts with any intent in the given set */
function hasConflict(intentId: string, usedIds: Set<string>): boolean {
  for (const [a, b] of INTENT_CONFLICTS) {
    if ((a === intentId && usedIds.has(b)) || (b === intentId && usedIds.has(a))) {
      return true
    }
  }
  return false
}

// ─── Temporal eligibility ────────────────────────────────────────────────────
//
// Hard gate: an intent is allowed ONLY if its preferredTimeOfDay includes the
// current bucket. This is enforced BEFORE ranking, not as a scoring penalty.
// Order: temporal eligibility → intent resolution → ranking → paid injection.

export function isIntentAllowedForTime(intent: ConciergeIntent, timeOfDay: TimeOfDay): boolean {
  return intent.preferredTimeOfDay.includes(timeOfDay)
}

export function getAllowedIntentsForTime(timeOfDay: TimeOfDay): ConciergeIntent[] {
  return INTENT_REGISTRY.filter((i) => i.preferredTimeOfDay.includes(timeOfDay))
}

// ─── Curated temporal fallback mapping ──────────────────────────────────────
//
// When an intent is disallowed for the current time, map it deterministically
// to the best editorial alternative for that bucket. These mappings are curated
// to feel natural — not random or algorithmic.

const TIME_SAFE_FALLBACKS: Record<string, Partial<Record<TimeOfDay, string>>> = {
  // ── Dining intents ───────────────────────────────────────────────────
  romantic_dinner: {
    // "I want a romantic dinner" at 11am → the natural daytime equivalent is
    // a long leisurely lunch, not coffee. Coffee feels like a downgrade.
    morning:    'long_lunch',
    afternoon:  'long_lunch',
    // At 3am the mood is still going → late-night drinks keeps the night alive
    deep_night: 'late_night_drinks',
  },
  long_lunch: {
    // Evening: the same person who wanted a long lunch wants a proper dinner
    evening:      'romantic_dinner',
    // Late evening: they missed dinner → a refined nightcap is the right pivot
    late_evening: 'after_dinner_drinks',
    deep_night:   'late_night_drinks',
  },

  // ── Daytime exploration intents ──────────────────────────────────────
  design_shopping: {
    // "Shopping" at night → cocktail bars: both are social, curated experiences.
    // hidden_gems feels too vague; cocktail bars has the same "discover
    // something special" energy that a design-shopping person wants.
    evening:      'cocktail_bars',
    late_evening: 'cocktail_bars',
    deep_night:   'night_walk',
  },
  gallery_afternoon: {
    // "Culture" at night → hidden gems preserves the discovery spirit.
    // Wine bars or cocktails feel too disconnected from the cultural intent.
    evening:      'hidden_gems',
    late_evening: 'hidden_gems',
    deep_night:   'night_walk',
  },
  coffee_and_work: {
    // "Coffee" at night → quiet wine bar: same vibe (quiet, intimate, sit down)
    // but appropriate for the hour. hidden_gems is too broad.
    evening:      'quiet_wine_bar',
    late_evening: 'quiet_wine_bar',
    deep_night:   'late_night_drinks',
  },

  // ── Golden hour / terrace intents ────────────────────────────────────
  sunset_drinks: {
    // Morning: a terrace coffee feels like the right daytime equivalent
    // of the outdoor/scenic desire behind sunset drinks.
    morning:      'coffee_and_work',
    // Late evening: the terrace moment is gone → cocktail bars inherits
    // the "drink with a view" desire in a nighttime-appropriate way.
    late_evening: 'cocktail_bars',
    deep_night:   'late_night_drinks',
  },

  // ── Evening drinks intents ───────────────────────────────────────────
  cocktail_bars: {
    // Morning: coffee is the daytime equivalent of "I want a crafted drink"
    morning:    'coffee_and_work',
    deep_night: 'late_night_drinks',
  },
  quiet_wine_bar: {
    morning:    'coffee_and_work',
    deep_night: 'late_night_drinks',
  },
  after_dinner_drinks: {
    // Morning/afternoon: quiet wine bar keeps the intimate, refined mood.
    morning:    'coffee_and_work',
    afternoon:  'quiet_wine_bar',
    deep_night: 'late_night_drinks',
  },

  // ── Night intents ────────────────────────────────────────────────────
  late_night_jazz: {
    // Morning: coffee_and_work — the calm creative parallel to jazz
    morning:   'coffee_and_work',
    // Afternoon: gallery captures the artistic/cultural thread of jazz
    afternoon: 'gallery_afternoon',
  },
  night_walk: {
    morning:   'beautiful_spots',
    afternoon: 'beautiful_spots',
  },
  late_night_drinks: {
    morning:   'coffee_and_work',
    afternoon: 'quiet_wine_bar',
    evening:   'cocktail_bars',
  },

  // ── Broad intents ────────────────────────────────────────────────────
  beautiful_spots: {
    late_evening: 'night_walk',
    deep_night:   'night_walk',
  },
  hidden_gems: {
    // Evening: the discovery spirit maps to romantic dinner (most cities have restaurants)
    evening:      'romantic_dinner',
    // Late evening: after-dinner drinks preserves the "find something special" mood
    late_evening: 'after_dinner_drinks',
    // At 3am, the broad discovery intent narrows to what's actually open
    deep_night:   'late_night_drinks',
  },
}

/**
 * Given a disallowed intent, return the best curated fallback for this time.
 * Falls back to the time-appropriate default if no explicit mapping exists.
 */
export function getTimeSafeFallbackIntent(intentId: string, timeOfDay: TimeOfDay): ConciergeIntent {
  const intent = getIntentById(intentId)
  if (intent && isIntentAllowedForTime(intent, timeOfDay)) return intent

  const fallbackId = TIME_SAFE_FALLBACKS[intentId]?.[timeOfDay]
  if (fallbackId) {
    const fallback = getIntentById(fallbackId)
    if (fallback && isIntentAllowedForTime(fallback, timeOfDay)) return fallback
  }

  return getDefaultIntent(timeOfDay)
}

/**
 * Validate an intent against the current time. If disallowed, remap to the
 * curated time-safe fallback. This is the single enforcement point used by
 * all code paths: explicit intent, query resolution, NOW handoff.
 */
export function ensureTimeValidIntent(intent: ConciergeIntent, timeOfDay: TimeOfDay): ConciergeIntent {
  if (isIntentAllowedForTime(intent, timeOfDay)) return intent
  return getTimeSafeFallbackIntent(intent.id, timeOfDay)
}

// ─── Refinement system ──────────────────────────────────────────────────────
//
// When the user sends messages like "algo más relajado" or "something quieter",
// these map to tag weight adjustments instead of resetting the recommendation.

export type RefinementMode = 'relax' | 'energy' | 'treat' | 'romantic' | 'culture' | null

/** Tags to boost/reduce for each refinement mode */
const REFINEMENT_TAG_ADJUSTMENTS: Record<string, { boost: ContextTag[]; reduce: ContextTag[] }> = {
  relax: {
    boost: ['wine', 'terrace', 'romantic', 'coffee', 'viewpoint', 'wellness'],
    reduce: ['live-music', 'celebration', 'late-night', 'cocktails'],
  },
  energy: {
    boost: ['cocktails', 'live-music', 'late-night', 'celebration', 'rooftop'],
    reduce: ['coffee', 'wellness', 'wine', 'viewpoint'],
  },
  treat: {
    boost: ['fine-dining', 'romantic', 'rooftop', 'wine', 'sunset', 'wellness'],
    reduce: ['quick-stop', 'coffee', 'shopping'],
  },
  romantic: {
    boost: ['romantic', 'fine-dining', 'wine', 'sunset', 'terrace', 'viewpoint'],
    reduce: ['family', 'shopping', 'quick-stop', 'live-music'],
  },
  culture: {
    boost: ['culture', 'local-secret', 'viewpoint', 'wine'],
    reduce: ['shopping', 'cocktails', 'late-night'],
  },
}

export function getRefinementTagAdjustments(mode: string): { boost: string[]; reduce: string[] } | null {
  return REFINEMENT_TAG_ADJUSTMENTS[mode] ?? null
}

/** Detect refinement mode from user text input (multi-language) */
const REFINEMENT_KEYWORDS: Record<string, string[]> = {
  relax: [
    'relajado', 'relax', 'relaxed', 'tranquilo', 'quieter', 'quiet', 'calm', 'calmo',
    'chill', 'peaceful', 'sereno', 'suave', 'más tranquilo', 'mais calmo',
  ],
  energy: [
    'energía', 'energy', 'animado', 'lively', 'fun', 'divertido', 'festivo',
    'fiesta', 'party', 'upbeat', 'vibrant', 'vibrante', 'emocionante',
  ],
  treat: [
    'capricho', 'treat', 'lujo', 'luxury', 'special', 'especial', 'premium',
    'mimo', 'indulge', 'elegante', 'elegant', 'exclusivo', 'exclusive',
  ],
  romantic: [
    'romántico', 'romantic', 'pareja', 'couple', 'date', 'cita', 'íntimo', 'intimate',
  ],
  culture: [
    'cultura', 'culture', 'cultural', 'arte', 'art', 'museo', 'museum', 'galería', 'gallery',
  ],
}

export function detectRefinementFromText(text: string): RefinementMode {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim()
  for (const [mode, keywords] of Object.entries(REFINEMENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) return mode as RefinementMode
    }
  }
  return null
}

// ─── Intent resolution ────────────────────────────────────────────────────────
//
// Deterministic keyword matching — no AI.
// Rules:
//  1. Normalize input (lowercase, strip punctuation)
//  2. Match against each intent's keyword list (phrase-level first, then word-level)
//  3. Score by hits, weighted by keyword position and time-of-day preference
//  4. If tie, prefer higher-priority intent
//  5. If no match, return safe default for time of day

export function resolveIntentFromQuery(
  query: string,
  timeOfDay: TimeOfDay,
): ConciergeIntent {
  const normalized = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return getDefaultIntent(timeOfDay)

  // ── STEP 1: Score only time-valid intents ───────────────────────────
  const allowedIntents = getAllowedIntentsForTime(timeOfDay)
  const scores = new Map<string, number>()

  for (const intent of allowedIntents) {
    let score = 0

    // Phrase-level matching (higher weight — 3 pts per phrase hit)
    for (const keyword of intent.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        score += 3
      }
    }

    // Tag-level matching against normalized query (2 pts per tag hit)
    for (const tag of intent.tags) {
      if (normalized.includes(tag.toLowerCase())) {
        score += 2
      }
    }

    // Word-level fuzzy matching (1 pt per word that appears in any keyword)
    const words = normalized.split(' ').filter((w) => w.length >= 3)
    for (const word of words) {
      for (const keyword of intent.keywords) {
        if (keyword.toLowerCase().includes(word)) {
          score += 1
          break // only count the word once per intent
        }
      }
    }

    if (score > 0) {
      // Tie-breaking via curated priority
      score += intent.priority * 0.1
      scores.set(intent.id, score)
    }
  }

  if (scores.size > 0) {
    const topId = [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return getIntentById(topId) ?? getDefaultIntent(timeOfDay)
  }

  // ── STEP 2: No time-valid match — check full registry for a strong
  // textual match and remap it to the curated time-safe fallback ──────
  let bestDisallowedId: string | null = null
  let bestDisallowedScore = 0

  for (const intent of INTENT_REGISTRY) {
    if (isIntentAllowedForTime(intent, timeOfDay)) continue // already scored above
    let score = 0
    for (const keyword of intent.keywords) {
      if (normalized.includes(keyword.toLowerCase())) score += 3
    }
    for (const tag of intent.tags) {
      if (normalized.includes(tag.toLowerCase())) score += 2
    }
    if (score > bestDisallowedScore) {
      bestDisallowedScore = score
      bestDisallowedId = intent.id
    }
  }

  // Only remap if the disallowed match is strong enough (≥3 = at least one keyword hit)
  if (bestDisallowedId && bestDisallowedScore >= 3) {
    return getTimeSafeFallbackIntent(bestDisallowedId, timeOfDay)
  }

  return getDefaultIntent(timeOfDay)
}

const DEFAULT_INTENTS: Record<TimeOfDay, string> = {
  morning:      'coffee_and_work',
  afternoon:    'long_lunch',
  evening:      'cocktail_bars',
  late_evening: 'after_dinner_drinks',
  deep_night:   'late_night_drinks',
}

export function getDefaultIntent(timeOfDay: TimeOfDay): ConciergeIntent {
  return getIntentById(DEFAULT_INTENTS[timeOfDay])!
}

// ─── Recommendation scoring ───────────────────────────────────────────────────
//
// Two-part scoring model (V2):
//   baseScore  = intent-specific matching (place_type + tag content)
//   finalScore = scoreFinalPlace(baseScore, place, 'concierge', profile)
//              = baseScore
//              + onboardingScore * 1.5   (profile alignment)
//              + businessScore   * 0.6   (featured, tier, sponsored)
//              + qualityScore    * 0.8   (image, popularity, recency, editorial)

export interface ScoredPlace {
  id: string
  slug: string
  name: string
  city_slug: string
  city_name: string
  place_type: string
  short_description: string | null
  editorial_summary: string | null
  featured: boolean
  popularity_score: number | null
  hero_bucket: string | null
  hero_path: string | null
  created_at: Date
  /** Editor-defined context tags (from place_now_tags). Used as soft boost. */
  context_tag_slugs?: string[]
  /** Editor-defined time windows (from place_now_time_windows). Used as soft boost. */
  time_window_slugs?: string[]
}

/**
 * Score a place for a Concierge intent.
 *
 * Uses the shared scoring engine with Concierge-specific intent overlap.
 * Intent tags are passed to the engine for context score boosting.
 * The shared engine handles: commercial + context + editorial + quality + proximity.
 *
 * Additionally applies Concierge-specific scoring for:
 *   1. place_type match bonus
 *   2. text content tag matching
 *   3. shared ranking model (business, quality, onboarding)
 */
export function scoreConciergePlace(
  place: ScoredPlace,
  intent: ConciergeIntent,
  profile?: OnboardingProfile,
  timeOfDay?: TimeOfDay,
): number {
  let baseScore = 0

  // 1. Place type match (hard-filtered at query level, but still a scoring signal)
  if (intent.placeTypes.includes(place.place_type)) baseScore += 12

  // 2. Text content tag matching
  const textContent = [place.short_description, place.editorial_summary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const tag of intent.tags) {
    if (textContent.includes(tag.toLowerCase())) baseScore += 6
  }

  // 3. Context tag matching (editor-defined relevance metadata)
  if (place.context_tag_slugs?.length) {
    const contextSet = new Set(place.context_tag_slugs)
    for (const tag of intent.tags) {
      const normalized = tag.toLowerCase().replace(/[^a-z0-9]/g, '-')
      if (contextSet.has(normalized)) baseScore += 4
    }
    for (const catSlug of intent.categorySlugs) {
      if (contextSet.has(catSlug)) baseScore += 3
    }
    // Canonical context tag alignment (24-tag system).
    // NOTE: the live concierge.route.ts pipeline applies this same logic
    // (including canonicalExcludeTags as a hard kill) — kept here for any
    // future caller that uses scoreConciergePlace directly.
    if (intent.canonicalTags?.length) {
      let canonicalHits = 0
      for (const tag of intent.canonicalTags) {
        if (contextSet.has(tag)) canonicalHits++
      }
      baseScore += canonicalHits * 8
    }
    if (intent.canonicalExcludeTags?.length) {
      for (const tag of intent.canonicalExcludeTags) {
        if (contextSet.has(tag)) return Number.NEGATIVE_INFINITY
      }
    }
  }

  // 4. Time window boost
  if (timeOfDay && place.time_window_slugs?.length) {
    const windowsForTime: Record<TimeOfDay, string[]> = {
      morning:      ['morning', 'midday'],
      afternoon:    ['midday', 'afternoon'],
      evening:      ['evening', 'night'],
      late_evening: ['night', 'late_evening'],
      deep_night:   ['late_evening', 'deep_night'],
    }
    const relevantWindows = windowsForTime[timeOfDay]
    const hasMatch = place.time_window_slugs.some((tw) => relevantWindows.includes(tw))
    if (hasMatch) {
      baseScore += 5
    }
  }

  // 5. Delegate business / quality / onboarding to the shared ranking model
  return scoreFinalPlace(baseScore, place, 'concierge', profile)
}

// ─── Response copy ────────────────────────────────────────────────────────────

type ResponseFn = (city: string, timeOfDay: TimeOfDay) => string
type ResponseMap = Partial<Record<string, ResponseFn>>

const RESPONSE_TEXTS_I18N: Record<string, ResponseMap> = {
  en: {
    romantic_dinner:     (city)       => `For an elegant evening in ${city}, I've selected a few atmospheric addresses.`,
    quiet_wine_bar:      (city)       => `A few refined wine bars for a slower, more elegant pace in ${city}.`,
    late_night_jazz:     (city)       => `For sophisticated music after dark in ${city}, here are my selections.`,
    cocktail_bars:       (city, tod)  => `Here are some of ${city}'s finest cocktail addresses for this ${tod === 'afternoon' ? 'afternoon' : 'evening'}.`,
    hidden_gems:         (city)       => `A few of ${city}'s best-kept secrets, away from the usual paths.`,
    coffee_and_work:     (city)       => `My selections for a refined morning in ${city}.`,
    sunset_drinks:       (city)       => `The finest terraces and rooftops for the golden hour in ${city}.`,
    long_lunch:          (city)       => `For an unhurried midday in ${city}, here are my selections.`,
    gallery_afternoon:   (city)       => `A curated afternoon of art and culture in ${city}.`,
    design_shopping:     (city)       => `A few curated boutiques and concept stores in ${city}.`,
    after_dinner_drinks: (city)       => `To cap your evening in ${city}, here are my selections.`,
    night_walk:          (city)       => `For a nocturnal stroll through ${city}, here are my recommended stops.`,
    late_night_drinks:   (city)       => `For the late hours in ${city}, a few spots that are still serving.`,
    beautiful_spots:        (city)       => `The most scenic and visually striking places in ${city}.`,
  },
  pt: {
    romantic_dinner:     (city)       => `Para uma noite elegante em ${city}, selecionei alguns endereços especiais.`,
    quiet_wine_bar:      (city)       => `Alguns bares de vinho refinados para um ritmo mais tranquilo em ${city}.`,
    late_night_jazz:     (city)       => `Para uma noite de música sofisticada em ${city}, eis as minhas sugestões.`,
    cocktail_bars:       (city, tod)  => `Os melhores endereços de cocktails de ${city} para esta ${tod === 'afternoon' ? 'tarde' : 'noite'}.`,
    hidden_gems:         (city)       => `Alguns dos segredos mais bem guardados de ${city}, longe dos percursos habituais.`,
    coffee_and_work:     (city)       => `As minhas sugestões para uma manhã refinada em ${city}.`,
    sunset_drinks:       (city)       => `Os melhores terraços e rooftops para a hora dourada em ${city}.`,
    long_lunch:          (city)       => `Para um almoço tranquilo em ${city}, eis as minhas sugestões.`,
    gallery_afternoon:   (city)       => `Uma tarde curada de arte e cultura em ${city}.`,
    design_shopping:     (city)       => `Algumas boutiques e concept stores selecionadas em ${city}.`,
    after_dinner_drinks: (city)       => `Para terminar a noite em ${city}, eis as minhas sugestões.`,
    night_walk:          (city)       => `Para um passeio noturno por ${city}, eis as minhas paragens recomendadas.`,
    late_night_drinks:   (city)       => `Para as horas tardias em ${city}, alguns sítios que ainda estão abertos.`,
    beautiful_spots:        (city)       => `Os lugares mais bonitos e visualmente marcantes de ${city}.`,
  },
  es: {
    romantic_dinner:     (city)       => `Para una noche elegante en ${city}, he seleccionado algunas direcciones especiales.`,
    quiet_wine_bar:      (city)       => `Algunos bares de vino refinados para un ritmo más tranquilo en ${city}.`,
    late_night_jazz:     (city)       => `Para música sofisticada por la noche en ${city}, estas son mis sugerencias.`,
    cocktail_bars:       (city, tod)  => `Aquí tienes algunos de los mejores bares de cócteles de ${city} para esta ${tod === 'afternoon' ? 'tarde' : 'noche'}.`,
    hidden_gems:         (city)       => `Algunos de los secretos mejor guardados de ${city}, lejos de las rutas habituales.`,
    coffee_and_work:     (city)       => `Mis recomendaciones para una mañana refinada en ${city}.`,
    sunset_drinks:       (city)       => `Las mejores terrazas y rooftops para la hora dorada en ${city}.`,
    long_lunch:          (city)       => `Para un almuerzo sin prisas en ${city}, aquí tienes mis recomendaciones.`,
    gallery_afternoon:   (city)       => `Una tarde curada de arte y cultura en ${city}.`,
    design_shopping:     (city)       => `Algunas boutiques y concept stores seleccionadas en ${city}.`,
    after_dinner_drinks: (city)       => `Para cerrar la noche en ${city}, aquí tienes mis recomendaciones.`,
    night_walk:          (city)       => `Para un paseo nocturno por ${city}, estas son mis paradas recomendadas.`,
    late_night_drinks:   (city)       => `Para las horas tardías en ${city}, algunos sitios que siguen abiertos.`,
    beautiful_spots:        (city)       => `Los lugares más bonitos y visualmente memorables de ${city}.`,
  },
}

export function buildResponseText(
  intent: ConciergeIntent,
  cityName: string,
  timeOfDay: TimeOfDay,
  locale = 'en',
): string {
  const localeFamily = locale.split('-')[0]
  const map = RESPONSE_TEXTS_I18N[locale] ?? RESPONSE_TEXTS_I18N[localeFamily] ?? RESPONSE_TEXTS_I18N['en']
  const fn = map[intent.id]
  if (fn) return fn(cityName, timeOfDay)
  // Generic fallback — use localized intent title if available
  const labels = getIntentLabels(intent.id, locale)
  return localeFamily === 'pt'
    ? `Eis as minhas sugestões para ${labels.title.toLowerCase()} em ${cityName}.`
    : localeFamily === 'es'
      ? `Aquí tienes mis sugerencias para ${labels.title.toLowerCase()} en ${cityName}.`
      : `Here are my selections for ${labels.title.toLowerCase()} in ${cityName}.`
}

// ─── Fallback intents ─────────────────────────────────────────────────────────

export function getFallbackIntents(
  excludeIntentId: string,
  timeOfDay: TimeOfDay,
  locale = 'en',
): Array<{ id: string; title: string }> {
  // Get time-appropriate intents from registry (replaces static BOOTSTRAP_INTENTS)
  const result = INTENT_REGISTRY
    .filter((i) => i.id !== excludeIntentId && i.preferredTimeOfDay.includes(timeOfDay))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .map(({ id }) => ({ id, title: getIntentLabels(id, locale).title }))

  if (result.length >= 2) return result.slice(0, 2)

  // Fill from time-appropriate registry intents first
  const extras = INTENT_REGISTRY.filter(
    (i) =>
      i.id !== excludeIntentId
      && !result.find((r) => r.id === i.id)
      && i.preferredTimeOfDay.includes(timeOfDay),
  )
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2 - result.length)
    .map(({ id }) => ({ id, title: getIntentLabels(id, locale).title }))

  return [...result, ...extras]
}

/**
 * Dynamic fallback intents that never repeat previously suggested ones in the session.
 * Respects INTENT_CONFLICTS: never suggests an intent that conflicts with the current one.
 */
export function getDynamicFallbackIntents(
  excludeIntentId: string,
  previouslyUsed: Set<string>,
  timeOfDay: TimeOfDay,
  locale = 'en',
  maxResults = 4,
): Array<{ id: string; title: string }> {
  // Collect all intent IDs that conflict with the current intent
  const conflicting = new Set<string>()
  for (const [a, b] of INTENT_CONFLICTS) {
    if (a === excludeIntentId) conflicting.add(b)
    if (b === excludeIntentId) conflicting.add(a)
  }

  // 1. Time-appropriate, non-conflicting, not previously used
  const selected = new Set<string>()
  const result: Array<{ id: string; title: string }> = []

  const candidates = INTENT_REGISTRY
    .filter((i) =>
      i.id !== excludeIntentId
      && !conflicting.has(i.id)
      && i.preferredTimeOfDay.includes(timeOfDay),
    )
    .sort((a, b) => b.priority - a.priority)

  // Prefer unused intents first
  for (const i of candidates) {
    if (result.length >= maxResults) break
    if (previouslyUsed.has(i.id)) continue
    if (hasConflict(i.id, selected)) continue
    result.push({ id: i.id, title: getIntentLabels(i.id, locale).title })
    selected.add(i.id)
  }

  // Fill remaining with previously used (still time-appropriate, non-conflicting)
  if (result.length < maxResults) {
    for (const i of candidates) {
      if (result.length >= maxResults) break
      if (selected.has(i.id)) continue
      if (hasConflict(i.id, selected)) continue
      result.push({ id: i.id, title: getIntentLabels(i.id, locale).title })
      selected.add(i.id)
    }
  }

  return result
}
