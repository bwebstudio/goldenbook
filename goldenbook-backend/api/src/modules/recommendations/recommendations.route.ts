import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateBusinessClient } from '../../shared/auth/businessAuth'
import { authenticateDashboardUser } from '../../shared/auth/dashboardAuth'
import { getPlaceRecommendations, getAdminInsights } from './recommendations.service'
import { recommendRequestSchema, type RecommendResponse } from './recommendations.dto'
import { getCandidates, getCandidatesMultiCity, logRankingDebug } from './recommendations.query'
import { rank, timeToWindow, timeToTimeOfDay } from './recommendations.engine'
import { parseIntent, resolveIntent } from './intent-engine'

// ─── City timezone mapping ────────────────────────────────────────────────

const CITY_TZ: Record<string, string> = {
  lisboa: 'Europe/Lisbon', lisbon: 'Europe/Lisbon',
  porto: 'Europe/Lisbon', algarve: 'Europe/Lisbon',
  madeira: 'Atlantic/Madeira',
}

function getCurrentTime(citySlug: string): string {
  const tz = CITY_TZ[citySlug] ?? 'Europe/Lisbon'
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  })
  return fmt.format(now)
}

// ─── Routes ───────────────────────────────────────────────────────────────

export async function recommendationsRoutes(app: FastifyInstance) {

  // ══════════════════════════════════════════════════════════════════════════
  // POST /recommendations — Ranking Engine (public, used by NOW + Concierge)
  // ══════════════════════════════════════════════════════════════════════════

  app.post('/recommendations', async (request, reply) => {
    const start = Date.now()

    const parsed = recommendRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const req = parsed.data
    const time = req.time ?? getCurrentTime(req.city)

    // Fetch candidates
    let candidates = await getCandidates(req.city, req.locale)
    if (candidates.length < 10) {
      const multi = await getCandidatesMultiCity(req.city, req.locale)
      if (multi.length > candidates.length) candidates = multi
    }

    // Run ranking engine
    const output = rank({
      candidates,
      time,
      intent: req.intent,
      budget: req.budget,
      category: req.category,
      userLat: req.lat,
      userLng: req.lng,
      limit: req.limit,
      surface: req.surface as 'now' | 'concierge' | 'default',
    })

    const timing = Date.now() - start

    const response: RecommendResponse = {
      results: output.results,
      meta: {
        city: req.city,
        window: output.window,
        intent: req.intent ?? null,
        candidatesTotal: output.candidatesTotal,
        candidatesFiltered: output.candidatesFiltered,
        timing,
      },
    }

    if (req.debug) {
      response.debug = output.breakdowns
    }

    // Log debug (fire-and-forget)
    logRankingDebug({
      citySlug: req.city,
      timeOfDay: timeToTimeOfDay(time),
      window: output.window,
      intent: req.intent,
      budget: req.budget,
      categoryFilter: req.category,
      userLat: req.lat,
      userLng: req.lng,
      candidatesTotal: output.candidatesTotal,
      candidatesAfterFilter: output.candidatesFiltered,
      results: output.results.map(r => ({ id: r.id, name: r.name, score: r.score })),
      scoringBreakdown: req.debug ? output.breakdowns : undefined,
    })

    return reply.send(response)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // GET /recommendations/intents — Available intents for UI
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/recommendations/intents', async (_request, reply) => {
    return reply.send({
      intents: [
        { id: 'dinner',      label: { pt: 'Jantar', en: 'Dinner' },           group: 'dining' },
        { id: 'lunch',       label: { pt: 'Almoço', en: 'Lunch' },            group: 'dining' },
        { id: 'breakfast',   label: { pt: 'Pequeno-almoço', en: 'Breakfast' }, group: 'dining' },
        { id: 'brunch',      label: { pt: 'Brunch', en: 'Brunch' },           group: 'dining' },
        { id: 'fine-dining', label: { pt: 'Fine Dining', en: 'Fine Dining' }, group: 'dining' },
        { id: 'drinks',      label: { pt: 'Bebidas', en: 'Drinks' },          group: 'drinks' },
        { id: 'wine',        label: { pt: 'Vinho', en: 'Wine' },              group: 'drinks' },
        { id: 'late-night',  label: { pt: 'Noite', en: 'Late Night' },        group: 'drinks' },
        { id: 'romantic',    label: { pt: 'Romântico', en: 'Romantic' },       group: 'occasion' },
        { id: 'celebration', label: { pt: 'Celebração', en: 'Celebration' },   group: 'occasion' },
        { id: 'culture',     label: { pt: 'Cultura', en: 'Culture' },         group: 'explore' },
        { id: 'museum',      label: { pt: 'Museu', en: 'Museum' },            group: 'explore' },
        { id: 'sunset',      label: { pt: 'Pôr do sol', en: 'Sunset' },       group: 'nature' },
        { id: 'beach',       label: { pt: 'Praia', en: 'Beach' },             group: 'nature' },
        { id: 'viewpoint',   label: { pt: 'Miradouro', en: 'Viewpoint' },     group: 'nature' },
        { id: 'walk',        label: { pt: 'Passeio', en: 'Walk' },            group: 'nature' },
        { id: 'shopping',    label: { pt: 'Compras', en: 'Shopping' },         group: 'other' },
        { id: 'wellness',    label: { pt: 'Bem-estar', en: 'Wellness' },       group: 'other' },
        { id: 'family',      label: { pt: 'Família', en: 'Family' },           group: 'other' },
        { id: 'rainy-day',   label: { pt: 'Dia de chuva', en: 'Rainy Day' },  group: 'other' },
        { id: 'hidden-gem',  label: { pt: 'Segredo local', en: 'Hidden Gem' }, group: 'other' },
      ],
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // POST /recommendations/query — Natural language → recommendations
  // ══════════════════════════════════════════════════════════════════════════

  app.post('/recommendations/query', async (request, reply) => {
    const start = Date.now()
    const body = request.body as { query: string; city: string; lat?: number; lng?: number; locale?: string; limit?: number; surface?: string }

    if (!body.query || !body.city) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'query and city are required' })
    }

    // Parse intent from natural language
    const parsed = parseIntent(body.query)
    const resolved = resolveIntent(parsed)
    const time = getCurrentTime(body.city)

    // Fetch and rank
    let candidates = await getCandidates(body.city, body.locale ?? 'pt')
    if (candidates.length < 10) {
      const multi = await getCandidatesMultiCity(body.city, body.locale ?? 'pt')
      if (multi.length > candidates.length) candidates = multi
    }

    const output = rank({
      candidates,
      time,
      intent: resolved.intent,
      budget: resolved.budget,
      category: resolved.category,
      userLat: body.lat,
      userLng: body.lng,
      limit: body.limit ?? 6,
      surface: (body.surface as 'now' | 'concierge') ?? 'concierge',
    })

    return reply.send({
      parsed,
      resolved,
      results: output.results,
      meta: {
        city: body.city,
        window: output.window,
        intent: resolved.intent ?? null,
        candidatesTotal: output.candidatesTotal,
        candidatesFiltered: output.candidatesFiltered,
        timing: Date.now() - start,
      },
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Business analytics endpoints (existing)
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/recommendations/me', {
    preHandler: [authenticateBusinessClient],
  }, async (request, reply) => {
    const placeId = request.businessClient!.placeId
    const recommendations = await getPlaceRecommendations(placeId)
    return reply.send({ recommendations })
  })

  app.get('/recommendations/:placeId', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    const { placeId } = z.object({ placeId: z.string().uuid() }).parse(request.params)
    const recommendations = await getPlaceRecommendations(placeId)
    return reply.send({ recommendations })
  })

  app.get('/admin/analytics/insights', {
    preHandler: [authenticateDashboardUser],
  }, async (_request, reply) => {
    const insights = await getAdminInsights()
    return reply.send(insights)
  })
}
