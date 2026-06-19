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
  type PlaceRow,
} from './places.query'
import { toPlaceDetailDTO } from './places.dto'
import type { PlaceDetailDTO } from './places.dto'
import { getManualBookingCandidate } from '../booking-candidates/candidates.query'
import { normalizeLocale } from '../../shared/i18n/locale'

// Assemble the full place-detail DTO from a base PlaceRow. Shared by the
// public read (GET /places/:slug) and the authenticated admin editor read
// (GET /admin/places/by-slug/:slug) so both return an identical shape — the
// only difference between them is which query loads the base row (published
// only vs. any status).
export async function buildPlaceDetailDTO(place: PlaceRow, locale: string): Promise<PlaceDetailDTO> {
  // Booking URL resolution — fall back to a manual dashboard candidate.
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

  const hasCoords = place.latitude != null && place.longitude != null

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

  return toPlaceDetailDTO(place, categories, openingHours, gallery, nearbyGems, otherLocations, citySlugs.length > 0 ? citySlugs : undefined)
}

const paramsSchema = z.object({ slug: z.string().min(1) })
// PT is the canonical editorial locale (see modules/admin/places/translation-policy.ts).
// When a caller hits this endpoint without a locale param (typically: SEO
// crawlers, prerender hits, server-to-server lookups), we serve PT — the
// row that is guaranteed to exist and to be fresh.
const querySchema  = z.object({ locale: z.string().min(2).max(5).default('pt') })

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

    return reply.send(await buildPlaceDetailDTO(place, locale))
  })
}
