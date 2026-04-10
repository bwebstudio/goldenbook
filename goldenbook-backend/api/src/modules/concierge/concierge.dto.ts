import type { ConciergeIntent, TimeOfDay } from './concierge.intents'
import { getIntentLabels } from './concierge.intents'
import type { UnifiedCandidate } from '../shared-scoring/types'

/** Accepts UnifiedCandidate (shared scoring) or any object with the same base fields */
type ScoredPlace = Pick<UnifiedCandidate, 'id' | 'slug' | 'name' | 'city_name' | 'place_type' | 'short_description' | 'editorial_summary' | 'featured' | 'hero_bucket' | 'hero_path'>

// ─── DTO contracts ────────────────────────────────────────────────────────────

export interface ConciergeIntentDTO {
  id: string
  title: string
  subtitle: string
  icon: string
  label: string | null
}

export interface ConciergeRecommendationDTO {
  id: string
  slug: string
  name: string
  city: string
  neighborhood: string | null
  /** Raw media asset — frontend calls getStorageUrl(bucket, path) to build the URL */
  heroImage: { bucket: string | null; path: string | null }
  shortDescription: string | null
  badges: string[]
  category: string
  // Booking — used by mobile reservation button
  bookingUrl: string | null
}

export interface ConciergeBootstrapDTO {
  city: { slug: string; name: string }
  timeOfDay: TimeOfDay
  greeting: string
  intents: ConciergeIntentDTO[]
}

export interface ConciergeRecommendResponseDTO {
  city: { slug: string; name: string }
  timeOfDay: TimeOfDay
  resolvedIntent: { id: string; title: string }
  responseText: string
  recommendations: ConciergeRecommendationDTO[]
  fallbackIntents: { id: string; title: string }[]
}

// ─── Badge i18n ───────────────────────────────────────────────────────────────

const BADGE_I18N: Record<string, Record<string, string>> = {
  "Editor's Pick":       { en: "Editor's Pick",       pt: 'Escolha do editor',    es: 'Selección del editor' },
  'Hidden Gem':          { en: 'Hidden Gem',           pt: 'Joia escondida',       es: 'Joya escondida' },
  'Exclusive Discovery': { en: 'Exclusive Discovery',  pt: 'Descoberta exclusiva', es: 'Descubrimiento exclusivo' },
  'Highly Recommended':  { en: 'Highly Recommended',   pt: 'Muito recomendado',    es: 'Muy recomendado' },
}

/** Tags that qualify a place for the "Exclusive Discovery" editorial badge */
const DISCOVERY_TAGS = new Set(['local-secret', 'culture', 'viewpoint'])

function localizeBadge(badge: string, locale: string): string {
  const localeFamily = locale.split('-')[0]
  const map = BADGE_I18N[badge]
  if (!map) return badge
  return map[locale] ?? map[localeFamily] ?? map['en'] ?? badge
}

// ─── Transformers ─────────────────────────────────────────────────────────────

export function toIntentDTO(intent: ConciergeIntent, locale = 'en'): ConciergeIntentDTO {
  const labels = getIntentLabels(intent.id, locale)
  return {
    id: intent.id,
    title: labels.title,
    subtitle: labels.subtitle,
    icon: intent.icon,
    label: labels.labels[0] ?? null,
  }
}

export function toRecommendationDTO(
  place: ScoredPlace,
  intent: ConciergeIntent,
  locale = 'en',
): ConciergeRecommendationDTO {
  const intentLabels = getIntentLabels(intent.id, locale)
  const rawBadges: string[] = []

  // Editorial badge logic:
  // 1. Featured places → "Editor's Pick"
  if (place.featured) rawBadges.push("Editor's Pick")

  // 2. Intent with "hidden" label → "Hidden Gem"
  if (intentLabels.labels[0]?.toLowerCase().includes('hidden')) rawBadges.push('Hidden Gem')

  // 3. "Exclusive Discovery" ONLY for places with genuine editorial discovery tags
  //    (local-secret, culture, viewpoint) — not just any restaurant
  const placeTags = ('context_tag_slugs' in place && Array.isArray((place as any).context_tag_slugs))
    ? (place as any).context_tag_slugs as string[]
    : []
  if (rawBadges.length === 0 && placeTags.some(t => DISCOVERY_TAGS.has(t))) {
    rawBadges.push('Exclusive Discovery')
  }

  // 4. Fallback: "Highly Recommended" for everything else
  if (rawBadges.length === 0) rawBadges.push('Highly Recommended')

  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    city: place.city_name,
    neighborhood: null, // V2 TODO: resolve from parent destination or place address
    heroImage: { bucket: place.hero_bucket, path: place.hero_path },
    shortDescription: place.short_description ?? place.editorial_summary ?? null,
    badges: rawBadges.map((b) => localizeBadge(b, locale)),
    category: place.place_type,
    bookingUrl: (place as any).booking_url ?? (place as any).website_url ?? null,
  }
}
