import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { NotFoundError } from '../../shared/errors/AppError'
import { getRoutes, getRouteBySlug, getRoutePlaces } from './routes.query'
import { toRouteCardDTO, toRouteDetailDTO } from './routes.dto'

const listQuerySchema = z.object({
  city:   z.string().min(1),
  locale: z.string().min(2).max(5).default('en'),
  limit:  z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
})

const detailParamsSchema = z.object({ slug: z.string().min(1) })
const detailQuerySchema  = z.object({ locale: z.string().min(2).max(5).default('en') })

export async function routesRoutes(app: FastifyInstance) {
  // GET /routes?city=lisboa&locale=pt
  app.get('/routes', async (request, reply) => {
    const { city, locale, limit, offset } = listQuerySchema.parse(request.query)
    const rows = await getRoutes(city, locale, limit, offset)
    return reply.send({ items: rows.map(toRouteCardDTO) })
  })

  // GET /routes/:slug?locale=pt
  app.get('/routes/:slug', async (request, reply) => {
    const { slug }   = detailParamsSchema.parse(request.params)
    const { locale } = detailQuerySchema.parse(request.query)

    const route = await getRouteBySlug(slug, locale)
    if (!route) throw new NotFoundError('Route')

    const places = await getRoutePlaces(route.id, locale)
    return reply.send(toRouteDetailDTO(route, places))
  })
}
