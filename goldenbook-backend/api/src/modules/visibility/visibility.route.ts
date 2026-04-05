import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../shared/auth/dashboardAuth'
import { AppError } from '../../shared/errors/AppError'
import { getVisibilitiesForPlace, getAllVisibilities, createVisibility, updateVisibility, deleteVisibility } from './visibility.query'

function requireSuperAdmin(request: { adminUser?: { dashboardRole: string } }) {
  if (request.adminUser?.dashboardRole !== 'super_admin') {
    throw new AppError(403, 'Only super admins can manage visibility placements', 'FORBIDDEN')
  }
}

const surfaces = [
  'golden_picks', 'hidden_spots', 'now',
  'search_priority', 'category_featured', 'concierge',
  'route_featured', 'route_sponsor', 'new_on_goldenbook',
] as const
const types = ['editorial', 'sponsored'] as const
const sources = ['sponsored', 'system', 'superadmin'] as const
const scopeTypes = ['main_category', 'subcategory', 'search_vertical'] as const
const slots = ['morning', 'afternoon', 'dinner', 'night'] as const

export async function visibilityRoutes(app: FastifyInstance) {
  // Global list — all placements across all cities
  app.get('/admin/visibility', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    const items = await getAllVisibilities()
    return reply.send({ items })
  })

  app.get('/admin/places/:id/visibility', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    return reply.send({ items: await getVisibilitiesForPlace(id) })
  })

  app.post('/admin/places/:id/visibility', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      surface: z.enum(surfaces),
      visibilityType: z.enum(types).default('editorial'),
      priority: z.number().int().default(0),
      startsAt: z.string().nullable().default(null),
      endsAt: z.string().nullable().default(null),
      notes: z.string().nullable().default(null),
      source: z.enum(sources).default('system'),
      placementSlot: z.enum(slots).nullable().default(null),
      scopeType: z.enum(scopeTypes).nullable().default(null),
      scopeId: z.string().nullable().default(null),
    }).parse(request.body)
    try {
      const row = await createVisibility({ placeId: id, ...body })
      return reply.status(201).send(row)
    } catch (err: any) {
      const inventoryErrors = ['DUPLICATE_PLACEMENT:', 'DISCOVER_EXCLUSIVE:', 'SURFACE_EXCLUSIVE:', 'ANTI_DOMINATION:', 'INVENTORY_FULL:']
      if (inventoryErrors.some(prefix => err.message?.startsWith(prefix))) {
        throw new AppError(409, err.message, 'INVENTORY_CONFLICT')
      }
      throw err
    }
  })

  app.put('/admin/visibility/:visId', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const { visId } = z.object({ visId: z.string().uuid() }).parse(request.params)
    const body = z.object({
      surface: z.enum(surfaces).optional(),
      visibilityType: z.enum(types).optional(),
      priority: z.number().int().optional(),
      startsAt: z.string().nullable().optional(),
      endsAt: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
      notes: z.string().nullable().optional(),
    }).parse(request.body)
    await updateVisibility(visId, body)
    return reply.send({ updated: true })
  })

  app.delete('/admin/visibility/:visId', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    requireSuperAdmin(request)
    const { visId } = z.object({ visId: z.string().uuid() }).parse(request.params)
    await deleteVisibility(visId)
    return reply.send({ deleted: true })
  })
}
