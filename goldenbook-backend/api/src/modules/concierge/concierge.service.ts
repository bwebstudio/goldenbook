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
}

export function buildGreeting(timeOfDay: TimeOfDay, cityName: string, locale = 'en'): string {
  const localeFamily = locale.split('-')[0]
  const map = GREETINGS_I18N[locale] ?? GREETINGS_I18N[localeFamily] ?? GREETINGS_I18N['en']
  return map[timeOfDay](cityName)
}

// ─── Bootstrap intents ────────────────────────────────────────────────────────

const BOOTSTRAP_INTENTS: Record<TimeOfDay, string[]> = {
  morning: ['coffee_and_work', 'hidden_gems', 'gallery_afternoon'],
  afternoon: ['long_lunch', 'gallery_afternoon', 'design_shopping'],
  evening: ['romantic_dinner', 'cocktail_bars', 'late_night_jazz'],
}

export function getBootstrapIntents(
  timeOfDay: TimeOfDay,
  profile?: OnboardingProfile,
): ConciergeIntent[] {
  // No profile — return the curated static selection unchanged
  if (!hasProfile(profile)) {
    return BOOTSTRAP_INTENTS[timeOfDay]
      .map((id) => getIntentById(id))
      .filter((i): i is ConciergeIntent => i != null)
  }

  // Profile present — score all time-appropriate intents and pick top 3.
  // priority * 0.1 is a tie-breaker (mirrors resolveIntentFromQuery).
  const candidates = INTENT_REGISTRY.filter((i) =>
    i.preferredTimeOfDay.includes(timeOfDay),
  )

  return candidates
    .map((intent) => ({
      intent,
      score:
        scoreIntentForProfile(intent.tags, intent.keywords, profile!) +
        intent.priority * 0.1,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ intent }) => intent)
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
}

export function scoreConciergePlace(
  place: ScoredPlace,
  intent: ConciergeIntent,
  profile?: OnboardingProfile,
): number {
  // Base: intent-specific relevance only
  let baseScore = 0

  if (intent.placeTypes.includes(place.place_type)) baseScore += 12

  const textContent = [place.short_description, place.editorial_summary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const tag of intent.tags) {
    if (textContent.includes(tag.toLowerCase())) baseScore += 6
  }

  // Delegate business / quality / onboarding to the shared ranking model
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

  // Fill from the full registry if not enough bootstrap intents remain
  const extras = INTENT_REGISTRY.filter(
    (i) =>
      i.id !== excludeIntentId && !result.find((r) => r.id === i.id),
  )
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2 - result.length)
    .map(({ id }) => ({ id, title: getIntentLabels(id, locale).title }))

  return [...result, ...extras]
}
