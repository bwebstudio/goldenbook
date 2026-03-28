import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getMapPlaces } from './map.query'
import { toMapPlaceDTO } from './map.dto'

const querySchema = z.object({
  city:     z.string().min(1),
  category: z.string().min(1).optional(),
})

export async function mapRoutes(app: FastifyInstance) {
  app.get('/map/places', async (request, reply) => {
    const { city, category } = querySchema.parse(request.query)
    const rows = await getMapPlaces(city, category)
    return reply.send({ items: rows.map(toMapPlaceDTO) })
  })
}