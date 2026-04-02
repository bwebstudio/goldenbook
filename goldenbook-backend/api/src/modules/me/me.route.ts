import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../shared/auth/authPlugin'
import { normalizeLocale } from '../../shared/i18n/locale'
import {
  getSavedPlaces,
  getSavedRoutes,
  getRecentlyViewed,
  savePlace,
  unsavePlace,
  saveRoute,
  unsaveRoute,
  trackRecentlyViewed,
} from './me.query'
import {
  toSavedPlaceDTO,
  toSavedRouteDTO,
  toRecentlyViewedDTO,
} from './me.dto'

const localeQuery = z.object({
  locale: z.string().default('en'),
})

const placeParams = z.object({
  placeId: z.string().uuid({ message: 'placeId must be a valid UUID' }),
})

const routeParams = z.object({
  routeId: z.string().uuid({ message: 'routeId must be a valid UUID' }),
})

export async function meRoutes(app: FastifyInstance) {
  // ── GET /me/saved ────────────────────────────────────────────────────────────
  app.get('/me/saved', { preHandler: [authenticate] }, async (request, reply) => {
    const { locale: rawLocale } = localeQuery.parse(request.query)
    const locale = normalizeLocale(rawLocale)
    const userId = request.user.sub

    const [savedPlaces, savedRoutes, recentlyViewed] = await Promise.all([
      getSavedPlaces(userId, locale),
      getSavedRoutes(userId, locale),
      getRecentlyViewed(userId, locale),
    ])

    return reply.send({
      savedPlaces: savedPlaces.map(toSavedPlaceDTO),
      savedRoutes: savedRoutes.map(toSavedRouteDTO),
      recentlyViewed: recentlyViewed.map(toRecentlyViewedDTO),
    })
  })

  // ── POST /me/saved/places/:placeId ───────────────────────────────────────────
  app.post('/me/saved/places/:placeId', { preHandler: [authenticate] }, async (request, reply) => {
    const { placeId } = placeParams.parse(request.params)
    await savePlace(request.user.sub, placeId)
    return reply.status(204).send()
  })

  // ── DELETE /me/saved/places/:placeId ─────────────────────────────────────────
  app.delete('/me/saved/places/:placeId', { preHandler: [authenticate] }, async (request, reply) => {
    const { placeId } = placeParams.parse(request.params)
    await unsavePlace(request.user.sub, placeId)
    return reply.status(204).send()
  })

  // ── POST /me/saved/routes/:routeId ───────────────────────────────────────────
  app.post('/me/saved/routes/:routeId', { preHandler: [authenticate] }, async (request, reply) => {
    const { routeId } = routeParams.parse(request.params)
    await saveRoute(request.user.sub, routeId)
    return reply.status(204).send()
  })

  // ── DELETE /me/saved/routes/:routeId ─────────────────────────────────────────
  app.delete('/me/saved/routes/:routeId', { preHandler: [authenticate] }, async (request, reply) => {
    const { routeId } = routeParams.parse(request.params)
    await unsaveRoute(request.user.sub, routeId)
    return reply.status(204).send()
  })

  // ── POST /me/recently-viewed/places/:placeId ─────────────────────────────────
  app.post('/me/recently-viewed/places/:placeId', { preHandler: [authenticate] }, async (request, reply) => {
    const { placeId } = placeParams.parse(request.params)
    await trackRecentlyViewed(request.user.sub, placeId)
    return reply.status(204).send()
  })
}
