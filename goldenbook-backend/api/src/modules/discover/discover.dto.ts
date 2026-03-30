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

export type TimeSegment = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

export function getTimeSegment(hour: number): TimeSegment {
  if (hour >= 6 && hour <= 10) return 'morning'
  if (hour >= 11 && hour <= 14) return 'midday'
  if (hour >= 15 && hour <= 18) return 'afternoon'
  if (hour >= 19 && hour <= 21) return 'evening'
  return 'night'
}

// Category slugs that resonate for each time segment.
// Must match real DB values: activities, beaches, culture, events, gastronomy, shops, sports, transport
const SEGMENT_CATEGORIES: Record<TimeSegment, string[]> = {
  morning:   ['sports', 'activities', 'beaches', 'culture'],
  midday:    ['gastronomy', 'culture', 'activities', 'events'],
  afternoon: ['shops', 'gastronomy', 'culture', 'events'],
  evening:   ['gastronomy', 'events', 'activities', 'culture'],
  night:     ['gastronomy', 'events', 'activities'],
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
  isSponsored?: boolean
}

function toPlaceCard(row: PlaceCardRow): PlaceCardDTO {
  const dto: PlaceCardDTO = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    heroImage: { bucket: row.hero_bucket, path: row.hero_path },
    shortDescription: row.short_description,
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
): DiscoverDTO {
  return {
    cityHeader: {
      slug: city.slug,
      name: city.name,
      country: city.country,
      heroImage: { bucket: city.hero_bucket, path: city.hero_path },
    },
    search: {
      placeholder: 'Search destinations, places, experiences',
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
