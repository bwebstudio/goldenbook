// Admin write endpoints for places.
//
// POST /api/v1/admin/places     — create a new place
// PUT  /api/v1/admin/places/:id — update an existing place by internal UUID
//
// NOTE: These endpoints currently have no authentication middleware because
// the dashboard does not yet have an admin auth pipeline. Before opening this
// API to the internet, add a preHandler that verifies admin_users membership.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ValidationError } from '../../../shared/errors/AppError'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { createPlaceSchema, updatePlaceSchema } from './admin-places.dto'
import { createPlace, updatePlace } from './admin-places.query'

const idParamsSchema = z.object({ id: z.string().uuid('Place id must be a valid UUID') })

export async function adminPlacesRoutes(app: FastifyInstance) {
  // ── POST /admin/places ──────────────────────────────────────────────────────
  app.post('/admin/places', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const parsed = createPlaceSchema.safeParse(request.body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }

    const place = await createPlace(parsed.data)
    return reply.status(201).send(place)
  })

  // ── PUT /admin/places/:id ───────────────────────────────────────────────────
  app.put('/admin/places/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)

    const parsed = updatePlaceSchema.safeParse(request.body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }

    const place = await updatePlace(id, parsed.data)
    return reply.send(place)
  })
}
