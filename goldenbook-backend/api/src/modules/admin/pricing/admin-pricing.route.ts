import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { AppError } from '../../../shared/errors/AppError'
import {
  getAllPricingPlans,
  getAllSeasonRules,
  getAllCityMultipliers,
  getAllPromotions,
  updatePricingPlan,
  createPricingPlan,
  deletePricingPlan,
  updateSeasonRule,
  createSeasonRule,
  deleteSeasonRule,
  updateCityMultiplier,
  updatePromotion,
  createPromotion,
  computePrice,
} from './pricing.query'

function requireSuperAdmin(request: { adminUser?: { dashboardRole: string } }) {
  if (request.adminUser?.dashboardRole !== 'super_admin') {
    throw new AppError(403, 'Only super admins can manage pricing', 'FORBIDDEN')
  }
}

export async function adminPricingRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL CONFIG — returns everything in one call
  // ═══════════════════════════════════════════════════════════════════════════

  // Editors can read pricing config (read-only access for commercial team)
  app.get('/admin/pricing/config', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    const [plans, seasons, cities, promotions] = await Promise.all([
      getAllPricingPlans().catch(() => []),
      getAllSeasonRules().catch(() => []),
      getAllCityMultipliers().catch(() => []),
      getAllPromotions().catch(() => []),
    ])
    return reply.send({ plans, seasons, cities, promotions })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PRICING PLANS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/admin/pricing/plans', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const plans = await getAllPricingPlans()
    return reply.send({ items: plans })
  })

  app.post('/admin/pricing/plans', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)

    const body = z.object({
      pricingType: z.enum(['membership', 'placement', 'upgrade']),
      placementType: z.string().nullable().default(null),
      city: z.string().nullable().default(null),
      position: z.number().int().min(1).max(10).nullable().default(null),
      slot: z.string().nullable().default(null),
      unitLabel: z.string().min(1),
      unitDays: z.number().int().min(1),
      basePrice: z.number().min(0),
    }).parse(request.body)

    const plan = await createPricingPlan({
      pricing_type: body.pricingType,
      placement_type: body.placementType,
      city: body.city,
      position: body.position,
      slot: body.slot,
      unit_label: body.unitLabel,
      unit_days: body.unitDays,
      base_price: body.basePrice,
    })
    return reply.status(201).send(plan)
  })

  app.put('/admin/pricing/plans/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      basePrice: z.number().min(0).optional(),
      unitLabel: z.string().min(1).optional(),
      unitDays: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
    }).parse(request.body)

    const updated = await updatePricingPlan(id, {
      base_price: body.basePrice,
      unit_label: body.unitLabel,
      unit_days: body.unitDays,
      is_active: body.isActive,
    })
    if (!updated) throw new AppError(404, 'Pricing plan not found', 'NOT_FOUND')
    return reply.send(updated)
  })

  app.delete('/admin/pricing/plans/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const deleted = await deletePricingPlan(id)
    if (!deleted) throw new AppError(404, 'Pricing plan not found', 'NOT_FOUND')
    return reply.status(204).send()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SEASON RULES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/admin/pricing/seasons', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const rules = await getAllSeasonRules()
    return reply.send({ items: rules })
  })

  app.post('/admin/pricing/seasons', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const body = z.object({
      city: z.string().min(1),
      seasonName: z.enum(['high', 'mid', 'low']),
      monthFrom: z.number().int().min(1).max(12),
      monthTo: z.number().int().min(1).max(12),
      multiplier: z.number().min(0).max(5),
    }).parse(request.body)

    const rule = await createSeasonRule({
      city: body.city,
      season_name: body.seasonName,
      month_from: body.monthFrom,
      month_to: body.monthTo,
      multiplier: body.multiplier,
    })
    return reply.status(201).send(rule)
  })

  app.put('/admin/pricing/seasons/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      multiplier: z.number().min(0).max(5).optional(),
      monthFrom: z.number().int().min(1).max(12).optional(),
      monthTo: z.number().int().min(1).max(12).optional(),
      seasonName: z.enum(['high', 'mid', 'low']).optional(),
      isActive: z.boolean().optional(),
    }).parse(request.body)

    const updated = await updateSeasonRule(id, {
      multiplier: body.multiplier,
      month_from: body.monthFrom,
      month_to: body.monthTo,
      season_name: body.seasonName,
      is_active: body.isActive,
    })
    if (!updated) throw new AppError(404, 'Season rule not found', 'NOT_FOUND')
    return reply.send(updated)
  })

  app.delete('/admin/pricing/seasons/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const deleted = await deleteSeasonRule(id)
    if (!deleted) throw new AppError(404, 'Season rule not found', 'NOT_FOUND')
    return reply.status(204).send()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // CITY MULTIPLIERS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/admin/pricing/cities', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const cities = await getAllCityMultipliers()
    return reply.send({ items: cities })
  })

  app.put('/admin/pricing/cities/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      multiplier: z.number().min(0).max(5).optional(),
      isActive: z.boolean().optional(),
    }).parse(request.body)

    const updated = await updateCityMultiplier(id, {
      multiplier: body.multiplier,
      is_active: body.isActive,
    })
    if (!updated) throw new AppError(404, 'City multiplier not found', 'NOT_FOUND')
    return reply.send(updated)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMOTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/admin/pricing/promotions', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const promos = await getAllPromotions()
    return reply.send({ items: promos })
  })

  app.post('/admin/pricing/promotions', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const body = z.object({
      name: z.string().min(1),
      discountPct: z.number().min(0).max(100),
      label: z.string().min(1),
      appliesTo: z.enum(['all', 'placement', 'upgrade', 'membership']).default('all'),
      validFrom: z.string().min(1),
      validUntil: z.string().nullable().default(null),
    }).parse(request.body)

    const promo = await createPromotion({
      name: body.name,
      discount_pct: body.discountPct,
      label: body.label,
      applies_to: body.appliesTo,
      valid_from: body.validFrom,
      valid_until: body.validUntil,
    })
    return reply.status(201).send(promo)
  })

  app.put('/admin/pricing/promotions/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      discountPct: z.number().min(0).max(100).optional(),
      label: z.string().min(1).optional(),
      validUntil: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    }).parse(request.body)

    const updated = await updatePromotion(id, {
      discount_pct: body.discountPct,
      label: body.label,
      valid_until: body.validUntil ?? undefined,
      is_active: body.isActive,
    })
    if (!updated) throw new AppError(404, 'Promotion not found', 'NOT_FOUND')
    return reply.send(updated)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PRICE PREVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/admin/pricing/preview', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)

    const { planId, city, month } = z.object({
      planId: z.string().uuid(),
      city: z.string().default('lisbon'),
      month: z.coerce.number().int().min(1).max(12).optional(),
    }).parse(request.query)

    const result = await computePrice(planId, city, month)
    if (!result) throw new AppError(404, 'Pricing plan not found', 'NOT_FOUND')
    return reply.send(result)
  })
}
