import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { AppError } from '../../../shared/errors/AppError'
import { db } from '../../../db/postgres'
import {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getSlotsByCampaign,
  getInventoryByCampaign,
  createInventoryItem,
  bulkCreateInventory,
} from '../../campaigns/campaigns.query'
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  CreateInventorySchema,
  BulkCreateInventorySchema,
  SECTION_TO_GROUP,
} from '../../campaigns/campaigns.dto'

function requireSuperAdmin(request: { adminUser?: { dashboardRole: string } }) {
  if (request.adminUser?.dashboardRole !== 'super_admin') {
    throw new AppError(403, 'Only super admins can manage campaigns', 'FORBIDDEN')
  }
}

export async function adminCampaignsRoutes(app: FastifyInstance) {

  // ── GET /admin/campaigns ────────────────────────────────────────────────────
  app.get('/admin/campaigns', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const { status, section, section_group } = z.object({
      status: z.string().optional(),
      section: z.string().optional(),
      section_group: z.string().optional(),
    }).parse(request.query)

    const campaigns = await getAllCampaigns({ status, section, section_group })
    return reply.send({ campaigns })
  })

  // ── GET /admin/campaigns/placements ─────────────────────────────────────────
  // Unified view: ALL active/past placements from purchases + requests + visibility
  app.get('/admin/campaigns/placements', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const { status: statusFilter, section: sectionFilter } = z.object({
      status: z.string().optional(),
      section: z.string().optional(),
    }).parse(request.query)

    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 0

    if (statusFilter) {
      conditions.push(`unified.status = $${++idx}`)
      params.push(statusFilter)
    }
    if (sectionFilter) {
      conditions.push(`unified.section = $${++idx}`)
      params.push(sectionFilter)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await db.query(`
      SELECT * FROM (
        -- Purchases (paid placements)
        SELECT
          pu.id,
          'purchase' AS source,
          pu.placement_type AS section,
          pu.city,
          pu.position,
          pu.unit_days AS duration_days,
          pu.final_price AS price,
          CASE
            WHEN pu.status = 'activated' AND pu.expires_at < now() THEN 'expired'
            ELSE pu.status
          END AS status,
          pu.activated_at AS starts_at,
          pu.expires_at AS ends_at,
          pu.created_at,
          p.name AS place_name,
          bc.contact_name,
          bc.contact_email
        FROM purchases pu
        LEFT JOIN places p ON p.id = pu.place_id
        LEFT JOIN business_clients bc ON bc.id = pu.business_client_id
        WHERE pu.placement_type IS NOT NULL

        UNION ALL

        -- Placement requests (editorial / free)
        SELECT
          pr.id,
          'request' AS source,
          pr.placement_type AS section,
          pr.city_id AS city,
          NULL::int AS position,
          pr.duration_days,
          NULL AS price,
          pr.status,
          pr.created_at AS starts_at,
          (pr.created_at + (pr.duration_days || ' days')::interval) AS ends_at,
          pr.created_at,
          pl.name AS place_name,
          bc.contact_name,
          bc.contact_email
        FROM placement_requests pr
        LEFT JOIN places pl ON pl.id = pr.place_id
        LEFT JOIN business_clients bc ON bc.id = pr.client_id

        UNION ALL

        -- Direct visibility records (editorial placements not linked to purchase/request)
        SELECT
          pv.id,
          'editorial' AS source,
          pv.surface AS section,
          NULL AS city,
          pv.priority AS position,
          EXTRACT(DAY FROM (pv.ends_at - pv.starts_at))::int AS duration_days,
          NULL AS price,
          CASE
            WHEN pv.is_active AND pv.ends_at > now() THEN 'active'
            WHEN pv.ends_at < now() THEN 'expired'
            ELSE 'inactive'
          END AS status,
          pv.starts_at,
          pv.ends_at,
          pv.created_at,
          pl.name AS place_name,
          NULL AS contact_name,
          NULL AS contact_email
        FROM place_visibility pv
        LEFT JOIN places pl ON pl.id = pv.place_id
        WHERE pv.source = 'editorial'
      ) unified
      ${where}
      ORDER BY unified.created_at DESC
    `, params).catch(() => ({ rows: [] as never[] }))

    return reply.send({ items: rows })
  })

  // ── PATCH /admin/campaigns/placements/:id ───────────────────────────────────
  // Update status of a purchase or placement_request (super_admin only)
  // PROPAGATES to place_visibility, campaign_slots, campaign_inventory
  app.patch('/admin/campaigns/placements/:id', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const { status, source } = z.object({
      status: z.string(),
      source: z.enum(['purchase', 'request']),
    }).parse(request.body)

    if (source === 'purchase') {
      const validStatuses = ['pending', 'paid', 'activated', 'expired', 'failed', 'refunded']
      if (!validStatuses.includes(status)) {
        throw new AppError(400, `Invalid purchase status: ${status}`, 'INVALID_STATUS')
      }

      // Update purchase
      const { rows } = await db.query<{ visibility_id: string | null; campaign_id: string | null }>(
        `UPDATE purchases SET status = $2, updated_at = now() WHERE id = $1
         RETURNING visibility_id, campaign_id`,
        [id, status],
      )
      if (!rows[0]) throw new AppError(404, 'Purchase not found', 'NOT_FOUND')

      const isDeactivating = ['expired', 'failed', 'refunded'].includes(status)
      const isActivating = status === 'activated'

      // Propagate to place_visibility
      if (rows[0].visibility_id) {
        if (isDeactivating) {
          await db.query(
            `UPDATE place_visibility SET is_active = false, ends_at = now(), updated_at = now()
             WHERE id = $1 AND is_active = true`,
            [rows[0].visibility_id],
          )
        } else if (isActivating) {
          await db.query(
            `UPDATE place_visibility SET is_active = true, updated_at = now()
             WHERE id = $1`,
            [rows[0].visibility_id],
          )
        }
      }

      // Propagate to campaign_slots
      if (rows[0].campaign_id) {
        if (isDeactivating) {
          await db.query(
            `UPDATE campaign_slots SET status = 'cancelled', updated_at = now()
             WHERE purchase_id = $1 AND status IN ('active', 'reserved')`,
            [id],
          )
          // Release campaign inventory
          await db.query(
            `UPDATE campaign_inventory SET status = 'available', purchase_id = NULL, place_id = NULL
             WHERE purchase_id = $1 AND status = 'sold'`,
            [id],
          )
        }
      }
    } else {
      const validStatuses = ['pending', 'approved', 'active', 'rejected', 'expired']
      if (!validStatuses.includes(status)) {
        throw new AppError(400, `Invalid request status: ${status}`, 'INVALID_STATUS')
      }

      // Update request
      const { rows } = await db.query<{ visibility_id: string | null }>(
        `UPDATE placement_requests SET status = $2, updated_at = now() WHERE id = $1
         RETURNING visibility_id`,
        [id, status],
      )
      if (!rows[0]) throw new AppError(404, 'Request not found', 'NOT_FOUND')

      // Propagate to place_visibility
      if (rows[0].visibility_id && ['rejected', 'expired'].includes(status)) {
        await db.query(
          `UPDATE place_visibility SET is_active = false, ends_at = now(), updated_at = now()
           WHERE id = $1 AND is_active = true`,
          [rows[0].visibility_id],
        )
      }
    }

    return reply.send({ success: true })
  })

  // ── GET /admin/campaigns/:id ────────────────────────────────────────────────
  app.get('/admin/campaigns/:id', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const campaign = await getCampaignById(id)

    if (!campaign) {
      throw new AppError(404, 'Campaign not found', 'NOT_FOUND')
    }

    const [slots, inventory] = await Promise.all([
      getSlotsByCampaign(id),
      getInventoryByCampaign(id),
    ])

    return reply.send({ campaign, slots, inventory })
  })

  // ── POST /admin/campaigns ───────────────────────────────────────────────────
  app.post('/admin/campaigns', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const data = CreateCampaignSchema.parse(request.body)

    if (new Date(data.end_date) <= new Date(data.start_date)) {
      throw new AppError(400, 'end_date must be after start_date', 'INVALID_DATES')
    }

    const sectionGroup = SECTION_TO_GROUP[data.section]
    if (!sectionGroup) {
      throw new AppError(400, `Invalid section: ${data.section}`, 'INVALID_SECTION')
    }

    const campaign = await createCampaign({
      ...data,
      section_group: sectionGroup,
    })
    return reply.status(201).send({ campaign })
  })

  // ── PATCH /admin/campaigns/:id ──────────────────────────────────────────────
  app.patch('/admin/campaigns/:id', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const data = UpdateCampaignSchema.parse(request.body)

    const existing = await getCampaignById(id)
    if (!existing) {
      throw new AppError(404, 'Campaign not found', 'NOT_FOUND')
    }

    // If campaign is active, restrict critical changes
    if (existing.status === 'active') {
      if (data.section && data.section !== existing.section) {
        throw new AppError(409, 'Cannot change section of an active campaign', 'ACTIVE_CAMPAIGN_RESTRICTION')
      }
    }

    // Resolve section_group if section changes
    const updateData: Record<string, unknown> = { ...data }
    if (data.section) {
      const sg = SECTION_TO_GROUP[data.section]
      if (!sg) throw new AppError(400, `Invalid section: ${data.section}`, 'INVALID_SECTION')
      updateData.section_group = sg
    }

    // Validate dates
    const startDate = data.start_date ?? existing.start_date
    const endDate = data.end_date ?? existing.end_date
    if (new Date(endDate) <= new Date(startDate)) {
      throw new AppError(400, 'end_date must be after start_date', 'INVALID_DATES')
    }

    const updated = await updateCampaign(id, updateData as Parameters<typeof updateCampaign>[1])
    return reply.send({ campaign: updated })
  })

  // ── DELETE /admin/campaigns/:id ─────────────────────────────────────────────
  app.delete('/admin/campaigns/:id', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const existing = await getCampaignById(id)
    if (!existing) throw new AppError(404, 'Campaign not found', 'NOT_FOUND')

    if (existing.status !== 'draft') {
      throw new AppError(409, 'Only draft campaigns can be deleted', 'CANNOT_DELETE_NON_DRAFT')
    }

    const deleted = await deleteCampaign(id)
    if (!deleted) throw new AppError(500, 'Failed to delete campaign', 'DELETE_FAILED')

    return reply.send({ success: true })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // INVENTORY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /admin/campaigns/:id/inventory ──────────────────────────────────────
  app.get('/admin/campaigns/:id/inventory', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const { date_from, date_to, status } = z.object({
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      status: z.string().optional(),
    }).parse(request.query)

    const campaign = await getCampaignById(id)
    if (!campaign) throw new AppError(404, 'Campaign not found', 'NOT_FOUND')

    const inventory = await getInventoryByCampaign(id, { date_from, date_to, status })
    return reply.send({ campaign, inventory })
  })

  // ── POST /admin/campaigns/:id/inventory ─────────────────────────────────────
  // Create a single inventory item
  app.post('/admin/campaigns/:id/inventory', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const data = CreateInventorySchema.parse(request.body)

    const campaign = await getCampaignById(id)
    if (!campaign) throw new AppError(404, 'Campaign not found', 'NOT_FOUND')

    const item = await createInventoryItem({
      campaign_id: id,
      position: data.position,
      date: data.date,
      time_bucket: data.time_bucket ?? null,
    })
    return reply.status(201).send({ item })
  })

  // ── POST /admin/campaigns/:id/inventory/bulk ────────────────────────────────
  // Bulk create inventory across date range and positions
  app.post('/admin/campaigns/:id/inventory/bulk', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    requireSuperAdmin(request)

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const data = BulkCreateInventorySchema.parse(request.body)

    const campaign = await getCampaignById(id)
    if (!campaign) throw new AppError(404, 'Campaign not found', 'NOT_FOUND')

    if (new Date(data.date_to) < new Date(data.date_from)) {
      throw new AppError(400, 'date_to must be >= date_from', 'INVALID_DATES')
    }

    const created = await bulkCreateInventory({
      campaign_id: id,
      positions: data.positions,
      date_from: data.date_from,
      date_to: data.date_to,
      time_buckets: data.time_buckets ?? null,
    })

    return reply.status(201).send({ created })
  })
}
