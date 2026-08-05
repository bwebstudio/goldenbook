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
import { normalizeLocale } from '../../shared/i18n/locale'
import { getExposureMap, rotationBoost } from '../shared-scoring/exposure'

const querySchema = z.object({
  city:      z.string().min(1),
  // PT canonical default — see modules/admin/places/translation-policy.ts.
  locale:    z.string().min(2).max(5).default('pt'),
  interests: z.string().optional(),
  style:     z.string().optional(),
})

/** Map time segment to now placement slot */
function segmentToSlot(segment: TimeSegment): string {
  switch (segment) {
    case 'morning':      return 'morning'
    case 'midday':       return 'afternoon'
    case 'afternoon':    return 'afternoon'
    case 'evening':      return 'dinner'
    case 'late_evening': return 'dinner'
    case 'deep_night':   return 'night'
    case 'night':        return 'night'
  }
}

export async function discoverRoutes(app: FastifyInstance) {
  app.get('/discover', async (request, reply) => {
    const { city, locale: rawLocale, interests: rawInterests, style } = querySchema.parse(request.query)
    const locale = normalizeLocale(rawLocale)

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

    // How long each of these places has gone unseen. One query for the whole
    // feed; the rollup table is tiny and already indexed on place_id.
    let exposure = new Map<string, Date | null>()
    try {
      exposure = await getExposureMap([
        ...editorsPicks.map(p => p.id),
        ...hiddenSpots.map(p => p.id),
        ...newPlaces.map(p => p.id),
      ])
    } catch {
      // Rotation is an enhancement, never a dependency. An empty map means
      // every place scores the same lift, which leaves the existing ranking
      // exactly as it was.
    }

    // Re-rank with pinned, then apply rotation for non-pinned
    const rankedEditorsPicks = rerankWithPinned(editorsPicks, pinnedPickIds, 'golden_picks', profile, exposure)
    const rankedHiddenSpots  = rerankWithPinned(hiddenSpots, pinnedSpotIds, 'discover', profile, exposure)
    const rankedNewPlaces    = rerankWithPinned(newPlaces, pinnedNewIds, 'discover', profile, exposure)

    // Mark sponsored items
    markSponsored(rankedEditorsPicks, pinnedPickIds)
    markSponsored(rankedHiddenSpots, pinnedSpotIds)
    markSponsored(rankedNewPlaces, pinnedNewIds)

    // Now recommendation: slot-based sponsored → generic sponsored → scoring
    let nowPick: NowCandidateRow | null = null
    let nowIsSponsored = false
    try {
      // Try slot-specific sponsored first (e.g. now + morning)
      const slot = segmentToSlot(nowSegment)
      const slotIds = await getActiveVisibilityBySlot('now', slot, 1)
      if (slotIds.length > 0) {
        nowPick = nowCandidates.find(c => c.id === slotIds[0]) ?? null
        if (nowPick) nowIsSponsored = true
      }
      // Fallback to any now placement without slot
      if (!nowPick) {
        const genericIds = await getActiveVisibilityPlaceIds('now', 1)
        if (genericIds.length > 0) {
          nowPick = nowCandidates.find(c => c.id === genericIds[0]) ?? null
          if (nowPick) nowIsSponsored = true
        }
      }
    } catch {}
    if (!nowPick) {
      nowPick = pickNowRecommendation(nowCandidates, nowSegment, profile)
    }

    // ── Dedup: NOW place must not appear in Golden Picks ──────────────────
    const nowPlaceId = nowPick?.id ?? null
    const dedupedEditorsPicks = nowPlaceId
      ? rankedEditorsPicks.filter((p) => p.id !== nowPlaceId)
      : rankedEditorsPicks

    return reply.send(
      toDiscoverDTO(cityHeader, hero, rankedHiddenSpots, dedupedEditorsPicks, categories, goldenRoutes, rankedNewPlaces, nowPick, nowSegment, locale, nowIsSponsored),
    )
  })
}

// Keep pinned places at the top, rerank the rest with slight rotation
function rerankWithPinned<T extends { id: string }>(
  places: T[],
  pinnedIds: Set<string>,
  surface: RankingSurface,
  profile: OnboardingProfile,
  exposure: Map<string, Date | null>,
): T[] {
  if (pinnedIds.size === 0) {
    const ranked = rerankPlaces(places, surface, profile)
    return applyRotation(ranked, exposure)
  }

  const pinned = places.filter(p => pinnedIds.has(p.id))
  const rest = places.filter(p => !pinnedIds.has(p.id))
  const rankedRest = rerankPlaces(rest, surface, profile)
  return [...pinned, ...applyRotation(rankedRest, exposure)]
}

/**
 * Rotation, weighted by how long each place has gone unseen.
 *
 * The previous version shuffled by day-of-year. It changed the order daily,
 * which made the feed feel alive, but it had no idea what anyone had actually
 * looked at, so a place sitting at the bottom of the pool stayed at the bottom
 * of every permutation. On 5 Aug 2026 that had left 114 of 346 published
 * places never opened by a single user.
 *
 * This keeps the same two guarantees the old one had: the top item never
 * moves (relevance still wins the first slot, and pinned placements are
 * handled by the caller), and the order is stable for the whole day so a
 * pull-to-refresh doesn't reshuffle under the user's thumb. What changes is
 * the tiebreak: among the rest, longer-unseen places move up.
 */
function applyRotation<T extends { id: string }>(
  items: T[],
  exposure: Map<string, Date | null>,
): T[] {
  if (items.length <= 2) return items

  // Day-of-year still seeds the shuffle, so two places with the same lift
  // swap places from one day to the next instead of freezing in one order.
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)

  const rest = [...items]
  const first = rest.shift()!

  const reordered = rest
    .map((item, index) => ({
      item,
      // exposure.get() returning undefined (place absent from the rollup)
      // means never seen, which is exactly what rotationBoost treats null as.
      lift: rotationBoost(exposure.get(item.id) ?? null),
      tiebreak: (index + dayOfYear) % rest.length,
    }))
    .sort((a, b) => (b.lift - a.lift) || (a.tiebreak - b.tiebreak))
    .map(x => x.item)

  return [first, ...reordered]
}

/** Tag places from visibility as sponsored */
function markSponsored(places: PlaceCardRow[], sponsoredIds: Set<string>): void {
  for (const p of places) {
    if (sponsoredIds.has(p.id)) p.is_sponsored = true
  }
}
