import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { NotFoundError } from '../../../shared/errors/AppError'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { createRouteSchema, updateRouteSchema, setRoutePlacesSchema } from './admin-routes.dto'
import {
  listAdminRoutes,
  getAdminRouteById,
  createRoute,
  updateRoute,
  archiveRoute,
  getAdminRoutePlaces,
  setRoutePlaces,
} from './admin-routes.query'

const idParamsSchema = z.object({ id: z.string().uuid() })

export async function adminRoutesRoutes(app: FastifyInstance) {

  // GET /admin/routes
  // List all routes regardless of status — for the dashboard management view.
  app.get('/admin/routes', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    const items = await listAdminRoutes()
    return reply.send({ items })
  })

  // GET /admin/routes/:id
  app.get('/admin/routes/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const route  = await getAdminRouteById(id)
    if (!route) throw new NotFoundError('Route')
    return reply.send(route)
  })

  // POST /admin/routes
  app.post('/admin/routes', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const input = createRouteSchema.parse(request.body)
    const route = await createRoute(input)
    return reply.status(201).send(route)
  })

  // PUT /admin/routes/:id
  app.put('/admin/routes/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const input  = updateRouteSchema.parse(request.body)
    const route  = await updateRoute(id, input)
    return reply.send(route)
  })

  // DELETE /admin/routes/:id  — archives the route (sets status = 'archived')
  app.delete('/admin/routes/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    await archiveRoute(id)
    return reply.status(204).send()
  })

  // GET /admin/routes/:id/places
  // Returns the ordered list of stops for a route.
  app.get('/admin/routes/:id/places', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const route  = await getAdminRouteById(id)
    if (!route) throw new NotFoundError('Route')
    const items = await getAdminRoutePlaces(id)
    return reply.send({ items })
  })

  // PUT /admin/routes/:id/places
  // Replaces all stops for a route in one operation.
  app.put('/admin/routes/:id/places', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const input  = setRoutePlacesSchema.parse(request.body)
    await setRoutePlaces(id, input)
    return reply.status(204).send()
  })
}
