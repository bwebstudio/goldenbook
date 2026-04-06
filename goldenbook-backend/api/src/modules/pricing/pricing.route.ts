import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import Stripe from 'stripe'
import { authenticateBusinessClient } from '../../shared/auth/businessAuth'
import { AppError } from '../../shared/errors/AppError'
import { env } from '../../config/env'
import { db } from '../../db/postgres'
import {
  getActivePricingPlans,
  getActiveSeasonRules,
  getAllCityMultipliers,
  getActivePromotion,
  computePrice,
  getPricingPlanById,
} from '../admin/pricing/pricing.query'
import { CampaignCheckoutSchema } from '../campaigns/campaigns.dto'
import { validateCampaignCheckout } from '../campaigns/campaigns.validation'
import { getCampaignById } from '../campaigns/campaigns.query'
import { checkSlotAvailabilityForPeriod, placementToSurface } from '../inventory/promotion-inventory.query'

// Placement type labels for Stripe line items
const PLACEMENT_LABELS: Record<string, string> = {
  golden_picks: 'Golden Picks',
  now: 'Now Recommendation',
  search_priority: 'Search Priority',
  category_featured: 'Category Featured',
  hidden_gems: 'Hidden Gems Near You',
  concierge: 'Concierge Recommendation',
  new_on_goldenbook: 'New on Goldenbook Go',
  route_featured_stop: 'Route Featured Stop',
  route_sponsor: 'Route Sponsor',
  extra_images: 'Extra Images (up to 10)',
  extended_description: 'Extended Description (up to 600 chars)',
}

function cityLabel(city: string): string {
  return city.charAt(0).toUpperCase() + city.slice(1)
}

export async function pricingRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC / BUSINESS: Get all active pricing + season rules
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /pricing/plans ───────────────────────────────────────────────────
  app.get('/pricing/plans', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!

    const { rows: businessCities } = await db.query<{ city_slug: string; city_name: string; place_id: string }>(
      `SELECT DISTINCT d.slug AS city_slug, d.name AS city_name, bc.place_id
       FROM business_clients bc
       JOIN places p ON p.id = bc.place_id
       JOIN place_destinations pd ON pd.place_id = p.id
       JOIN destinations d ON d.id = pd.destination_id
       WHERE bc.user_id = (SELECT user_id FROM business_clients WHERE id = $1)
         AND bc.is_active = true
       UNION
       SELECT DISTINCT d.slug AS city_slug, d.name AS city_name, bc.place_id
       FROM business_clients bc
       JOIN places p ON p.id = bc.place_id
       JOIN destinations d ON d.id = p.destination_id
       WHERE bc.user_id = (SELECT user_id FROM business_clients WHERE id = $1)
         AND bc.is_active = true
       ORDER BY city_name`,
      [client.id],
    ).catch(() => ({ rows: [] as { city_slug: string; city_name: string; place_id: string }[] }))

    const [plans, seasons, cities, promo] = await Promise.all([
      getActivePricingPlans().catch(() => []),
      getActiveSeasonRules().catch(() => []),
      getAllCityMultipliers().catch(() => []),
      getActivePromotion().catch(() => null),
    ])

    return reply.send({
      plans,
      seasons,
      cities,
      promotion: promo ? {
        discount_pct: promo.discount_pct,
        label: promo.label,
        valid_until: promo.valid_until,
      } : null,
      businessCities: businessCities.map((c) => ({
        slug: c.city_slug,
        name: c.city_name,
        placeId: c.place_id,
      })),
    })
  })

  // ── GET /pricing/compute ─────────────────────────────────────────────────
  app.get('/pricing/compute', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const { planId, city, month } = z.object({
      planId: z.string().uuid(),
      city: z.string().default('lisbon'),
      month: z.coerce.number().int().min(1).max(12).optional(),
    }).parse(request.query)

    const result = await computePrice(planId, city, month)
    if (!result) throw new AppError(404, 'Pricing plan not found', 'NOT_FOUND')
    return reply.send(result)
  })

  // ── GET /pricing/availability ──────────────────────────────────────────────
  // Returns which sections the business client's place can purchase
  app.get('/pricing/availability', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const placeId = request.businessClient!.placeId

    // Active purchases for this place
    const { rows: activePurchases } = await db.query<{ placement_type: string }>(
      `SELECT DISTINCT placement_type FROM purchases
       WHERE place_id = $1 AND status IN ('pending', 'paid', 'activated')
         AND placement_type IS NOT NULL`,
      [placeId],
    ).catch(() => ({ rows: [] as { placement_type: string }[] }))
    const occupiedSections = new Set(activePurchases.map((r) => r.placement_type))

    // Active visibility for this place (including editorial)
    const { rows: activeVisibility } = await db.query<{ surface: string }>(
      `SELECT DISTINCT surface FROM place_visibility
       WHERE place_id = $1 AND is_active = true AND ends_at > now()`,
      [placeId],
    ).catch(() => ({ rows: [] as { surface: string }[] }))
    const activeSurfaces = new Set(activeVisibility.map((r) => r.surface))

    // Check if place has any active discover placement
    // Discover = golden_picks, hidden_spots/hidden_gems, new_on_goldenbook (NOT now)
    const discoverSurfaces = ['golden_picks', 'hidden_spots', 'hidden_gems', 'new_on_goldenbook']
    const hasActiveDiscover = discoverSurfaces.some((s) => activeSurfaces.has(s) || occupiedSections.has(s))

    // Check if place has active concierge placement
    const hasActiveConcierge = activeSurfaces.has('concierge') || occupiedSections.has('concierge')

    // Count total active paid surfaces for cross-surface dominance limit
    const MAX_PAID_SURFACES_PER_PLACE = 2
    const { rows: [paidSurfaceCount] } = await db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM place_visibility
       WHERE place_id = $1 AND is_active = true AND visibility_type = 'sponsored'
         AND (ends_at IS NULL OR ends_at >= now())`,
      [placeId],
    ).catch(() => ({ rows: [{ cnt: '0' }] }))
    const activePaidSurfaces = parseInt(paidSurfaceCount?.cnt ?? '0', 10)

    // Map of discover placement_type → surface name (they differ sometimes)
    // NOW is NOT a Discover product — it has its own surface rules
    const discoverTypes = new Set(['golden_picks', 'hidden_gems', 'new_on_goldenbook'])
    const intentTypes = new Set(['search_priority', 'category_featured'])

    // Resolve city slug for this business client's place
    const { rows: placeCity } = await db.query<{ city_slug: string }>(
      `SELECT d.slug AS city_slug
       FROM places p JOIN destinations d ON d.id = p.destination_id
       WHERE p.id = $1 LIMIT 1`,
      [placeId],
    ).catch(() => ({ rows: [] as { city_slug: string }[] }))
    const citySlug = placeCity[0]?.city_slug ?? 'lisboa'

    // Check global slot caps from promotion_inventory
    const { rows: inventoryRows } = await db.query<{
      surface: string; max_slots: number; active_slots: number
    }>(
      `SELECT surface, max_slots, active_slots FROM promotion_inventory WHERE city = $1`,
      [citySlug],
    ).catch(() => ({ rows: [] as { surface: string; max_slots: number; active_slots: number }[] }))
    const inventoryMap = new Map(inventoryRows.map((r) => [r.surface, r]))

    // Build availability per section
    const sections: Record<string, { available: boolean; reason: string | null; group: string }> = {}

    const allSectionTypes = [
      'golden_picks', 'now', 'hidden_gems', 'new_on_goldenbook',
      'search_priority', 'category_featured', 'concierge',
    ]

    for (const section of allSectionTypes) {
      const isDiscover = discoverTypes.has(section)
      const group = isDiscover ? 'discover' : intentTypes.has(section) ? 'intent' : 'dynamic'

      let available = true
      let reason: string | null = null

      // Already has this section active
      if (occupiedSections.has(section)) {
        available = false
        reason = 'ALREADY_ACTIVE'
      }
      // Discover exclusivity
      else if (isDiscover && hasActiveDiscover) {
        available = false
        reason = 'DISCOVER_CONFLICT'
      }
      // Concierge + Discover anti-domination
      else if (section === 'concierge' && hasActiveDiscover) {
        available = false
        reason = 'ANTI_DOMINATION'
      }
      else if (isDiscover && hasActiveConcierge) {
        available = false
        reason = 'ANTI_DOMINATION'
      }
      // Cross-surface dominance limit: max 2 paid surfaces per place
      else if (activePaidSurfaces >= MAX_PAID_SURFACES_PER_PLACE) {
        available = false
        reason = 'MAX_SURFACES'
      }
      // Global slot cap (promotion_inventory)
      else {
        const inv = inventoryMap.get(section)
        if (inv && inv.active_slots >= inv.max_slots) {
          available = false
          reason = 'INVENTORY_FULL'
        }
      }

      sections[section] = { available, reason, group }
    }

    // Build inventory map for scarcity display
    const inventory: Record<string, { max: number; active: number; remaining: number }> = {}
    for (const row of inventoryRows) {
      inventory[row.surface] = {
        max: row.max_slots,
        active: row.active_slots,
        remaining: Math.max(0, row.max_slots - row.active_slots),
      }
    }

    return reply.send({ sections, inventory, city: citySlug })
  })

  // ── GET /pricing/calendar ─────────────────────────────────────────────────
  // Returns blocked date ranges per section (where visibility is already active)
  app.get('/pricing/calendar', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const { section } = z.object({
      section: z.string(),
    }).parse(request.query)

    // Find all active visibility for this section (from any place)
    // These are the dates where a slot is already taken
    const { rows: blocked } = await db.query<{
      starts_at: string
      ends_at: string
      place_name: string | null
      position: number | null
    }>(
      `SELECT pv.starts_at::date::text AS starts_at,
              pv.ends_at::date::text AS ends_at,
              p.name AS place_name,
              pv.priority AS position
       FROM place_visibility pv
       LEFT JOIN places p ON p.id = pv.place_id
       WHERE pv.surface = $1
         AND pv.is_active = true
         AND pv.ends_at > now()
       ORDER BY pv.starts_at`,
      [section],
    ).catch(() => ({ rows: [] as { starts_at: string; ends_at: string; place_name: string | null; position: number | null }[] }))

    // Release expired holds first
    await db.query(`SELECT release_expired_holds()`).catch(() => {})

    // Check pending/paid purchases with active holds or paid status
    const { rows: pending } = await db.query<{
      starts_at: string
      ends_at: string
    }>(
      `SELECT
         COALESCE(placement_starts_at::text, created_at::date::text) AS starts_at,
         (COALESCE(placement_starts_at, created_at::date) + (unit_days || ' days')::interval)::date::text AS ends_at
       FROM purchases
       WHERE placement_type = $1
         AND (
           (status = 'pending' AND hold_expires_at > now())
           OR status = 'paid'
         )`,
      [section],
    ).catch(() => ({ rows: [] as { starts_at: string; ends_at: string }[] }))

    return reply.send({
      blocked: blocked.map((b) => ({
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        place_name: b.place_name,
        position: b.position,
      })),
      pending: pending.map((p) => ({
        starts_at: p.starts_at,
        ends_at: p.ends_at,
      })),
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE CHECKOUT
  // ═══════════════════════════════════════════════════════════════════════════

  // ── POST /pricing/checkout ───────────────────────────────────────────────
  app.post('/pricing/checkout', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError(503, 'Payment system is not configured', 'STRIPE_NOT_CONFIGURED')
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY)

    const HOLD_MINUTES = 10

    // Accept both legacy format (planId only) and campaign format (planId + campaignId)
    const body = CampaignCheckoutSchema.or(z.object({
      planId: z.string().uuid(),
      city: z.string().default('lisbon'),
      month: z.coerce.number().int().min(1).max(12).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })).parse(request.body)

    const startDate = ('startDate' in body ? body.startDate : null) ?? null

    const hasCampaign = 'campaignId' in body && !!body.campaignId
    const client = request.businessClient!

    // ── Campaign validations (validate only — NO inventory reservation) ────
    let campaign: Awaited<ReturnType<typeof getCampaignById>> = null
    if (hasCampaign) {
      const campaignBody = body as z.infer<typeof CampaignCheckoutSchema>
      await validateCampaignCheckout({
        campaignId: campaignBody.campaignId,
        placeId: client.placeId,
        position: campaignBody.position,
        date: campaignBody.date,
        timeBucket: campaignBody.time_bucket,
      })
      campaign = await getCampaignById(campaignBody.campaignId)
    }

    // Resolve plan: for campaigns, find the plan matching the campaign section
    let resolvedPlanId = body.planId
    if (hasCampaign && campaign) {
      const { rows: sectionPlans } = await db.query<{ id: string }>(
        `SELECT id FROM pricing_plans WHERE placement_type = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`,
        [campaign.section],
      )
      if (sectionPlans[0]) resolvedPlanId = sectionPlans[0].id
    }

    const plan = await getPricingPlanById(resolvedPlanId)
    if (!plan || !plan.is_active) {
      throw new AppError(404, 'Pricing plan not found or inactive', 'NOT_FOUND')
    }

    const priceResult = await computePrice(resolvedPlanId, body.city, body.month)
    if (!priceResult) {
      throw new AppError(500, 'Could not compute price', 'PRICE_ERROR')
    }

    // ── Global slot cap check (promotion_inventory) ─────────────────────
    if (plan.pricing_type !== 'membership' && plan.placement_type) {
      const surface = placementToSurface(plan.placement_type)
      const placementStart = startDate ?? new Date().toISOString().split('T')[0]
      const placementEnd = new Date(
        new Date(placementStart).getTime() + plan.unit_days * 86_400_000,
      ).toISOString().split('T')[0]

      const slotCheck = await checkSlotAvailabilityForPeriod(
        body.city, surface, placementStart, placementEnd,
      )

      if (slotCheck && !slotCheck.available) {
        console.warn(
          `[promotion-inventory] Slot validation failed: city=${body.city} surface=${surface} active=${slotCheck.active_slots} max=${slotCheck.max_slots} requested=${placementStart}→${placementEnd}`,
        )
        throw new AppError(
          409,
          'No promotion slots available for this city and surface in the selected period.',
          'INVENTORY_FULL',
        )
      }
    }

    // Build descriptive line item name
    const parts: string[] = []
    if (plan.pricing_type === 'membership') {
      parts.push('Goldenbook Go Membership')
    } else {
      parts.push(PLACEMENT_LABELS[plan.placement_type ?? ''] ?? plan.placement_type ?? 'Unknown')
      parts.push(`\u2014 ${cityLabel(body.city)}`)
      if (plan.position) parts.push(`#${plan.position}`)
      if (campaign) parts.push(`[${campaign.name}]`)
    }
    const itemName = parts.join(' ')

    const descParts: string[] = [`Duration: ${plan.unit_label}`]
    if (priceResult.promoLabel) {
      descParts.push(priceResult.promoLabel)
    }
    const description = descParts.join(' | ')

    const targetMonth = body.month ?? new Date().getMonth() + 1
    const successUrl = `${env.DASHBOARD_URL}/portal/checkout/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${env.DASHBOARD_URL}/portal/checkout/cancel`

    // Complete metadata set for webhook fulfillment
    const metadata: Record<string, string> = {
      plan_id: plan.id,
      plan_type: plan.pricing_type,
      placement_key: plan.placement_type ?? '',
      city_code: body.city,
      position: plan.position?.toString() ?? '',
      slot: plan.slot ?? '',
      unit_days: plan.unit_days.toString(),
      month: targetMonth.toString(),
      computed_base_price: priceResult.basePrice.toFixed(2),
      computed_city_mult: priceResult.cityMultiplier.toFixed(2),
      computed_season_mult: priceResult.seasonMultiplier.toFixed(2),
      computed_full_price: priceResult.fullPrice.toFixed(2),
      computed_promo_discount: priceResult.promoDiscount.toFixed(0),
      computed_final_price: priceResult.finalPrice.toFixed(2),
      business_id: client.id,
      place_id: client.placeId,
      user_id: client.userId,
    }

    // Start date for placement scheduling
    if (startDate) {
      metadata.placement_start_date = startDate
    }

    // Campaign-specific metadata for webhook fulfillment
    if (hasCampaign && campaign) {
      const campaignBody = body as z.infer<typeof CampaignCheckoutSchema>
      metadata.campaign_id = campaignBody.campaignId
      metadata.campaign_section = campaign.section
      metadata.inventory_date = campaignBody.date
      if (campaignBody.position) metadata.inventory_position = campaignBody.position.toString()
      if (campaignBody.time_bucket) metadata.inventory_time_bucket = campaignBody.time_bucket
    }

    const session = await stripe.checkout.sessions.create({
      mode: plan.pricing_type === 'membership' ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: plan.pricing_type === 'membership'
        ? [{
            price_data: {
              currency: plan.currency,
              unit_amount: Math.round(priceResult.finalPrice * 100),
              recurring: { interval: 'year' },
              product_data: { name: itemName, description },
              tax_behavior: 'exclusive',
            },
            quantity: 1,
          }]
        : [{
            price_data: {
              currency: plan.currency,
              unit_amount: Math.round(priceResult.finalPrice * 100),
              product_data: { name: itemName, description },
              tax_behavior: 'exclusive',
            },
            quantity: 1,
          }],
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Stripe checkout expires after 30 min (minimum allowed)
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    })

    // Release any expired holds before creating a new one
    await db.query(`SELECT release_expired_holds()`).catch(() => {})

    // Create pending purchase with temporary hold
    const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000)

    if (plan.pricing_type !== 'membership') {
      const campaignBody = hasCampaign ? body as z.infer<typeof CampaignCheckoutSchema> : null

      await db.query(`
        INSERT INTO purchases (
          business_client_id, place_id, pricing_plan_id,
          plan_type, placement_type, city, position, slot,
          unit_days, base_price, season_multiplier, final_price, currency, month,
          stripe_checkout_session_id, status,
          campaign_id, section,
          inventory_position, inventory_date, inventory_time_bucket,
          hold_expires_at, placement_starts_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',$16,$17,$18,$19,$20,$21,$22)
      `, [
        client.id, client.placeId, plan.id,
        plan.pricing_type, plan.placement_type, body.city, plan.position, plan.slot,
        plan.unit_days, priceResult.basePrice, priceResult.cityMultiplier * priceResult.seasonMultiplier,
        priceResult.finalPrice, plan.currency, targetMonth,
        session.id,
        hasCampaign && campaign ? campaignBody!.campaignId : null,
        hasCampaign && campaign ? campaign.section : null,
        campaignBody?.position ?? null,
        campaignBody?.date ?? null,
        campaignBody?.time_bucket ?? null,
        holdExpiresAt.toISOString(),
        startDate,
      ])
    }

    return reply.send({
      checkoutUrl: session.url,
      sessionId: session.id,
      holdExpiresAt: holdExpiresAt.toISOString(),
      holdMinutes: HOLD_MINUTES,
    })
  })
}
