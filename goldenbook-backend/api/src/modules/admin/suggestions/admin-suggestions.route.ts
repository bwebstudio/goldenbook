import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import {
  generateSuggestions,
  applySuggestion,
  dismissSuggestion,
  bulkApplySuggestions,
  bulkDismissSuggestions,
  bulkClearSuggestions,
} from './admin-suggestions.query'

export async function adminSuggestionsRoutes(app: FastifyInstance) {
  // ── POST /admin/suggestions/generate ───────────────────────────────────────
  // Generate suggestions for places. Filters: placeId, onlyMissing, onlySource
  app.post('/admin/suggestions/generate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const schema = z.object({
      placeId:    z.string().uuid().optional(),
      onlyMissing: z.boolean().optional(),
      onlySource: z.string().optional(),
    })
    const filter = schema.parse(request.body ?? {})

    const results = await generateSuggestions(filter)
    return reply.send({
      generated: results.length,
      results: results.map(r => ({
        placeId: r.placeId,
        name: r.placeName,
        slug: r.placeSlug,
        relevant: r.suggestion.relevant,
        mode: r.suggestion.suggestedMode,
        confidence: r.suggestion.confidence,
        reason: r.suggestion.reason,
        reasonDetail: r.suggestion.reasonDetail,
      })),
    })
  })

  // ── POST /admin/suggestions/:id/apply ──────────────────────────────────────
  app.post('/admin/suggestions/:id/apply', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    await applySuggestion(id)
    return reply.send({ applied: true })
  })

  // ── POST /admin/suggestions/:id/dismiss ────────────────────────────────────
  app.post('/admin/suggestions/:id/dismiss', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    await dismissSuggestion(id)
    return reply.send({ dismissed: true })
  })

  // ── POST /admin/suggestions/bulk-apply ─────────────────────────────────────
  app.post('/admin/suggestions/bulk-apply', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const schema = z.object({
      placeIds:      z.array(z.string().uuid()).optional(),
      minConfidence: z.number().min(0).max(1).optional(),
    })
    const filter = schema.parse(request.body ?? {})
    const count = await bulkApplySuggestions(filter)
    return reply.send({ applied: count })
  })

  // ── POST /admin/suggestions/bulk-dismiss ───────────────────────────────────
  app.post('/admin/suggestions/bulk-dismiss', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { placeIds } = z.object({
      placeIds: z.array(z.string().uuid()).min(1),
    }).parse(request.body)
    const count = await bulkDismissSuggestions(placeIds)
    return reply.send({ dismissed: count })
  })

  // ── POST /admin/suggestions/bulk-clear ─────────────────────────────────────
  app.post('/admin/suggestions/bulk-clear', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { placeIds } = z.object({
      placeIds: z.array(z.string().uuid()).min(1),
    }).parse(request.body)
    const count = await bulkClearSuggestions(placeIds)
    return reply.send({ cleared: count })
  })
}
