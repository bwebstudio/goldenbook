import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getWebHomeData } from './web.service'

const querySchema = z.object({
  city:   z.string().min(1).default('lisboa'),
  locale: z.string().min(2).max(5).default('en'),
})

export async function webRoutes(app: FastifyInstance) {
  /**
   * GET /web/home
   *
   * Returns a single aggregated payload for the Goldenbook marketing website
   * homepage. All image references are fully-resolved public URLs.
   *
   * Query params:
   *   city   — destination slug (default: "lisboa")
   *   locale — BCP-47 locale code (default: "en")
   */
  app.get('/web/home', async (request, reply) => {
    const { city, locale } = querySchema.parse(request.query)
    const data = await getWebHomeData(city, locale)
    return reply.send(data)
  })
}
