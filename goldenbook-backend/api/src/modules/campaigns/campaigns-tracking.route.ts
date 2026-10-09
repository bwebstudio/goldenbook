import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/postgres'
import { authenticate } from '../../shared/auth/authPlugin'

const TrackEventSchema = z.object({
  event: z.enum(['slot_selected', 'checkout_started', 'checkout_completed']),
  campaign_id: z.string().uuid(),
  place_id: z.string().uuid(),
  position: z.number().int().optional(),
  date: z.string().optional(),
  time_bucket: z.string().optional(),
})

export async function campaignsTrackingRoutes(app: FastifyInstance) {

  // ── POST /campaigns/track ───────────────────────────────────────────────
  // Fire-and-forget tracking — always returns 204
  app.post('/campaigns/track', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const body = TrackEventSchema.safeParse(request.body)
    if (!body.success) return reply.status(204).send()

    const { event, campaign_id, place_id, position, date, time_bucket } = body.data

    // Insert into place_analytics_events (existing table) for unified analytics.
    // user_id lets the dashboard funnel drop staff checkouts made while testing.
    await db.query(
      `INSERT INTO place_analytics_events (place_id, event_type, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [
        place_id,
        `campaign_${event}`,
        request.user?.sub ?? null,
        JSON.stringify({
          campaign_id,
          position: position ?? null,
          date: date ?? null,
          time_bucket: time_bucket ?? null,
        }),
      ],
    ).catch(() => {
      // Non-blocking — tracking failures must never break UX
    })

    return reply.status(204).send()
  })
}
