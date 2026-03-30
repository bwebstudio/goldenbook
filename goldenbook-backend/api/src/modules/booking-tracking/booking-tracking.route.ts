import type { FastifyInstance } from 'fastify'
import { recordBookingClick, recordBookingImpression, type TrackingEvent } from './booking-tracking.query'
import {
  normalizeCity,
  normalizeLocale,
  extractUserId,
  detectDeviceType,
} from './booking-tracking.validation'

export async function bookingTrackingRoutes(app: FastifyInstance) {
  // POST /booking/click
  app.post('/booking/click', async (request, reply) => {
    handleTracking(request, reply, recordBookingClick, app)
    return reply.status(204).send()
  })

  // POST /booking/impression
  app.post('/booking/impression', async (request, reply) => {
    handleTracking(request, reply, recordBookingImpression, app)
    return reply.status(204).send()
  })
}

// Always returns 204 — tracking never blocks the user
function handleTracking(
  request: any,
  _reply: any,
  recorder: (event: TrackingEvent) => Promise<void>,
  app: any,
) {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>
    const placeId = typeof body.placeId === 'string' ? body.placeId : null
    if (!placeId) return

    const event: TrackingEvent = {
      placeId,
      provider: typeof body.provider === 'string' ? body.provider : 'website',
      bookingMode: typeof body.bookingMode === 'string' ? body.bookingMode : 'direct_website',
      targetUrl: typeof body.targetUrl === 'string' ? body.targetUrl : null,
      userId: extractUserId(request.headers.authorization),
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
      deviceType: detectDeviceType(request.headers['user-agent']),
      locale: normalizeLocale(typeof body.locale === 'string' ? body.locale : null),
      city: normalizeCity(typeof body.city === 'string' ? body.city : null),
    }

    recorder(event).catch((err) => {
      app.log.warn({ error: err instanceof Error ? err.message : err }, 'tracking_insert_failed')
    })
  } catch (err) {
    app.log.warn({ error: err instanceof Error ? err.message : err }, 'tracking_handler_failed')
  }
}
