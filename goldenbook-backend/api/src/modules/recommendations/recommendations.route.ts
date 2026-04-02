import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateBusinessClient } from '../../shared/auth/businessAuth'
import { authenticateDashboardUser } from '../../shared/auth/dashboardAuth'
import { getPlaceRecommendations, getAdminInsights } from './recommendations.service'

export async function recommendationsRoutes(app: FastifyInstance) {

  // ── GET /recommendations/me ─────────────────────────────────────────────────
  // Business client: get recommendations for their place
  app.get('/recommendations/me', {
    preHandler: [authenticateBusinessClient],
  }, async (request, reply) => {
    const placeId = request.businessClient!.placeId
    const recommendations = await getPlaceRecommendations(placeId)
    return reply.send({ recommendations })
  })

  // ── GET /recommendations/:place_id ──────────────────────────────────────────
  // Admin: get recommendations for any place
  app.get('/recommendations/:placeId', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    const { placeId } = z.object({ placeId: z.string().uuid() }).parse(request.params)
    const recommendations = await getPlaceRecommendations(placeId)
    return reply.send({ recommendations })
  })

  // ── GET /admin/analytics/insights ───────────────────────────────────────────
  // Admin-level insights across all data
  app.get('/admin/analytics/insights', {
    preHandler: [authenticateDashboardUser],
  }, async (_request, reply) => {
    const insights = await getAdminInsights()
    return reply.send(insights)
  })
}
