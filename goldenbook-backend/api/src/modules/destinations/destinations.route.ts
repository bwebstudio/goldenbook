import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getDestinations } from './destinations.query'
import { toDestinationDTO } from './destinations.dto'

const querySchema = z.object({
  locale: z.string().min(2).max(5).default('en'),
})

export async function destinationsRoutes(app: FastifyInstance) {
  app.get('/destinations', async (request, reply) => {
    const query = querySchema.parse(request.query)
    const rows = await getDestinations(query.locale)
    return reply.send({ items: rows.map(toDestinationDTO) })
  })
}
