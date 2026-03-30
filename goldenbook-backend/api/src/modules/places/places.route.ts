import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/postgres'
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
import { getActiveCandidateForPlace, getBestValidCandidateForPlace } from '../booking-candidates/candidates.query'

const paramsSchema = z.object({ slug: z.string().min(1) })
const querySchema  = z.object({ locale: z.string().min(2).max(5).default('en') })

export async function placesRoutes(app: FastifyInstance) {
  app.get('/places/:slug', async (request, reply) => {
    const { slug }   = paramsSchema.parse(request.params)
    const { locale } = querySchema.parse(request.query)

    let place
    try {
      place = await getPlaceBySlug(slug, locale)
    } catch (err) {
      app.log.error({ slug, locale, error: err instanceof Error ? err.message : err }, 'place_detail_failed')
      throw err
    }

    if (!place) throw new NotFoundError('Place')

    const hasCoords = place.latitude != null && place.longitude != null

    // Fetch active booking candidate (if candidates table exists)
    let candidateUrl: string | null = null
    let candidateProvider: string | null = null
    try {
      const active = await getActiveCandidateForPlace(place.id)
      if (active?.is_valid !== false && active?.candidate_url) {
        candidateUrl = active.candidate_url
        candidateProvider = active.provider
      } else {
        // Fallback: best valid candidate
        const best = await getBestValidCandidateForPlace(place.id)
        if (best?.candidate_url) {
          candidateUrl = best.candidate_url
          candidateProvider = best.provider
        }
      }
    } catch {
      // candidates table may not exist yet — ignore
    }

    // If a candidate was found, override booking_url so the resolver picks it up
    if (candidateUrl) {
      place.booking_url = candidateUrl
    }

    const [categories, openingHours, gallery, nearbyGems, otherLocations, citySlugs] = await Promise.all([
      getPlaceCategories(place.id, locale),
      getOpeningHours(place.id),
      getPlaceGallery(place.id),
      hasCoords
        ? getNearbyGems(place.id, place.latitude!, place.longitude!, locale)
        : Promise.resolve([]),
      place.brand_id
        ? getOtherLocations(place.brand_id, place.id, locale)
        : Promise.resolve([]),
      db.query<{ slug: string }>(`SELECT d.slug FROM place_destinations pd JOIN destinations d ON d.id = pd.destination_id WHERE pd.place_id = $1 ORDER BY d.name`, [place.id])
        .then((r) => r.rows.map((row) => row.slug))
        .catch(() => [place.city_slug]),
    ])

    return reply.send(toPlaceDetailDTO(place, categories, openingHours, gallery, nearbyGems, otherLocations, citySlugs.length > 0 ? citySlugs : undefined))
  })
}
