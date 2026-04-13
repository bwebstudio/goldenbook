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
import { getManualBookingCandidate } from '../booking-candidates/candidates.query'
import { normalizeLocale } from '../../shared/i18n/locale'

const paramsSchema = z.object({ slug: z.string().min(1) })
const querySchema  = z.object({ locale: z.string().min(2).max(5).default('en') })

export async function placesRoutes(app: FastifyInstance) {
  app.get('/places/:slug', async (request, reply) => {
    const { slug }   = paramsSchema.parse(request.params)
    const { locale: rawLocale } = querySchema.parse(request.query)
    const locale = normalizeLocale(rawLocale)

    let place
    try {
      place = await getPlaceBySlug(slug, locale)
    } catch (err) {
      app.log.error({ slug, locale, error: err instanceof Error ? err.message : err }, 'place_detail_failed')
      throw err
    }

    if (!place) throw new NotFoundError('Place')

    const hasCoords = place.latitude != null && place.longitude != null

    // ── Booking URL resolution ────────────────────────────────────────────
    //
    // Priority:
    //   1. places.booking_url (set directly on the place row)
    //   2. Manual candidate from dashboard (set by editor via PlaceCandidates)
    //
    // Google Maps URLs are NOT used as booking links.
    // Affiliate candidates are NOT used.
    if (!place.booking_url) {
      try {
        const manual = await getManualBookingCandidate(place.id)
        if (manual?.candidate_url) {
          place.booking_url = manual.candidate_url
        }
      } catch {
        // candidates table may not exist — ignore
      }
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
