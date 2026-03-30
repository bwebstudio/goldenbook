import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getIntentById, getIntentLabels } from './concierge.intents'
import {
  toIntentDTO,
  toRecommendationDTO,
  type ConciergeBootstrapDTO,
  type ConciergeRecommendResponseDTO,
} from './concierge.dto'
import {
  getConciergeCity,
  getConciergeRecommendations,
  getDefaultConciergeCity,
} from './concierge.query'
import {
  buildGreeting,
  buildResponseText,
  getFallbackIntents,
  getBootstrapIntents,
  getDefaultIntent,
  getTimeOfDay,
  resolveIntentFromQuery,
  scoreConciergePlace,
} from './concierge.service'
import {
  type OnboardingProfile,
  parseInterests,
} from '../../shared/onboarding/onboarding.scoring'
import { getActiveVisibilityPlaceIds } from '../visibility/visibility.query'

// ─── Schema ───────────────────────────────────────────────────────────────────

const bootstrapQuerySchema = z.object({
  city:      z.string().min(1).optional(),
  locale:    z.string().min(2).max(5).default('en'),
  // Onboarding personalization — optional
  interests: z.string().optional(), // comma-separated interest IDs
  style:     z.string().optional(), // single exploration style ID
})

const recommendBodySchema = z.object({
  city:      z.string().min(1).optional(),
  intent:    z.string().min(1).optional(),
  query:     z.string().max(200).optional(),
  limit:     z.coerce.number().int().min(1).max(10).default(3),
  locale:    z.string().min(2).max(5).default('en'),
  // Onboarding personalization — optional
  interests: z.array(z.string()).optional(),
  style:     z.string().optional(),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function conciergeRoutes(app: FastifyInstance) {
  // ── GET /concierge/bootstrap ─────────────────────────────────────────────────
  //
  // Returns everything needed for the initial Concierge screen render:
  //   - resolved city
  //   - time of day
  //   - greeting copy (deterministic, no AI)
  //   - 3 curated intent cards for this city + time of day

  app.get('/concierge/bootstrap', async (request, reply) => {
    const { city: cityParam, locale, interests: rawInterests, style } =
      bootstrapQuerySchema.parse(request.query)

    const timeOfDay = getTimeOfDay()

    // Resolve city: param → DB → first available city → dev fallback (Lisbon)
    let city: { slug: string; name: string }
    if (cityParam) {
      city = (await getConciergeCity(cityParam, locale)) ?? (await getDefaultConciergeCity(locale))
    } else {
      city = await getDefaultConciergeCity(locale)
    }

    const profile: OnboardingProfile = {
      interests: parseInterests(rawInterests),
      style:     style ?? undefined,
    }

    const greeting = buildGreeting(timeOfDay, city.name, locale)
    const intents  = getBootstrapIntents(timeOfDay, profile)

    const response: ConciergeBootstrapDTO = {
      city,
      timeOfDay,
      greeting,
      intents: intents.map((i) => toIntentDTO(i, locale)),
    }

    return reply.send(response)
  })

  // ── POST /concierge/recommend ────────────────────────────────────────────────
  //
  // Resolves a recommendation request from either:
  //   - explicit intent id (from intent card tap)
  //   - free-text query (typed by user → mapped deterministically to an intent)
  //
  // Backend owns all recommendation logic. Frontend receives ready-to-render data.

  app.post('/concierge/recommend', async (request, reply) => {
    const { city: cityParam, intent: intentParam, query, limit, locale, interests, style } =
      recommendBodySchema.parse(request.body)

    if (!intentParam && !query) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'At least one of "intent" or "query" must be provided.',
      })
    }

    const timeOfDay = getTimeOfDay()

    // Resolve city
    let city: { slug: string; name: string }
    if (cityParam) {
      city = (await getConciergeCity(cityParam, locale)) ?? (await getDefaultConciergeCity(locale))
    } else {
      city = await getDefaultConciergeCity(locale)
    }

    // Resolve intent: explicit id → keyword resolution → time-based default
    let resolvedIntent = intentParam
      ? getIntentById(intentParam) ?? resolveIntentFromQuery(query ?? '', timeOfDay)
      : resolveIntentFromQuery(query!, timeOfDay)

    // Safety: always have a valid intent
    if (!resolvedIntent) {
      resolvedIntent = getDefaultIntent(timeOfDay)
    }

    const profile: OnboardingProfile = {
      interests: interests?.length ? interests : undefined,
      style:     style ?? undefined,
    }

    // Fetch candidate places from DB — fetch more than needed for scoring
    const fetchLimit = Math.max(limit * 3, 9)
    const candidates = await getConciergeRecommendations(
      city.slug,
      resolvedIntent,
      locale,
      fetchLimit,
    )

    // Get concierge boost IDs for priority bonus
    let boostIds: Set<string> = new Set()
    try {
      const ids = await getActiveVisibilityPlaceIds('concierge_boost', 20)
      boostIds = new Set(ids)
    } catch {}

    // Score candidates — boosted places get +25 priority bonus
    const scored = candidates
      .map((place) => ({
        place,
        score: scoreConciergePlace(place, resolvedIntent, profile) + (boostIds.has(place.id) ? 25 : 0),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ place }) => place)

    const responseText    = buildResponseText(resolvedIntent, city.name, timeOfDay, locale)
    const recommendations = scored.map((p) => toRecommendationDTO(p, resolvedIntent, locale))
    const fallbackIntents = getFallbackIntents(resolvedIntent.id, timeOfDay, locale)

    // Localized empty-results fallback
    const localeFamily = locale.split('-')[0]
    const emptyText = localeFamily === 'pt'
      ? `Não encontrei uma correspondência exacta, mas tenho algumas alternativas refinadas para a sua ${timeOfDay === 'morning' ? 'manhã' : timeOfDay === 'afternoon' ? 'tarde' : 'noite'} em ${city.name}.`
      : `I couldn't find an exact match just now, but I have a few refined alternatives for your ${timeOfDay} in ${city.name}.`

    // Localize resolved intent title for the response field
    const resolvedIntentTitle = getIntentLabels(resolvedIntent.id, locale).title

    // If empty, still return a graceful response with fallback intents
    const response: ConciergeRecommendResponseDTO = {
      city,
      timeOfDay,
      resolvedIntent: { id: resolvedIntent.id, title: resolvedIntentTitle },
      responseText: recommendations.length === 0 ? emptyText : responseText,
      recommendations,
      fallbackIntents,
    }

    return reply.send(response)
  })
}
