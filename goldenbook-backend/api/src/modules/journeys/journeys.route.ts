import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../shared/auth/authPlugin'
import { NotFoundError } from '../../shared/errors/AppError'
import {
  getActiveJourney,
  startJourney,
  updateStopStatus,
  completeJourney,
} from './journeys.query'
import { toJourneyDTO, toJourneyStopDTO } from './journeys.dto'

// ─── Validators ───────────────────────────────────────────────────────────────

const journeyIdParams = z.object({
  journeyId: z.string().uuid(),
})

const routeSlugQuery = z.object({
  routeSlug: z.string().min(1),
})

const startJourneyBody = z.object({
  routeSlug: z.string().min(1),
  places: z
    .array(
      z.object({
        externalId: z.string().min(1),
        name: z.string().min(1),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1, 'Route must have at least one place'),
})

const updateStopBody = z.object({
  placeExternalId: z.string().min(1),
  status: z.enum(['upcoming', 'active', 'arrived', 'completed', 'skipped']),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function journeysRoutes(app: FastifyInstance) {
  // ── GET /me/journeys/active?routeSlug= ──────────────────────────────────────
  // Returns the current active journey for a route, or 404 if none.
  app.get(
    '/me/journeys/active',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { routeSlug } = routeSlugQuery.parse(request.query)
      const journey = await getActiveJourney(request.user.sub, routeSlug)

      if (!journey) {
        throw new NotFoundError(`No active journey found for route "${routeSlug}"`)
      }

      return reply.send(toJourneyDTO(journey))
    },
  )

  // ── POST /me/journeys ────────────────────────────────────────────────────────
  // Starts a new journey. Any existing active journey for the same route is
  // automatically abandoned (idempotent restart).
  app.post(
    '/me/journeys',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const body = startJourneyBody.parse(request.body)

      const journey = await startJourney({
        userId: request.user.sub,
        routeSlug: body.routeSlug,
        places: body.places,
      })

      return reply.status(201).send(toJourneyDTO(journey))
    },
  )

  // ── PATCH /me/journeys/:journeyId/stops ─────────────────────────────────────
  // Updates the status of a single stop (arrived, completed, skipped, etc.)
  app.patch(
    '/me/journeys/:journeyId/stops',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { journeyId } = journeyIdParams.parse(request.params)
      const { placeExternalId, status } = updateStopBody.parse(request.body)

      const stop = await updateStopStatus(
        journeyId,
        request.user.sub,
        placeExternalId,
        status,
      )

      if (!stop) {
        throw new NotFoundError('Journey not found or stop does not belong to this user')
      }

      return reply.send(toJourneyStopDTO(stop))
    },
  )

  // ── PATCH /me/journeys/:journeyId/complete ───────────────────────────────────
  // Marks the journey as completed.
  app.patch(
    '/me/journeys/:journeyId/complete',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { journeyId } = journeyIdParams.parse(request.params)

      const journey = await completeJourney(journeyId, request.user.sub)

      if (!journey) {
        throw new NotFoundError('Active journey not found or does not belong to this user')
      }

      return reply.send({ id: journey.id, status: journey.status, completedAt: journey.completed_at })
    },
  )
}
