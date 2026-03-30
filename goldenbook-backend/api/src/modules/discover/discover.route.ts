import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { NotFoundError } from '../../shared/errors/AppError'
import {
  getCityHeader,
  getEditorialHero,
  getEditorsPicks,
  getHiddenSpots,
  getNewPlaces,
  getDiscoverCategories,
  getGoldenRoutes,
  getNowCandidates,
  type PlaceCardRow,
  type NowCandidateRow,
} from './discover.query'
import { toDiscoverDTO, getTimeSegment, pickNowRecommendation, type TimeSegment } from './discover.dto'
import {
  type OnboardingProfile,
  type RankingSurface,
  parseInterests,
  rerankPlaces,
} from '../../shared/ranking/place.ranking'
import { getActiveVisibilityPlaceIds, getActiveVisibilityBySlot } from '../visibility/visibility.query'

const querySchema = z.object({
  city:      z.string().min(1),
  locale:    z.string().min(2).max(5).default('en'),
  interests: z.string().optional(),
  style:     z.string().optional(),
})

/** Map time segment to now placement slot */
function segmentToSlot(segment: TimeSegment): string {
  switch (segment) {
    case 'morning': return 'morning'
    case 'midday':  return 'afternoon'
    case 'afternoon': return 'afternoon'
    case 'evening': return 'dinner'
    case 'night':   return 'night'
  }
}

export async function discoverRoutes(app: FastifyInstance) {
  app.get('/discover', async (request, reply) => {
    const { city, locale, interests: rawInterests, style } = querySchema.parse(request.query)

    const cityHeader = await getCityHeader(city, locale)
    if (!cityHeader) throw new NotFoundError('City')

    const nowSegment = getTimeSegment(new Date().getHours())

    const profile: OnboardingProfile = {
      interests: parseInterests(rawInterests),
      style:     style ?? undefined,
    }

    const [hero, hiddenSpots, editorsPicks, categories, goldenRoutes, newPlaces, nowCandidates] =
      await Promise.all([
        getEditorialHero(city, locale),
        getHiddenSpots(city, locale),
        getEditorsPicks(city, locale, 5), // Golden Picks: 5 slots
        getDiscoverCategories(city, locale),
        getGoldenRoutes(city, locale),
        getNewPlaces(city, locale),
        getNowCandidates(city, locale),
      ])

    // Fetch sponsored/pinned place IDs for each surface
    let pinnedPickIds: Set<string> = new Set()
    let pinnedSpotIds: Set<string> = new Set()
    let pinnedNewIds: Set<string> = new Set()
    try {
      const [pickIds, spotIds, newIds] = await Promise.all([
        getActiveVisibilityPlaceIds('golden_picks', 5),
        getActiveVisibilityPlaceIds('hidden_spots', 1), // max 1 sponsored in visible block
        getActiveVisibilityPlaceIds('new_on_goldenbook', 1),
      ])
      pinnedPickIds = new Set(pickIds)
      pinnedSpotIds = new Set(spotIds)
      pinnedNewIds = new Set(newIds)
    } catch {}

    // Re-rank with pinned, then apply rotation for non-pinned
    const rankedEditorsPicks = rerankWithPinned(editorsPicks, pinnedPickIds, 'golden_picks', profile)
    const rankedHiddenSpots  = rerankWithPinned(hiddenSpots, pinnedSpotIds, 'discover', profile)
    const rankedNewPlaces    = rerankWithPinned(newPlaces, pinnedNewIds, 'discover', profile)

    // Mark sponsored items
    markSponsored(rankedEditorsPicks, pinnedPickIds)
    markSponsored(rankedHiddenSpots, pinnedSpotIds)
    markSponsored(rankedNewPlaces, pinnedNewIds)

    // Now recommendation: slot-based sponsored → generic sponsored → scoring
    let nowPick: NowCandidateRow | null = null
    try {
      // Try slot-specific sponsored first (e.g. now + morning)
      const slot = segmentToSlot(nowSegment)
      const slotIds = await getActiveVisibilityBySlot('now', slot, 1)
      if (slotIds.length > 0) {
        nowPick = nowCandidates.find(c => c.id === slotIds[0]) ?? null
      }
      // Fallback to any now placement without slot
      if (!nowPick) {
        const genericIds = await getActiveVisibilityPlaceIds('now', 1)
        if (genericIds.length > 0) {
          nowPick = nowCandidates.find(c => c.id === genericIds[0]) ?? null
        }
      }
    } catch {}
    if (!nowPick) {
      nowPick = pickNowRecommendation(nowCandidates, nowSegment, profile)
    }

    return reply.send(
      toDiscoverDTO(cityHeader, hero, rankedHiddenSpots, rankedEditorsPicks, categories, goldenRoutes, rankedNewPlaces, nowPick, nowSegment),
    )
  })
}

// Keep pinned places at the top, rerank the rest with slight rotation
function rerankWithPinned<T extends { id: string }>(
  places: T[],
  pinnedIds: Set<string>,
  surface: RankingSurface,
  profile: OnboardingProfile,
): T[] {
  if (pinnedIds.size === 0) {
    const ranked = rerankPlaces(places, surface, profile)
    return applyRotation(ranked)
  }

  const pinned = places.filter(p => pinnedIds.has(p.id))
  const rest = places.filter(p => !pinnedIds.has(p.id))
  const rankedRest = rerankPlaces(rest, surface, profile)
  return [...pinned, ...applyRotation(rankedRest)]
}

/** Light rotation: shuffle items with similar scores so the feed doesn't feel static */
function applyRotation<T>(items: T[]): T[] {
  if (items.length <= 2) return items
  // Use day-of-year as seed so rotation changes daily but stays stable within a day
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
  const rotated = [...items]
  // Rotate by dayOfYear mod length, keeping first item stable
  const first = rotated.shift()!
  const offset = dayOfYear % rotated.length
  const reordered = [...rotated.slice(offset), ...rotated.slice(0, offset)]
  return [first, ...reordered]
}

/** Tag places from visibility as sponsored */
function markSponsored(places: PlaceCardRow[], sponsoredIds: Set<string>): void {
  for (const p of places) {
    if (sponsoredIds.has(p.id)) p.is_sponsored = true
  }
}
