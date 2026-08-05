// GET /api/v1/plan
//
// Three walkable stops near the user, right now, in the city they are in.
//
// Returns 204 when we cannot build an honest plan: no location, no city, or
// not enough places open and close enough to each other. The client renders
// nothing in that case. A thin or invented plan is worse than no plan, which
// is the whole reason this endpoint refuses rather than degrades.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPlanCandidates, getNearestCoveredCity } from './plan.query'
import { buildPlan } from './plan.service'

const CITY_TIMEZONES: Record<string, string> = {
  lisbon:    'Europe/Lisbon',
  lisboa:    'Europe/Lisbon',
  porto:     'Europe/Lisbon',
  algarve:   'Europe/Lisbon',
  madeira:   'Atlantic/Madeira',
}

/**
 * Hasta dónde buscamos otro destino cubierto cuando el seleccionado no da
 * plan. 60 km cubre estar en Cascais con Lisboa puesta, o en Vila Nova de
 * Gaia con Porto; más allá ya no es "te has equivocado de ciudad", es que
 * estás de viaje en otro sitio y no hay nada que sugerir.
 */
const SUGGEST_RADIUS_METRES = 60_000

/**
 * How far from the user the first stop may be.
 *
 * 2 km rather than the 1,2 km used between stops: the user may be at a hotel
 * on the edge of the centre, and asking them to walk a bit further to reach
 * the start of the evening is reasonable in a way that a 2 km hop mid-plan is
 * not.
 */
const START_RADIUS_METRES = 2000

const querySchema = z.object({
  city:   z.string().min(1).max(64),
  lat:    z.coerce.number().min(-90).max(90),
  lon:    z.coerce.number().min(-180).max(180),
  locale: z.string().max(8).optional(),
})

export async function planRoutes(app: FastifyInstance) {
  app.get('/plan', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    // Without coordinates there is no walking order to compute, and guessing
    // from the city centre would put stops an unknown distance from the user.
    if (!parsed.success) return reply.status(204).send()

    const { city, lat, lon } = parsed.data
    const locale = parsed.data.locale ?? 'en'
    const citySlug = city.trim().toLowerCase()
    const tz = CITY_TIMEZONES[citySlug] ?? 'Europe/Lisbon'

    try {
      const candidates = await getPlanCandidates(
        citySlug, locale, lat, lon, START_RADIUS_METRES, tz,
      )
      const plan = candidates.length > 0
        ? buildPlan(candidates, lat, lon, tz, citySlug)
        : null

      if (plan) return reply.send(plan)

      // Sin plan aquí. Antes de callarnos, miramos si el usuario está de hecho
      // en otro destino que sí cubrimos: alguien en Porto con Lisboa
      // seleccionada tenía un plan a doscientos metros y no lo veía.
      const nearest = await getNearestCoveredCity(lat, lon)
      if (
        nearest &&
        nearest.slug !== citySlug &&
        nearest.distanceMetres <= SUGGEST_RADIUS_METRES
      ) {
        return reply.send({
          suggestion: {
            citySlug: nearest.slug,
            cityName: nearest.name,
            distanceKm: Math.round(nearest.distanceMetres / 1000),
          },
        })
      }

      return reply.status(204).send()
    } catch (err) {
      // A failed plan must never take the Discover screen down with it: the
      // client treats 204 as "no plan today" and renders the rest normally.
      request.log.error({ err }, '[plan] build failed')
      return reply.status(204).send()
    }
  })
}
