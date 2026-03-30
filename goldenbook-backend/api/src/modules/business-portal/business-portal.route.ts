import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateBusinessClient, getBusinessClientByUserId } from '../../shared/auth/businessAuth'
import { authenticateDashboardUser } from '../../shared/auth/dashboardAuth'
import { authenticate } from '../../shared/auth/authPlugin'
import { AppError } from '../../shared/errors/AppError'
import { db } from '../../db/postgres'
import {
  getRequestsByClient,
  createRequest,
  getAllRequests,
  getRequestByIdAdmin,
  updateRequestStatus,
  approveAndCreateVisibility,
} from './placement-requests.query'
import { getPlaceImages } from '../admin/places/admin-images.query'

const placementTypes = [
  'golden_picks', 'now', 'hidden_gems', 'category_featured',
  'search_priority', 'new_on_goldenbook', 'routes', 'concierge',
  'route_featured_stop', 'route_sponsor',
  'extra_images', 'extended_description', 'listing_premium_pack',
] as const

const slots = ['morning', 'afternoon', 'dinner', 'night'] as const
const scopeTypes = ['main_category', 'subcategory', 'search_vertical'] as const

const createRequestSchema = z.object({
  placementType: z.enum(placementTypes),
  cityId: z.string().nullable().default(null),
  slot: z.enum(slots).nullable().default(null),
  scopeType: z.enum(scopeTypes).nullable().default(null),
  scopeId: z.string().nullable().default(null),
  routeId: z.string().uuid().nullable().default(null),
  durationDays: z.number().int().min(1).max(365).default(30),
})

export async function businessPortalRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT ENDPOINTS — require business_client auth
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /business/me ────────────────────────────────────────────────────
  // Returns business client info + linked place summary
  app.get('/business/me', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!

    const { rows } = await db.query<{
      name: string; slug: string; short_description: string | null
      hero_bucket: string | null; hero_path: string | null
      city_name: string | null; city_slug: string | null
      status: string
    }>(`
      SELECT
        p.name, p.slug, p.short_description,
        hero_img.bucket AS hero_bucket, hero_img.path AS hero_path,
        d.name AS city_name, d.slug AS city_slug,
        p.status
      FROM places p
      LEFT JOIN destinations d ON d.id = p.destination_id
      LEFT JOIN LATERAL (
        SELECT ma.bucket, ma.path FROM place_images pi
        JOIN media_assets ma ON ma.id = pi.asset_id
        WHERE pi.place_id = p.id AND pi.image_role IN ('hero','cover')
        ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC LIMIT 1
      ) hero_img ON true
      WHERE p.id = $1
    `, [client.placeId])

    const place = rows[0]

    return reply.send({
      client: {
        id: client.id,
        contactName: client.contactName,
        contactEmail: client.contactEmail,
      },
      place: place ? {
        id: client.placeId,
        name: place.name,
        slug: place.slug,
        shortDescription: place.short_description,
        heroImage: { bucket: place.hero_bucket, path: place.hero_path },
        cityName: place.city_name,
        citySlug: place.city_slug,
        status: place.status,
      } : null,
    })
  })

  // ── GET /business/place ─────────────────────────────────────────────────
  // Returns editable fields using translation tables with locale fallback
  app.get('/business/place', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!
    const { locale } = z.object({ locale: z.string().default('pt') }).parse(request.query)

    const { rows } = await db.query<{
      id: string; name: string; slug: string
      short_description: string | null; full_description: string | null
      website_url: string | null; phone: string | null; email: string | null
      booking_url: string | null
      address_line: string | null
      latitude: number | null; longitude: number | null
    }>(`
      SELECT p.id, p.slug,
             COALESCE(pt.name, pt_lang.name, pt_fb.name, p.name) AS name,
             COALESCE(pt.short_description, pt_lang.short_description, pt_fb.short_description, p.short_description) AS short_description,
             COALESCE(pt.full_description, pt_lang.full_description, pt_fb.full_description, p.full_description) AS full_description,
             p.website_url, p.phone, p.email, p.booking_url,
             p.address_line, p.latitude, p.longitude
      FROM places p
      LEFT JOIN place_translations pt      ON pt.place_id = p.id AND pt.locale = $2
      LEFT JOIN place_translations pt_lang ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
      LEFT JOIN place_translations pt_fb   ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
      WHERE p.id = $1
    `, [client.placeId, locale])

    if (!rows[0]) throw new AppError(404, 'Place not found', 'NOT_FOUND')
    const row = rows[0]

    // Fetch all recent change requests (pending + recently resolved)
    const { rows: changeRequests } = await db.query<{
      field_name: string; new_value: string; status: string; review_note: string | null; created_at: string; reviewed_at: string | null
    }>(`
      SELECT field_name, new_value, status, review_note, created_at, reviewed_at
      FROM place_change_requests
      WHERE place_id = $1 AND (status = 'pending' OR reviewed_at > now() - interval '7 days')
      ORDER BY created_at DESC
    `, [client.placeId]).catch(() => ({ rows: [] as { field_name: string; new_value: string; status: string; review_note: string | null; created_at: string; reviewed_at: string | null }[] }))

    return reply.send({
      id: row.id, name: row.name, slug: row.slug,
      short_description: row.short_description,
      description: row.full_description,
      website_url: row.website_url, phone: row.phone, email: row.email,
      booking_url: row.booking_url,
      address: row.address_line,
      latitude: row.latitude, longitude: row.longitude,
      changeRequests,
    })
  })

  // ── GET /business/images ─────────────────────────────────────────────────
  // Returns the client's place images (cover + gallery)
  app.get('/business/images', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const images = await getPlaceImages(request.businessClient!.placeId)
    return reply.send({ items: images })
  })

  // ── PUT /business/place ─────────────────────────────────────────────────
  // Instant fields update directly. Approval-required fields create change requests.
  app.put('/business/place', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!

    const body = z.object({
      name: z.string().min(1).optional(),
      shortDescription: z.string().max(500).nullable().optional(),
      description: z.string().max(4000).nullable().optional(),
      websiteUrl: z.string().url().nullable().optional(),
      phone: z.string().max(30).nullable().optional(),
      email: z.string().email().nullable().optional(),
      bookingUrl: z.string().url().nullable().optional(),
      address: z.string().max(500).nullable().optional(),
    }).parse(request.body)

    // Fields that require editorial approval
    const APPROVAL_FIELDS: Record<string, string> = {
      name: 'name',
      shortDescription: 'short_description',
      description: 'full_description',
    }

    // Get current values using the SAME source the user sees (translation tables with fallback)
    const { rows: currentRows } = await db.query<{
      name: string; short_description: string | null; full_description: string | null
    }>(`
      SELECT
        COALESCE(pt.name, pt_fb.name, p.name) AS name,
        COALESCE(pt.short_description, pt_fb.short_description, p.short_description) AS short_description,
        COALESCE(pt.full_description, pt_fb.full_description, p.full_description) AS full_description
      FROM places p
      LEFT JOIN place_translations pt    ON pt.place_id = p.id AND pt.locale = 'pt'
      LEFT JOIN place_translations pt_fb ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
      WHERE p.id = $1
    `, [client.placeId])
    const current = currentRows[0]

    const pendingCreated: string[] = []

    // Create change requests for approval-required fields
    if (current) {
      for (const [bodyKey, dbCol] of Object.entries(APPROVAL_FIELDS)) {
        const newVal = (body as Record<string, unknown>)[bodyKey]
        if (newVal === undefined) continue
        const oldVal = (current as Record<string, unknown>)[dbCol]
        const newStr = newVal === null ? '' : String(newVal)
        const oldStr = oldVal === null ? '' : String(oldVal)
        if (newStr !== oldStr) {
          try {
            await db.query(
              `INSERT INTO place_change_requests (place_id, field_name, old_value, new_value, created_by)
               VALUES ($1, $2, $3, $4, $5)`,
              [client.placeId, dbCol, oldStr, newStr, client.userId],
            )
            pendingCreated.push(dbCol)
            app.log.info(`[change-request] Created for place=${client.placeId} field=${dbCol}`)
          } catch (err) {
            // Table may not exist yet — fall back to direct update
            app.log.warn(`[change-request] Could not create (table missing?): ${err}`)
          }
        }
      }
    }

    // If no change requests were created (no text changes detected), no action needed for approval fields

    // Instant fields — update directly
    const sets: string[] = []
    const params: unknown[] = []
    let i = 1
    function add(col: string, val: unknown) { sets.push(`${col} = $${i++}`); params.push(val) }

    if (body.websiteUrl !== undefined) add('website_url', body.websiteUrl)
    if (body.phone !== undefined) add('phone', body.phone)
    if (body.email !== undefined) add('email', body.email)
    if (body.bookingUrl !== undefined) add('booking_url', body.bookingUrl)
    if (body.address !== undefined) add('address_line', body.address)

    if (sets.length > 0) {
      sets.push('updated_at = now()')
      params.push(client.placeId)
      await db.query(`UPDATE places SET ${sets.join(', ')} WHERE id = $${i}`, params)
    }

    app.log.info(`[business-place-update] instant=${sets.length > 0} pending=${pendingCreated.length} fields=${pendingCreated.join(',')}`)

    return reply.send({
      updated: true,
      pendingApproval: pendingCreated.length > 0,
      pendingFields: pendingCreated,
    })
  })

  // ── GET /business/requests ──────────────────────────────────────────────
  // List all placement requests for this client
  app.get('/business/requests', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const items = await getRequestsByClient(request.businessClient!.id)
    return reply.send({ items })
  })

  // ── GET /business/purchases ──────────────────────────────────────────────
  // List all paid purchases/campaigns for this client
  app.get('/business/purchases', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!
    const { rows } = await db.query<{
      id: string; placement_type: string | null; city: string | null
      position: number | null; unit_days: number; final_price: string
      status: string; activated_at: string | null; expires_at: string | null
      stripe_checkout_session_id: string | null; created_at: string
    }>(
      `SELECT id, placement_type, city, position, unit_days, final_price,
              status, activated_at, expires_at, stripe_checkout_session_id, created_at
       FROM purchases
       WHERE business_client_id = $1
       ORDER BY created_at DESC`,
      [client.id],
    ).catch(() => ({ rows: [] as never[] }))
    return reply.send({ items: rows })
  })

  // ── POST /business/requests ─────────────────────────────────────────────
  // Submit a new placement request
  app.post('/business/requests', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!
    const body = createRequestSchema.parse(request.body)

    const item = await createRequest({
      placeId: client.placeId,
      clientId: client.id,
      placementType: body.placementType,
      cityId: body.cityId,
      slot: body.slot,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      routeId: body.routeId,
      durationDays: body.durationDays,
    })

    return reply.status(201).send(item)
  })

  // ── GET /business/overview ──────────────────────────────────────────────
  // Dashboard summary: active campaigns, pending requests, stats
  app.get('/business/overview', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!

    const { rows: stats } = await db.query<{
      total: string; pending: string; active: string; approved: string
    }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
        COUNT(*) FILTER (WHERE status = 'active')::text AS active,
        COUNT(*) FILTER (WHERE status = 'approved')::text AS approved
      FROM placement_requests
      WHERE client_id = $1
    `, [client.id])

    const { rows: activeCampaigns } = await db.query<{
      id: string; placement_type: string; status: string
      starts_at: string | null; ends_at: string | null
    }>(`
      SELECT pr.id, pr.placement_type, pr.status,
             pv.starts_at, pv.ends_at
      FROM placement_requests pr
      LEFT JOIN place_visibility pv ON pv.id = pr.visibility_id
      WHERE pr.client_id = $1 AND pr.status IN ('active', 'approved')
      ORDER BY pr.created_at DESC
    `, [client.id])

    // Also include paid purchases
    const { rows: activePurchases } = await db.query<{
      id: string; placement_type: string; status: string
      starts_at: string | null; ends_at: string | null; city: string | null; final_price: string
    }>(`
      SELECT id, placement_type, status,
             activated_at AS starts_at, expires_at AS ends_at, city, final_price
      FROM purchases
      WHERE business_client_id = $1 AND status IN ('paid', 'activated')
      ORDER BY created_at DESC
    `, [client.id]).catch(() => ({ rows: [] as never[] }))

    // Merge into stats
    const purchaseActive = activePurchases.length
    const totalActive = parseInt(stats[0]?.active ?? '0') + purchaseActive

    return reply.send({
      stats: {
        total: parseInt(stats[0]?.total ?? '0') + purchaseActive,
        pending: parseInt(stats[0]?.pending ?? '0'),
        active: totalActive,
        approved: parseInt(stats[0]?.approved ?? '0'),
      },
      activeCampaigns: [
        ...activeCampaigns,
        ...activePurchases.map((p) => ({
          id: p.id,
          placement_type: p.placement_type ?? 'unknown',
          status: p.status === 'activated' ? 'active' : p.status,
          starts_at: p.starts_at,
          ends_at: p.ends_at,
        })),
      ],
    })
  })

  // ── GET /business/analytics ───────────────────────────────────────────────
  app.get('/business/analytics', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!
    const { period } = z.object({ period: z.enum(['7d', '30d', '90d']).default('30d') }).parse(request.query)

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const placeId = client.placeId

    const [views, websiteClicks, directions, reservations] = await Promise.all([
      db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM place_view_events WHERE place_id = $1 AND created_at >= $2', [placeId, since]),
      db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM place_website_click_events WHERE place_id = $1 AND created_at >= $2', [placeId, since]),
      db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM place_direction_events WHERE place_id = $1 AND created_at >= $2', [placeId, since]),
      db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM booking_click_events WHERE place_id = $1 AND created_at >= $2', [placeId, since]).catch(() => ({ rows: [{ count: '0' }] })),
    ])

    return reply.send({
      period,
      views: parseInt(views.rows[0]?.count ?? '0'),
      websiteClicks: parseInt(websiteClicks.rows[0]?.count ?? '0'),
      directions: parseInt(directions.rows[0]?.count ?? '0'),
      reservations: parseInt(reservations.rows[0]?.count ?? '0'),
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS — superadmin reviews and approves requests
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /admin/purchases ─────────────────────────────────────────────────
  // All purchases across all business clients (for Employee/Superadmin dashboards)
  app.get('/admin/purchases', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    const { rows } = await db.query<{
      id: string; business_client_id: string; place_id: string | null
      placement_type: string | null; city: string | null; position: number | null
      unit_days: number; final_price: string; status: string
      activated_at: string | null; expires_at: string | null
      stripe_checkout_session_id: string | null; created_at: string
      place_name: string | null; contact_name: string | null; contact_email: string | null
    }>(`
      SELECT pu.id, pu.business_client_id, pu.place_id,
             pu.placement_type, pu.city, pu.position,
             pu.unit_days, pu.final_price, pu.status,
             pu.activated_at, pu.expires_at,
             pu.stripe_checkout_session_id, pu.created_at,
             p.name AS place_name,
             bc.contact_name, bc.contact_email
      FROM purchases pu
      LEFT JOIN places p ON p.id = pu.place_id
      LEFT JOIN business_clients bc ON bc.id = pu.business_client_id
      ORDER BY pu.created_at DESC
    `).catch(() => ({ rows: [] as never[] }))
    return reply.send({ items: rows })
  })

  // ── GET /admin/placement-requests ───────────────────────────────────────
  app.get('/admin/placement-requests', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { status } = z.object({ status: z.string().optional() }).parse(request.query)
    const items = await getAllRequests(status)
    return reply.send({ items })
  })

  // ── GET /admin/placement-requests/:id ───────────────────────────────────
  app.get('/admin/placement-requests/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const item = await getRequestByIdAdmin(id)
    if (!item) throw new AppError(404, 'Request not found', 'NOT_FOUND')
    return reply.send(item)
  })

  // ── POST /admin/placement-requests/:id/approve ──────────────────────────
  // Approves a request and creates the corresponding visibility record
  app.post('/admin/placement-requests/:id/approve', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    // Only super_admin can approve
    if (request.adminUser?.dashboardRole !== 'super_admin') {
      throw new AppError(403, 'Only super admins can approve placement requests', 'FORBIDDEN')
    }

    const body = z.object({
      adminNotes: z.string().nullable().default(null),
    }).parse(request.body)

    const visibilityId = await approveAndCreateVisibility(id, body.adminNotes)
    return reply.send({ approved: true, visibilityId })
  })

  // ── POST /admin/placement-requests/:id/reject ──────────────────────────
  app.post('/admin/placement-requests/:id/reject', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    if (request.adminUser?.dashboardRole !== 'super_admin') {
      throw new AppError(403, 'Only super admins can reject placement requests', 'FORBIDDEN')
    }

    const body = z.object({
      adminNotes: z.string().nullable().default(null),
    }).parse(request.body)

    await updateRequestStatus(id, 'rejected', body.adminNotes, null)
    return reply.send({ rejected: true })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS CLIENT REGISTRATION CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /business/check ─────────────────────────────────────────────────
  // Check if the logged-in user has a business account
  app.get('/business/check', { preHandler: [authenticate] }, async (request, reply) => {
    const client = await getBusinessClientByUserId(request.user.sub)
    return reply.send({
      isBusiness: !!client,
      client: client ? {
        id: client.id,
        placeId: client.placeId,
        contactName: client.contactName,
      } : null,
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // EDITORIAL REVIEW QUEUE — pending change requests from business clients
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /admin/review-queue ─────────────────────────────────────────────
  app.get('/admin/review-queue', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { status: filterStatus } = z.object({ status: z.string().default('pending') }).parse(request.query)

    try {
      const { rows } = await db.query<{
        id: string; place_id: string; place_name: string; place_slug: string
        field_name: string; old_value: string | null; new_value: string | null
        status: string; created_by: string | null; created_at: string
        review_note: string | null; reviewed_by: string | null; reviewed_at: string | null
        submitter_name: string | null; submitter_email: string | null
        reviewer_name: string | null
      }>(`
        SELECT cr.id, cr.place_id, p.name AS place_name, p.slug AS place_slug,
               cr.field_name, cr.old_value, cr.new_value,
               cr.status, cr.created_by, cr.created_at,
               cr.review_note, cr.reviewed_by, cr.reviewed_at,
               COALESCE(bc.contact_name, u.display_name, au_sub.email) AS submitter_name,
               COALESCE(bc.contact_email, au_sub.email) AS submitter_email,
               au_rev.full_name AS reviewer_name
        FROM place_change_requests cr
        JOIN places p ON p.id = cr.place_id
        LEFT JOIN business_clients bc ON bc.user_id = cr.created_by AND bc.is_active = true
        LEFT JOIN users u ON u.id = cr.created_by
        LEFT JOIN auth.users au_sub ON au_sub.id = cr.created_by
        LEFT JOIN admin_users au_rev ON au_rev.email = cr.reviewed_by
        WHERE cr.status = $1
        ORDER BY cr.created_at DESC
      `, [filterStatus])
      return reply.send({ items: rows })
    } catch {
      return reply.send({ items: [] })
    }
  })

  // ── GET /admin/review-queue/count ───────────────────────────────────────
  app.get('/admin/review-queue/count', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    try {
      const { rows } = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM place_change_requests WHERE status = 'pending'`
      )
      return reply.send({ count: parseInt(rows[0]?.count ?? '0') })
    } catch {
      return reply.send({ count: 0 })
    }
  })

  // ── POST /admin/review-queue/:id/approve ────────────────────────────────
  app.post('/admin/review-queue/:id/approve', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({ reviewNote: z.string().nullable().default(null) }).parse(request.body)

    // Get the change request
    const { rows } = await db.query<{
      place_id: string; field_name: string; new_value: string | null; status: string
    }>('SELECT place_id, field_name, new_value, status FROM place_change_requests WHERE id = $1', [id])
    if (!rows[0]) throw new AppError(404, 'Change request not found', 'NOT_FOUND')
    if (rows[0].status !== 'pending') throw new AppError(400, 'Request already reviewed', 'ALREADY_REVIEWED')

    const { place_id, field_name, new_value } = rows[0]

    // Apply the change to both the base places table and PT translation
    await db.query(
      `UPDATE places SET ${field_name} = $1, updated_at = now() WHERE id = $2`,
      [new_value, place_id],
    )
    // Also update PT translation
    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, ${field_name})
      SELECT $1, 'pt', p.name, $2 FROM places p WHERE p.id = $1
      ON CONFLICT (place_id, locale) DO UPDATE SET ${field_name} = $2, updated_at = now()
    `, [place_id, new_value]).catch(() => {})

    // Mark as approved
    await db.query(
      `UPDATE place_change_requests SET status = 'approved', reviewed_by = $1, review_note = $2, reviewed_at = now() WHERE id = $3`,
      [request.adminUser?.email ?? 'unknown', body.reviewNote, id],
    )

    return reply.send({ approved: true })
  })

  // ── POST /admin/review-queue/:id/reject ─────────────────────────────────
  app.post('/admin/review-queue/:id/reject', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({ reviewNote: z.string().nullable().default(null) }).parse(request.body)

    await db.query(
      `UPDATE place_change_requests SET status = 'rejected', reviewed_by = $1, review_note = $2, reviewed_at = now() WHERE id = $3`,
      [request.adminUser?.email ?? 'unknown', body.reviewNote, id],
    )

    return reply.send({ rejected: true })
  })

  // USER MANAGEMENT — create editors and business clients
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /admin/users/list ───────────────────────────────────────────────
  app.get('/admin/users/list', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    const { rows: admins } = await db.query<{
      id: string; email: string; full_name: string | null; role: string
    }>('SELECT id, email, full_name, role FROM admin_users ORDER BY role, email')

    const { rows: clients } = await db.query<{
      id: string; user_id: string; contact_name: string | null; contact_email: string | null
      place_name: string; place_slug: string; is_active: boolean
    }>(`
      SELECT DISTINCT ON (COALESCE(bc.contact_email, bc.user_id::text), bc.place_id)
             bc.id, bc.user_id, bc.contact_name, bc.contact_email,
             p.name AS place_name, p.slug AS place_slug, bc.is_active
      FROM business_clients bc
      JOIN places p ON p.id = bc.place_id
      ORDER BY COALESCE(bc.contact_email, bc.user_id::text), bc.place_id, bc.created_at DESC
    `)

    return reply.send({ admins, clients })
  })

  // ── POST /admin/users/create-editor ─────────────────────────────────────
  app.post('/admin/users/create-editor', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    // Only super_admin can create editors
    if (request.adminUser?.dashboardRole !== 'super_admin') {
      throw new AppError(403, 'Only super admins can create editor users', 'FORBIDDEN')
    }

    const body = z.object({
      email: z.string().email(),
      fullName: z.string().min(1),
    }).parse(request.body)

    await db.query(`
      INSERT INTO admin_users (email, full_name, role)
      VALUES ($1, $2, 'editor')
      ON CONFLICT (email) DO UPDATE SET full_name = $2, role = 'editor'
    `, [body.email, body.fullName])

    return reply.status(201).send({ created: true })
  })

  // ── POST /admin/users/create-client ─────────────────────────────────────
  // Both super_admin and editor can create business clients
  app.post('/admin/users/create-client', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      contactName: z.string().min(1),
      placeId: z.string().uuid(),
    }).parse(request.body)

    // Find the auth user by email
    const { rows: authUsers } = await db.query<{ id: string }>(
      'SELECT id FROM auth.users WHERE email = $1 LIMIT 1',
      [body.email],
    )

    if (authUsers.length === 0) {
      throw new AppError(400, 'No Supabase auth user found for this email. Create the user in Supabase Auth first.', 'USER_NOT_FOUND')
    }

    const userId = authUsers[0].id

    // Ensure public users record exists
    await db.query(
      'INSERT INTO users (id, onboarding_completed, created_at, updated_at) VALUES ($1, false, NOW(), NOW()) ON CONFLICT (id) DO NOTHING',
      [userId],
    )

    // Create business client
    await db.query(`
      INSERT INTO business_clients (user_id, place_id, contact_name, contact_email, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (user_id, place_id) DO UPDATE SET contact_name = $3, contact_email = $4, is_active = true
    `, [userId, body.placeId, body.contactName, body.email])

    return reply.status(201).send({ created: true })
  })
}
