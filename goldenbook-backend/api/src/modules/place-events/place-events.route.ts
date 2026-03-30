import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../shared/auth/authPlugin'
import { db } from '../../db/postgres'

const placeIdBody = z.object({
  placeId: z.string().uuid(),
})

export async function placeEventsRoutes(app: FastifyInstance) {
  // ── POST /events/place-view ─────────────────────────────────────────────
  app.post('/events/place-view', { preHandler: [authenticate] }, async (request, reply) => {
    const { placeId } = placeIdBody.parse(request.body)
    await db.query(
      'INSERT INTO place_view_events (place_id, user_id) VALUES ($1, $2)',
      [placeId, request.user.sub],
    )
    return reply.status(204).send()
  })

  // ── POST /events/place-website-click ────────────────────────────────────
  app.post('/events/place-website-click', { preHandler: [authenticate] }, async (request, reply) => {
    const { placeId } = placeIdBody.parse(request.body)
    await db.query(
      'INSERT INTO place_website_click_events (place_id, user_id) VALUES ($1, $2)',
      [placeId, request.user.sub],
    )
    return reply.status(204).send()
  })

  // ── POST /events/place-direction-click ──────────────────────────────────
  app.post('/events/place-direction-click', { preHandler: [authenticate] }, async (request, reply) => {
    const { placeId } = placeIdBody.parse(request.body)
    await db.query(
      'INSERT INTO place_direction_events (place_id, user_id) VALUES ($1, $2)',
      [placeId, request.user.sub],
    )
    return reply.status(204).send()
  })
}
