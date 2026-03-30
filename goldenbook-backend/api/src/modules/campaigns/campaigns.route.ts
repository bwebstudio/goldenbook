import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateBusinessClient } from '../../shared/auth/businessAuth'
import { getCampaignById, getInventoryByCampaign, getNextAvailableSlot } from './campaigns.query'
import { checkPlaceEligibility } from './campaigns.validation'
import { AvailabilityQuerySchema } from './campaigns.dto'
import { AppError } from '../../shared/errors/AppError'

export async function campaignsRoutes(app: FastifyInstance) {

  // ── GET /campaigns/:id ──────────────────────────────────────────────────────
  app.get('/campaigns/:id', {
    preHandler: [authenticateBusinessClient],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const client = request.businessClient!

    const campaign = await getCampaignById(id)
    if (!campaign) {
      throw new AppError(404, 'Campaign not found', 'NOT_FOUND')
    }

    const eligibility = await checkPlaceEligibility(id, client.placeId)

    return reply.send({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        section: campaign.section,
        section_group: campaign.section_group,
        city_id: campaign.city_id,
        city_name: campaign.city_name,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        status: campaign.status,
        slot_limit: campaign.slot_limit,
        priority: campaign.priority,
        total_inventory: campaign.total_inventory,
        sold_inventory: campaign.sold_inventory,
        available_inventory: campaign.available_inventory,
      },
      place: {
        id: client.placeId,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
      },
      next_available: eligibility.next_available,
      alternatives: eligibility.alternatives,
    })
  })

  // ── GET /campaigns/:id/availability ─────────────────────────────────────────
  app.get('/campaigns/:id/availability', {
    preHandler: [authenticateBusinessClient],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const query = AvailabilityQuerySchema.parse(request.query)

    const campaign = await getCampaignById(id)
    if (!campaign) {
      throw new AppError(404, 'Campaign not found', 'NOT_FOUND')
    }

    // Default date range: today → campaign end
    const today = new Date().toISOString().split('T')[0]
    const dateFrom = query.date_from ?? today
    const dateTo = query.date_to ?? campaign.end_date.split('T')[0]

    const inventory = await getInventoryByCampaign(id, {
      date_from: dateFrom,
      date_to: dateTo,
    })

    const eligibility = await checkPlaceEligibility(id, query.place_id)
    const nextAvailable = await getNextAvailableSlot(id)

    return reply.send({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        section: campaign.section,
        section_group: campaign.section_group,
        status: campaign.status,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        total_inventory: campaign.total_inventory,
        available_inventory: campaign.available_inventory,
      },
      inventory: inventory.map((item) => ({
        position: item.position,
        date: item.date,
        time_bucket: item.time_bucket,
        available: item.status === 'available',
      })),
      place: {
        id: query.place_id,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
      },
      alternatives: eligibility.alternatives,
      next_available: nextAvailable,
    })
  })
}
