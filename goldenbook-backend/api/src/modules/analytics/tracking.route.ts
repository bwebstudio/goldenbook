import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/postgres'

const VALID_EVENTS = [
  'view_place',
  'click_place',
  'save_place',
  'open_route',
  'click_booking',
  'campaign_slot_selected',
  'campaign_checkout_started',
  'campaign_checkout_completed',
] as const

const TrackSchema = z.object({
  event: z.enum(VALID_EVENTS),
  placeId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().max(64).optional(),
  city: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// Simple in-memory rate limiter (per session, 100 events/min)
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

function checkRate(key: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimiter.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 100) return false
  entry.count++
  return true
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimiter) {
    if (v.resetAt < now) rateLimiter.delete(k)
  }
}, 300_000)

export async function trackingRoutes(app: FastifyInstance) {

  // ── POST /analytics/track ───────────────────────────────────────────────
  // Public-ish endpoint — no strict auth, always 204
  app.post('/analytics/track', async (request, reply) => {
    const parsed = TrackSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(204).send()

    const { event, placeId, userId, sessionId, city, category, metadata } = parsed.data

    // Rate limit by session or IP
    const rateKey = sessionId ?? (request.ip || 'unknown')
    if (!checkRate(rateKey)) return reply.status(204).send()

    // Fire-and-forget insert
    db.query(
      `INSERT INTO place_analytics_events (place_id, event_type, user_id, session_id, city, category, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [
        placeId ?? null,
        event,
        userId ?? null,
        sessionId ?? null,
        city ?? null,
        category ?? null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    ).catch(() => {})

    return reply.status(204).send()
  })
}
