import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser, requireSuperAdmin } from '../../shared/auth/dashboardAuth'
import {
  getActiveCuratedRoutes,
  getCuratedRouteById,
  countActiveByCity,
  createCuratedRoute,
  deactivateRoute,
  getAdminCuratedRoutes,
  updateCuratedRoute,
} from './curated-routes.query'
import { generateEditorialRoute } from './curated-routes.generation'

// ─── Public routes (mobile app, no auth) ────────────────────────────────────

export async function curatedRoutesRoutes(app: FastifyInstance) {

  // GET /curated-routes?city=porto&locale=pt
  app.get('/curated-routes', async (request, reply) => {
    const schema = z.object({
      city:   z.string().min(1),
      locale: z.string().min(2).max(5).default('en'),
    })
    const { city, locale } = schema.parse(request.query)

    const routes = await getActiveCuratedRoutes(city, locale)
    return reply.send({ items: routes })
  })

  // GET /curated-routes/:id?locale=pt
  app.get('/curated-routes/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const querySchema = z.object({
      locale: z.string().min(2).max(5).default('en'),
    })

    const { id } = paramsSchema.parse(request.params)
    const { locale } = querySchema.parse(request.query)

    const route = await getCuratedRouteById(id, locale)
    if (!route) {
      return reply.status(404).send({ error: 'Route not found' })
    }

    return reply.send(route)
  })
}

// ─── Admin routes (dashboard, requires auth) ────────────────────────────────

export async function adminCuratedRoutesRoutes(app: FastifyInstance) {

  // GET /admin/curated-routes
  app.get('/admin/curated-routes', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const schema = z.object({
      city:      z.string().optional(),
      routeType: z.string().optional(),
      isActive:  z.enum(['true', 'false']).optional(),
    })
    const { city, routeType, isActive } = schema.parse(request.query)

    const routes = await getAdminCuratedRoutes({
      citySlug: city,
      routeType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    })

    return reply.send({ items: routes })
  })

  // GET /admin/curated-routes/availability?city=porto
  app.get('/admin/curated-routes/availability', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const schema = z.object({ city: z.string().min(1) })
    const { city } = schema.parse(request.query)

    const counts = await countActiveByCity(city)

    return reply.send({
      total: counts.total,
      editorial: counts.editorial,
      sponsored: counts.sponsored,
      availableSponsored: 2 - counts.sponsored,
    })
  })

  // POST /admin/curated-routes/generate
  app.post('/admin/curated-routes/generate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const schema = z.object({
      city: z.string().min(1),
    })
    const { city } = schema.parse(request.body)

    const generated = await generateEditorialRoute(city)
    if (!generated) {
      return reply.status(422).send({
        error: 'GENERATION_FAILED',
        message: 'Could not generate an editorial route for this city. Not enough eligible places.',
      })
    }

    // Default expiration: 15 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 15)

    const result = await createCuratedRoute({
      citySlug: generated.citySlug,
      routeType: generated.routeType,
      templateType: generated.templateType,
      sponsorPlaceId: generated.sponsorPlaceId,
      title: generated.title,
      summary: generated.summary,
      expiresAt,
      stops: generated.stops,
    })

    return reply.status(201).send({ id: result.id, title: generated.title })
  })

  // GET /admin/curated-routes/:id?locale=pt — single route detail for editing.
  // Locale drives the translation fallback chain (requested → raw columns).
  // Valid values: any 2–5 char locale code; defaults to 'en' for back-compat.
  app.get('/admin/curated-routes/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const { locale } = z.object({
      locale: z.string().min(2).max(5).default('en'),
    }).parse(request.query)
    const route = await getCuratedRouteById(id, locale)
    if (!route) return reply.status(404).send({ error: 'Route not found' })
    return reply.send(route)
  })

  // POST /admin/curated-routes — create route from scratch (admin only)
  app.post('/admin/curated-routes', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const schema = z.object({
      citySlug:    z.string().min(1),
      routeType:   z.enum(['editorial', 'sponsored']).default('editorial'),
      templateType: z.string().nullable().optional(),
      sponsorPlaceId: z.string().uuid().nullable().optional(),
      title:       z.string().min(1),
      summary:     z.string().nullable().optional(),
      stops:       z.array(z.object({
        placeId:       z.string().uuid(),
        stopOrder:     z.number().int().min(1).max(3),
        editorialNote: z.string().nullable().optional(),
      })).min(1).max(5),
    })
    const data = schema.parse(request.body)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 15)

    const result = await createCuratedRoute({
      citySlug: data.citySlug,
      routeType: data.routeType,
      templateType: data.templateType ?? null,
      sponsorPlaceId: data.sponsorPlaceId ?? null,
      title: data.title,
      summary: data.summary ?? null,
      expiresAt,
      stops: data.stops.map(s => ({
        placeId: s.placeId,
        stopOrder: s.stopOrder,
        editorialNote: s.editorialNote ?? null,
      })),
    })

    return reply.status(201).send({ id: result.id })
  })

  // PUT /admin/curated-routes/:id — update route (title, summary, stops)
  // Edit is a super_admin-only action. Editors can view/create/deactivate only.
  app.put('/admin/curated-routes/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const schema = z.object({
      title:   z.string().min(1).optional(),
      summary: z.string().nullable().optional(),
      stops:   z.array(z.object({
        placeId:       z.string().uuid(),
        stopOrder:     z.number().int().min(1).max(3),
        editorialNote: z.string().nullable().optional(),
      })).min(1).max(5).optional(),
    })
    const data = schema.parse(request.body)

    await updateCuratedRoute(id, {
      title: data.title,
      summary: data.summary,
      stops: data.stops?.map(s => ({
        placeId: s.placeId,
        stopOrder: s.stopOrder,
        editorialNote: s.editorialNote ?? null,
      })),
    })

    return reply.send({ updated: true })
  })

  // POST /admin/curated-routes/:id/deactivate
  app.post('/admin/curated-routes/:id/deactivate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    await deactivateRoute(id)

    return reply.send({ deactivated: true })
  })
}
