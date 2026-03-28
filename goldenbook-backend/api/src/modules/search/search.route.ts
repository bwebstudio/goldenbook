import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { findPlaces, findRoutes, findCategories } from './search.query'
import { toSearchPlaceDTO, toSearchRouteDTO, toSearchCategoryDTO } from './search.dto'

const querySchema = z.object({
  q:      z.string().min(1).max(100),
  city:   z.string().min(1),
  locale: z.string().min(2).max(5).default('en'),
})

export async function searchRoutes(app: FastifyInstance) {
  app.get('/search', async (request, reply) => {
    const { q, city, locale } = querySchema.parse(request.query)

    const [places, routes, categories] = await Promise.all([
      findPlaces(city, locale, q),
      findRoutes(city, locale, q),
      findCategories(city, locale, q),
    ])

    return reply.send({
      query: q,
      places:     places.map(toSearchPlaceDTO),
      routes:     routes.map(toSearchRouteDTO),
      categories: categories.map(toSearchCategoryDTO),
    })
  })
}