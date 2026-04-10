import type {
  CityHeaderRow,
  EditorialHeroRow,
  PlaceCardRow,
  DiscoverCategoryRow,
  RouteCardRow,
  NowCandidateRow,
} from './discover.query'
import {
  type OnboardingProfile,
  scoreFinalPlace,
} from '../../shared/ranking/place.ranking'

// ─── Time segment ─────────────────────────────────────────────────────────────
//
// Canonical NOW time windows (matches now.scoring.ts + audit eligibility matrix):
//   morning      08–11
//   midday       11–15
//   afternoon    15–18
//   evening      18–23
//   late_evening 23–02
//   deep_night   02–07
//
// Legacy `night` is kept for backwards compatibility with older callers.

export type TimeSegment =
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'evening'
  | 'late_evening'
  | 'deep_night'
  | 'night'

export function getTimeSegment(hour: number): TimeSegment {
  if (hour >= 8  && hour < 11) return 'morning'
  if (hour >= 11 && hour < 15) return 'midday'
  if (hour >= 15 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 23) return 'evening'
  if (hour >= 23 || hour < 2)  return 'late_evening'
  if (hour >= 2  && hour < 7)  return 'deep_night'
  return 'morning' // 07–08 transition
}

// Category slugs that resonate for each time segment.
// Must match real DB values: activities, beaches, culture, events, gastronomy, shops, sports, transport
const SEGMENT_CATEGORIES: Record<TimeSegment, string[]> = {
  morning:      ['sports', 'activities', 'beaches', 'culture'],
  midday:       ['gastronomy', 'culture', 'activities', 'events'],
  afternoon:    ['shops', 'gastronomy', 'culture', 'events'],
  evening:      ['gastronomy', 'events', 'activities', 'culture'],
  late_evening: ['gastronomy', 'events', 'activities'],
  deep_night:   ['gastronomy', 'events'],
  night:        ['gastronomy', 'events', 'activities'],
}

function scoreNowCandidate(
  row: NowCandidateRow,
  segment: TimeSegment,
  profile?: OnboardingProfile,
): number {
  // Base: time-segment keyword matching only
  const keywords = SEGMENT_CATEGORIES[segment]
  const matchCount = row.category_slugs.filter((slug) =>
    keywords.some((kw) => slug.toLowerCase().includes(kw)),
  ).length
  const baseScore = matchCount * 20

  // Delegate business/quality/onboarding to the shared ranking model
  return scoreFinalPlace(
    baseScore,
    {
      featured:      row.featured,
      category_slugs: row.category_slugs,
      hero_bucket:   row.image_bucket,
      hero_path:     row.image_path,
    },
    'now',
    profile,
  )
}

export function pickNowRecommendation(
  candidates: NowCandidateRow[],
  segment: TimeSegment,
  profile?: OnboardingProfile,
  excludeIds?: Set<string>,
): NowCandidateRow | null {
  const pool = excludeIds ? candidates.filter((c) => !excludeIds.has(c.id)) : candidates
  if (pool.length === 0) return null
  return [...pool].sort(
    (a, b) => scoreNowCandidate(b, segment, profile) - scoreNowCandidate(a, segment, profile),
  )[0]
}

// ─── Shared DTOs ──────────────────────────────────────────────────────────────

interface MediaAssetDTO { bucket: string | null; path: string | null }

interface PlaceCardDTO {
  id: string
  slug: string
  name: string
  heroImage: MediaAssetDTO
  shortDescription: string | null
  placeType: string | null
  cityName: string | null
  categoryName: string | null
  subcategoryName: string | null
  isSponsored?: boolean
}

function toPlaceCard(row: PlaceCardRow): PlaceCardDTO {
  const dto: PlaceCardDTO = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    heroImage: { bucket: row.hero_bucket, path: row.hero_path },
    shortDescription: row.short_description,
    placeType: row.place_type ?? null,
    cityName: row.city_name ?? null,
    categoryName: row.category_name ?? null,
    subcategoryName: row.subcategory_name ?? null,
  }
  if (row.is_sponsored) dto.isSponsored = true
  return dto
}

// ─── Discover DTO ─────────────────────────────────────────────────────────────

export interface NowRecommendationDTO {
  slug: string
  name: string
  image: MediaAssetDTO
  categorySlugs: string[]
  featured: boolean
  timeSegment: TimeSegment
}

export interface DiscoverDTO {
  cityHeader: {
    slug: string
    name: string
    country: string
    heroImage: MediaAssetDTO
  }
  search: { placeholder: string }
  nowRecommendation: NowRecommendationDTO | null
  editorialHero: {
    title: string
    subtitle: null
    ctaLabel: null
    image: MediaAssetDTO
    target: { type: 'place'; slug: string }
  } | null
  hiddenSpotsNearYou: PlaceCardDTO[]
  editorsPicks: PlaceCardDTO[]
  categories: {
    id: string
    slug: string
    name: string
    iconName: string | null
  }[]
  goldenRoutes: {
    id: string
    slug: string
    title: string
    summary: string | null
    heroImage: MediaAssetDTO
    placesCount: number
  }[]
  newOnGoldenbook: PlaceCardDTO[]
}

const SEARCH_PLACEHOLDERS: Record<string, string> = {
  en: 'Search destinations, places, experiences',
  es: 'Busca destinos, lugares, experiencias',
  pt: 'Pesquisar destinos, lugares, experiências',
}

export function toDiscoverDTO(
  city: CityHeaderRow,
  hero: EditorialHeroRow | null,
  hiddenSpots: PlaceCardRow[],
  editorsPicks: PlaceCardRow[],
  categories: DiscoverCategoryRow[],
  goldenRoutes: RouteCardRow[],
  newPlaces: PlaceCardRow[],
  nowPick: NowCandidateRow | null,
  nowSegment: TimeSegment,
  locale = 'en',
): DiscoverDTO {
  const localeFamily = locale.split('-')[0]
  return {
    cityHeader: {
      slug: city.slug,
      name: city.name,
      country: city.country,
      heroImage: { bucket: city.hero_bucket, path: city.hero_path },
    },
    search: {
      placeholder: SEARCH_PLACEHOLDERS[localeFamily] ?? SEARCH_PLACEHOLDERS['en'],
    },
    nowRecommendation: nowPick
      ? {
          slug: nowPick.slug,
          name: nowPick.name,
          image: { bucket: nowPick.image_bucket, path: nowPick.image_path },
          categorySlugs: nowPick.category_slugs,
          featured: nowPick.featured,
          timeSegment: nowSegment,
        }
      : null,
    editorialHero: hero
      ? {
          title: hero.title,
          subtitle: null,
          ctaLabel: null,
          image: { bucket: hero.image_bucket, path: hero.image_path },
          target: { type: 'place', slug: hero.target_slug },
        }
      : null,
    hiddenSpotsNearYou: hiddenSpots.map(toPlaceCard),
    editorsPicks: editorsPicks.map(toPlaceCard),
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      iconName: c.icon_name,
    })),
    goldenRoutes: goldenRoutes.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      heroImage: { bucket: r.hero_bucket, path: r.hero_path },
      placesCount: r.places_count,
    })),
    newOnGoldenbook: newPlaces.map(toPlaceCard),
  }
}
