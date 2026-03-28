import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { NotFoundError } from '../../shared/errors/AppError'
import {
  getPlaceBySlug,
  getPlaceCategories,
  getOpeningHours,
  getPlaceGallery,
  getNearbyGems,
  getOtherLocations,
} from './places.query'
import { toPlaceDetailDTO } from './places.dto'

const paramsSchema = z.object({ slug: z.string().min(1) })
const querySchema  = z.object({ locale: z.string().min(2).max(5).default('en') })

export async function placesRoutes(app: FastifyInstance) {
  app.get('/places/:slug', async (request, reply) => {
    const { slug }   = paramsSchema.parse(request.params)
    const { locale } = querySchema.parse(request.query)

    const place = await getPlaceBySlug(slug, locale)
    if (!place) throw new NotFoundError('Place')

    const hasCoords = place.latitude != null && place.longitude != null

    const [categories, openingHours, gallery, nearbyGems, otherLocations] = await Promise.all([
      getPlaceCategories(place.id, locale),
      getOpeningHours(place.id),
      getPlaceGallery(place.id),
      hasCoords
        ? getNearbyGems(place.id, place.latitude!, place.longitude!, locale)
        : Promise.resolve([]),
      place.brand_id
        ? getOtherLocations(place.brand_id, place.id, locale)
        : Promise.resolve([]),
    ])

    return reply.send(toPlaceDetailDTO(place, categories, openingHours, gallery, nearbyGems, otherLocations))
  })
}
