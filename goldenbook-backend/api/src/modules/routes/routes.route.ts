import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { NotFoundError } from '../../shared/errors/AppError'
import { getRoutes, getRouteBySlug, getRoutePlaces } from './routes.query'
import { toRouteCardDTO, toRouteDetailDTO } from './routes.dto'
import type { RouteCardDTO, RouteDetailDTO, RoutePlaceDTO } from './routes.dto'
import { normalizeLocale } from '../../shared/i18n/locale'
import { getActiveCuratedRoutes, getCuratedRouteById } from '../curated-routes/curated-routes.query'
import type { CuratedRouteWithStops } from '../curated-routes/curated-routes.query'

const listQuerySchema = z.object({
  city:   z.string().min(1),
  locale: z.string().min(2).max(5).default('en'),
  limit:  z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
})

const detailParamsSchema = z.object({ slug: z.string().min(1) })
const detailQuerySchema  = z.object({ locale: z.string().min(2).max(5).default('en') })

/** Map a curated route to the same RouteCardDTO the mobile app expects */
function curatedToCard(cr: CuratedRouteWithStops): RouteCardDTO {
  const firstStop = cr.stops[0]
  return {
    id: cr.id,
    slug: cr.id, // curated routes use id as slug (no dedicated slug column)
    title: cr.title,
    summary: cr.summary,
    routeType: cr.routeType === 'sponsored' ? 'sponsored' : 'editorial',
    estimatedMinutes: cr.stops.length * 30, // ~30 min per stop
    featured: cr.routeType === 'sponsored',
    heroImage: firstStop
      ? { bucket: firstStop.heroImage.bucket, path: firstStop.heroImage.path }
      : { bucket: null, path: null },
    placesCount: cr.stops.length,
    city: { slug: cr.citySlug, name: cr.citySlug }, // city name comes from stops context
  }
}

/** Map a curated route to RouteDetailDTO */
function curatedToDetail(cr: CuratedRouteWithStops): RouteDetailDTO {
  return {
    id: cr.id,
    slug: cr.id,
    title: cr.title,
    summary: cr.summary,
    body: null,
    routeType: cr.routeType === 'sponsored' ? 'sponsored' : 'editorial',
    estimatedMinutes: cr.stops.length * 30,
    featured: cr.routeType === 'sponsored',
    heroImage: cr.stops[0]
      ? { bucket: cr.stops[0].heroImage.bucket, path: cr.stops[0].heroImage.path }
      : { bucket: null, path: null },
    city: { slug: cr.citySlug, name: cr.citySlug },
    places: cr.stops.map((s) => ({
      id: s.placeId,
      slug: s.placeSlug,
      name: s.placeName,
      // Localized place description (already locale-resolved by the SQL
      // COALESCE chain in curated-routes STOPS_SELECT). Falls back to the
      // curator's editorial note on the client when this is empty.
      shortDescription: s.shortDescription,
      note: s.editorialNote,
      stayMinutes: 30,
      sortOrder: s.stopOrder,
      heroImage: { bucket: s.heroImage.bucket, path: s.heroImage.path },
      location: {
        address: null,
        latitude: s.latitude != null ? Number(s.latitude) : null,
        longitude: s.longitude != null ? Number(s.longitude) : null,
      },
    })),
  }
}

export async function routesRoutes(app: FastifyInstance) {
  // GET /routes?city=lisboa&locale=pt
  // Returns both legacy routes AND curated routes (curated first)
  app.get('/routes', async (request, reply) => {
    const { city, locale: rawLocale, limit, offset } = listQuerySchema.parse(request.query)
    const locale = normalizeLocale(rawLocale)

    // Only curated routes — legacy routes are deprecated
    const curatedRoutes = await getActiveCuratedRoutes(city, locale).catch(() => [])
    return reply.send({ items: curatedRoutes.map(curatedToCard) })
  })

  // GET /routes/:slug?locale=pt
  // Try curated route by ID first, then legacy route by slug
  app.get('/routes/:slug', async (request, reply) => {
    const { slug }   = detailParamsSchema.parse(request.params)
    const { locale: rawLocale } = detailQuerySchema.parse(request.query)
    const locale = normalizeLocale(rawLocale)

    // Try curated route (slug is actually UUID for curated routes)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
    if (isUuid) {
      const curated = await getCuratedRouteById(slug, locale).catch(() => null)
      if (curated) {
        return reply.send(curatedToDetail(curated))
      }
    }

    // Fall back to legacy route
    const route = await getRouteBySlug(slug, locale)
    if (!route) throw new NotFoundError('Route')

    const places = await getRoutePlaces(route.id, locale)
    return reply.send(toRouteDetailDTO(route, places))
  })
}
