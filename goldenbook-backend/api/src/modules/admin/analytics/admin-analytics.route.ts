import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { getBookingAnalytics } from './admin-analytics.query'

const EMPTY_ANALYTICS = {
  totalImpressions: 0,
  totalClicks: 0,
  globalCtr: 0,
  byProvider: [],
  byMode: [],
  byCity: [],
  topPlaces: [],
  byCategory: [],
}

export async function adminAnalyticsRoutes(app: FastifyInstance) {
  app.get('/admin/analytics/bookings', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const query = z.object({
      days:        z.coerce.number().min(1).max(365).default(30),
      provider:    z.string().optional(),
      city:        z.string().optional(),
      bookingMode: z.string().optional(),
    }).parse(request.query)

    try {
      const data = await getBookingAnalytics({
        days: query.days,
        provider: query.provider,
        city: query.city,
        bookingMode: query.bookingMode,
      })
      return reply.send(data)
    } catch {
      // Tables may not exist yet — return empty data
      return reply.send(EMPTY_ANALYTICS)
    }
  })
}
