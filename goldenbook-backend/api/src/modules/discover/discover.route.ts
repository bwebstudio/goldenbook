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
} from './discover.query'
import { toDiscoverDTO, getTimeSegment, pickNowRecommendation } from './discover.dto'
import {
  type OnboardingProfile,
  parseInterests,
  rerankPlaces,
} from '../../shared/ranking/place.ranking'

const querySchema = z.object({
  city:      z.string().min(1),
  locale:    z.string().min(2).max(5).default('en'),
  // Onboarding personalization — optional, fully backward-compatible
  interests: z.string().optional(), // comma-separated interest IDs
  style:     z.string().optional(), // single exploration style ID
})

export async function discoverRoutes(app: FastifyInstance) {
  app.get('/discover', async (request, reply) => {
    const { city, locale, interests: rawInterests, style } = querySchema.parse(request.query)

    const cityHeader = await getCityHeader(city, locale)
    if (!cityHeader) throw new NotFoundError('City')

    const nowSegment = getTimeSegment(new Date().getHours())

    // Build onboarding profile — empty object if params absent (scoring no-ops safely)
    const profile: OnboardingProfile = {
      interests: parseInterests(rawInterests),
      style:     style ?? undefined,
    }

    const [hero, hiddenSpots, editorsPicks, categories, goldenRoutes, newPlaces, nowCandidates] =
      await Promise.all([
        getEditorialHero(city, locale),
        getHiddenSpots(city, locale),
        getEditorsPicks(city, locale),
        getDiscoverCategories(city, locale),
        getGoldenRoutes(city, locale),
        getNewPlaces(city, locale),
        getNowCandidates(city, locale),
      ])

    // Re-rank place lists by full ranking model (no-op when profile is empty and quality fields absent)
    const rankedHiddenSpots  = rerankPlaces(hiddenSpots,  'discover', profile)
    const rankedEditorsPicks = rerankPlaces(editorsPicks, 'discover', profile)
    const rankedNewPlaces    = rerankPlaces(newPlaces,    'discover', profile)

    const nowPick = pickNowRecommendation(nowCandidates, nowSegment, profile)

    return reply.send(
      toDiscoverDTO(cityHeader, hero, rankedHiddenSpots, rankedEditorsPicks, categories, goldenRoutes, rankedNewPlaces, nowPick, nowSegment),
    )
  })
}
