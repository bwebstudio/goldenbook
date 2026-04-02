import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getMapPlaces } from './map.query'
import { toMapPlaceDTO } from './map.dto'
import { normalizeLocale } from '../../shared/i18n/locale'

const querySchema = z.object({
  city:     z.string().min(1),
  category: z.string().min(1).optional(),
  locale:   z.string().min(2).max(5).default('en'),
})

export async function mapRoutes(app: FastifyInstance) {
  app.get('/map/places', async (request, reply) => {
    const { city, category, locale: rawLocale } = querySchema.parse(request.query)
    const locale = normalizeLocale(rawLocale)
    const rows = await getMapPlaces(city, locale, category)
    return reply.send({ items: rows.map(toMapPlaceDTO) })
  })
}
