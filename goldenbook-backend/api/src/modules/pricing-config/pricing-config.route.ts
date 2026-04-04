/**
 * Centralized pricing config endpoints.
 *
 * GET  /pricing-config       → public, returns all active pricing configs
 * GET  /pricing-config/all   → admin, returns all (including inactive)
 * PATCH /pricing-config/:id  → admin only, updates price/duration/slots/active
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../shared/auth/dashboardAuth'
import { AppError } from '../../shared/errors/AppError'
import {
  getActivePricingConfigs,
  getAllPricingConfigs,
  updatePricingConfig,
} from './pricing-config.query'

export async function pricingConfigRoutes(app: FastifyInstance) {

  // Public: active pricing configs
  app.get('/pricing-config', async (_request, reply) => {
    const configs = await getActivePricingConfigs()
    return reply.send({ items: configs })
  })

  // Admin: all pricing configs (including inactive)
  app.get('/pricing-config/all', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    if (request.adminUser?.dashboardRole !== 'super_admin') {
      throw new AppError(403, 'Only super admins can view all pricing configs', 'FORBIDDEN')
    }
    const configs = await getAllPricingConfigs()
    return reply.send({ items: configs })
  })

  // Admin: update a pricing config
  app.patch('/pricing-config/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    if (request.adminUser?.dashboardRole !== 'super_admin') {
      throw new AppError(403, 'Only super admins can update pricing', 'FORBIDDEN')
    }

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      price: z.number().int().min(0).optional(),
      duration_days: z.number().int().min(1).optional(),
      max_slots: z.number().int().min(0).nullable().optional(),
      is_active: z.boolean().optional(),
    }).parse(request.body)

    const updated = await updatePricingConfig(id, {
      price: body.price,
      duration_days: body.duration_days,
      max_slots: body.max_slots,
      is_active: body.is_active,
    })

    if (!updated) {
      throw new AppError(404, 'Pricing config not found', 'NOT_FOUND')
    }

    return reply.send(updated)
  })
}
