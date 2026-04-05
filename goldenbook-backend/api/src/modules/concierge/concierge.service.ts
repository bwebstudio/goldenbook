// ─── Concierge Service ────────────────────────────────────────────────────────
//
// Pure deterministic logic — no external services, no AI.
// All recommendation resolution and scoring lives here.

import {
  ConciergeIntent,
  INTENT_REGISTRY,
  TimeOfDay,
  getIntentById,
  getIntentLabels,
} from './concierge.intents'
import {
  type OnboardingProfile,
  hasProfile,
  scoreIntentForProfile,
  scoreFinalPlace,
} from '../../shared/ranking/place.ranking'
import {
  TIME_TAG_BOOSTS,
  WEATHER_TAG_BOOSTS,
  type ContextTag,
  type NowTimeOfDay,
  type WeatherCondition,
} from '../shared-scoring/context-tags'

// ─── Time of day ──────────────────────────────────────────────────────────────

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

type GreetingFn = (city: string) => string

const GREETINGS_I18N: Record<string, Record<TimeOfDay, GreetingFn>> = {
  en: {
    morning:   (city) => `Good morning. I have curated a few elegant starts for your day in ${city}.`,
    afternoon: (city) => `Good afternoon. I've prepared a few refined selections for your afternoon in ${city}.`,
    evening:   (city) => `Good evening. I have curated some selections for your night in ${city}. What would you prefer?`,
  },
  pt: {
    morning:   (city) => `Bom dia. Selecionei alguns começos de dia elegantes para si em ${city}.`,
    afternoon: (city) => `Boa tarde. Preparei algumas escolhas refinadas para a sua tarde em ${city}.`,
    evening:   (city) => `Boa noite. Selecionei algumas propostas para a sua noite em ${city}. O que prefere?`,
  },
  es: {
    morning:   (city) => `Buenos días. He seleccionado algunos comienzos elegantes para tu día en ${city}.`,
    afternoon: (city) => `Buenas tardes. He preparado algunas opciones refinadas para tu tarde en ${city}.`,
    evening:   (city) => `Buenas noches. He seleccionado algunas propuestas para tu noche en ${city}. ¿Qué prefieres?`,
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
function toNowTimeOfDay(tod: TimeOfDay): NowTimeOfDay {
  if (tod === 'morning') return 'morning'
  if (tod === 'afternoon') return 'afternoon'
  return 'evening'
}

/**
 * Score an intent against the current context using the shared tag boost maps.
 * Intents with tags that match high-boost context tags score higher.
 */
function scoreIntentForContext(
  intent: ConciergeIntent,
  timeOfDay: TimeOfDay,
  weather?: string | null,
): number {
  const nowTod = toNowTimeOfDay(timeOfDay)
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

export function getBootstrapIntents(
  timeOfDay: TimeOfDay,
  profile?: OnboardingProfile,
  weather?: string | null,
): ConciergeIntent[] {
  // Score ALL intents matching this time of day against the full context
  const candidates = INTENT_REGISTRY.filter((i) =>
    i.preferredTimeOfDay.includes(timeOfDay),
  )

  const scored = candidates.map((intent) => {
    let score = scoreIntentForContext(intent, timeOfDay, weather)

    // Profile alignment bonus
    if (hasProfile(profile)) {
      score += scoreIntentForProfile(intent.tags, intent.keywords, profile!) * 0.5
    }

    // Priority tie-breaker
    score += intent.priority * 0.1

    return { intent, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ intent }) => intent)
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

  const scores = new Map<string, number>()

  for (const intent of INTENT_REGISTRY) {
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
      // Bonus for time-of-day relevance
      if (intent.preferredTimeOfDay.includes(timeOfDay)) score += 2
      // Tie-breaking via curated priority
      score += intent.priority * 0.1
      scores.set(intent.id, score)
    }
  }

  if (scores.size === 0) return getDefaultIntent(timeOfDay)

  const topId = [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0]
  return getIntentById(topId) ?? getDefaultIntent(timeOfDay)
}

const DEFAULT_INTENTS: Record<TimeOfDay, string> = {
  morning: 'coffee_and_work',
  afternoon: 'long_lunch',
  evening: 'cocktail_bars',
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
  }

  // 4. Time window boost
  if (timeOfDay && place.time_window_slugs?.length) {
    const windowsForTime: Record<TimeOfDay, string[]> = {
      morning:   ['morning', 'midday'],
      afternoon: ['midday', 'afternoon'],
      evening:   ['evening', 'night'],
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
    romantic_dinner:    (city)       => `For an elegant evening in ${city}, I've selected a few atmospheric addresses.`,
    quiet_wine_bar:     (city)       => `A few refined wine bars for a slower, more elegant pace in ${city}.`,
    late_night_jazz:    (city)       => `For sophisticated music after dark in ${city}, here are my selections.`,
    cocktail_bars:      (city, tod)  => `Here are some of ${city}'s finest cocktail addresses for this ${tod}.`,
    hidden_gems:        (city)       => `A few of ${city}'s best-kept secrets, away from the usual paths.`,
    coffee_and_work:    (city)       => `My selections for a refined morning in ${city}.`,
    sunset_drinks:      (city)       => `The finest terraces and rooftops for the golden hour in ${city}.`,
    long_lunch:         (city)       => `For an unhurried midday in ${city}, here are my selections.`,
    gallery_afternoon:  (city)       => `A curated afternoon of art and culture in ${city}.`,
    design_shopping:    (city)       => `A few curated boutiques and concept stores in ${city}.`,
    after_dinner_drinks:(city)       => `To cap your evening in ${city}, here are my selections.`,
  },
  pt: {
    romantic_dinner:    (city)       => `Para uma noite elegante em ${city}, selecionei alguns endereços especiais.`,
    quiet_wine_bar:     (city)       => `Alguns bares de vinho refinados para um ritmo mais tranquilo em ${city}.`,
    late_night_jazz:    (city)       => `Para uma noite de música sofisticada em ${city}, eis as minhas sugestões.`,
    cocktail_bars:      (city, tod)  => `Os melhores endereços de cocktails de ${city} para esta ${tod === 'afternoon' ? 'tarde' : 'noite'}.`,
    hidden_gems:        (city)       => `Alguns dos segredos mais bem guardados de ${city}, longe dos percursos habituais.`,
    coffee_and_work:    (city)       => `As minhas sugestões para uma manhã refinada em ${city}.`,
    sunset_drinks:      (city)       => `Os melhores terraços e rooftops para a hora dourada em ${city}.`,
    long_lunch:         (city)       => `Para um almoço tranquilo em ${city}, eis as minhas sugestões.`,
    gallery_afternoon:  (city)       => `Uma tarde curada de arte e cultura em ${city}.`,
    design_shopping:    (city)       => `Algumas boutiques e concept stores selecionadas em ${city}.`,
    after_dinner_drinks:(city)       => `Para terminar a noite em ${city}, eis as minhas sugestões.`,
  },
  es: {
    romantic_dinner:    (city)       => `Para una noche elegante en ${city}, he seleccionado algunas direcciones especiales.`,
    quiet_wine_bar:     (city)       => `Algunos bares de vino refinados para un ritmo más tranquilo en ${city}.`,
    late_night_jazz:    (city)       => `Para música sofisticada por la noche en ${city}, estas son mis sugerencias.`,
    cocktail_bars:      (city, tod)  => `Aquí tienes algunos de los mejores bares de cócteles de ${city} para esta ${tod === 'afternoon' ? 'tarde' : 'noche'}.`,
    hidden_gems:        (city)       => `Algunos de los secretos mejor guardados de ${city}, lejos de las rutas habituales.`,
    coffee_and_work:    (city)       => `Mis recomendaciones para una mañana refinada en ${city}.`,
    sunset_drinks:      (city)       => `Las mejores terrazas y rooftops para la hora dorada en ${city}.`,
    long_lunch:         (city)       => `Para un almuerzo sin prisas en ${city}, aquí tienes mis recomendaciones.`,
    gallery_afternoon:  (city)       => `Una tarde curada de arte y cultura en ${city}.`,
    design_shopping:    (city)       => `Algunas boutiques y concept stores seleccionadas en ${city}.`,
    after_dinner_drinks:(city)       => `Para cerrar la noche en ${city}, aquí tienes mis recomendaciones.`,
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
  const bootstrapIds = BOOTSTRAP_INTENTS[timeOfDay].filter(
    (id) => id !== excludeIntentId,
  )

  const result = bootstrapIds
    .map((id) => getIntentById(id))
    .filter((i): i is ConciergeIntent => i != null)
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
 */
export function getDynamicFallbackIntents(
  excludeIntentId: string,
  previouslyUsed: Set<string>,
  timeOfDay: TimeOfDay,
  locale = 'en',
): Array<{ id: string; title: string }> {
  // Start with bootstrap intents for this time of day
  const bootstrapIds = BOOTSTRAP_INTENTS[timeOfDay].filter(
    (id) => id !== excludeIntentId && !previouslyUsed.has(id),
  )

  const result = bootstrapIds
    .map((id) => getIntentById(id))
    .filter((i): i is ConciergeIntent => i != null)
    .map(({ id }) => ({ id, title: getIntentLabels(id, locale).title }))

  if (result.length >= 2) return result.slice(0, 2)

  // Fill from time-appropriate registry intents, excluding previously used
  const extras = INTENT_REGISTRY.filter(
    (i) =>
      i.id !== excludeIntentId
      && !previouslyUsed.has(i.id)
      && !result.find((r) => r.id === i.id)
      && i.preferredTimeOfDay.includes(timeOfDay),
  )
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2 - result.length)
    .map(({ id }) => ({ id, title: getIntentLabels(id, locale).title }))

  const combined = [...result, ...extras]

  // If still < 2 (time-appropriate intents exhausted), allow any remaining
  if (combined.length < 2) {
    const fillers = INTENT_REGISTRY.filter(
      (i) =>
        i.id !== excludeIntentId
        && !combined.find((c) => c.id === i.id)
        && i.preferredTimeOfDay.includes(timeOfDay),
    )
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 2 - combined.length)
      .map(({ id }) => ({ id, title: getIntentLabels(id, locale).title }))
    return [...combined, ...fillers]
  }

  return combined
}
