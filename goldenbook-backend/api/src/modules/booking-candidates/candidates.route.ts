import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../shared/auth/dashboardAuth'
import {
  getCandidatesForPlace,
  generateCandidatesForPlaceId,
  generateCandidatesForAllPlaces,
  setActiveCandidate,
  deactivateCandidate,
  autoActivateBestCandidate,
  addManualCandidate,
  updateCandidateUrl,
  deleteCandidate,
} from './candidates.query'

export async function candidatesRoutes(app: FastifyInstance) {
  app.get('/admin/places/:id/candidates', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    return reply.send({ items: await getCandidatesForPlace(id) })
  })

  app.post('/admin/places/:id/candidates/generate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    return reply.send({ generated: await generateCandidatesForPlaceId(id) })
  })

  app.post('/admin/candidates/generate-all', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    return reply.send(await generateCandidatesForAllPlaces())
  })

  app.post('/admin/candidates/:candidateId/activate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { candidateId } = z.object({ candidateId: z.string().uuid() }).parse(request.params)
    const { placeId } = z.object({ placeId: z.string().uuid() }).parse(request.body as any)
    await setActiveCandidate(placeId, candidateId)
    return reply.send({ activated: true })
  })

  app.post('/admin/candidates/:candidateId/deactivate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { candidateId } = z.object({ candidateId: z.string().uuid() }).parse(request.params)
    await deactivateCandidate(candidateId)
    return reply.send({ deactivated: true })
  })

  app.post('/admin/places/:id/candidates/auto-activate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const activatedId = await autoActivateBestCandidate(id)
    return reply.send({ activated: !!activatedId, candidateId: activatedId })
  })

  // Add a link manually
  app.post('/admin/places/:id/candidates/add', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const { url, setActive } = z.object({
      url: z.string().url(),
      setActive: z.boolean().default(true),
    }).parse(request.body)
    const candidate = await addManualCandidate(id, 'website', url, setActive)
    return reply.send(candidate)
  })

  // Edit a link
  app.put('/admin/candidates/:candidateId', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { candidateId } = z.object({ candidateId: z.string().uuid() }).parse(request.params)
    const { url } = z.object({ url: z.string().url() }).parse(request.body)
    await updateCandidateUrl(candidateId, url)
    return reply.send({ updated: true })
  })

  // Delete a link
  app.delete('/admin/candidates/:candidateId', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { candidateId } = z.object({ candidateId: z.string().uuid() }).parse(request.params)
    await deleteCandidate(candidateId)
    return reply.send({ deleted: true })
  })
}
