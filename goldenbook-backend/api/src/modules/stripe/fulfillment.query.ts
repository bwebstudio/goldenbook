import { db } from '../../db/postgres'
import {
  claimInventory,
  createCampaignSlot,
  cancelSlotByPurchase,
  releaseInventory,
  getCampaignById,
} from '../campaigns/campaigns.query'
import { incrementSlot, decrementSlot, placementToSurface } from '../inventory/promotion-inventory.query'

// ─── Idempotency ─────────────────────────────────────────────────────────────

export async function isEventProcessed(stripeEventId: string): Promise<boolean> {
  const { rows } = await db.query<{ already: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM stripe_events WHERE stripe_event_id = $1
     ) AS already`,
    [stripeEventId],
  )
  return rows[0]?.already ?? false
}

export async function markEventProcessed(
  stripeEventId: string,
  eventType: string,
  payloadSummary?: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO stripe_events (stripe_event_id, event_type, payload_summary)
     VALUES ($1, $2, $3)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [stripeEventId, eventType, payloadSummary ? JSON.stringify(payloadSummary) : null],
  )
}

// ─── Purchases ───────────────────────────────────────────────────────────────

export interface PurchaseRow {
  id: string
  business_client_id: string
  place_id: string | null
  pricing_plan_id: string | null
  plan_type: string
  placement_type: string | null
  city: string | null
  position: number | null
  slot: string | null
  unit_days: number
  base_price: string
  season_multiplier: string
  final_price: string
  currency: string
  month: number | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_customer_id: string | null
  status: string
  visibility_id: string | null
  activated_at: string | null
  expires_at: string | null
  campaign_id: string | null
  section: string | null
  inventory_position: number | null
  inventory_date: string | null
  inventory_time_bucket: string | null
}

export async function getPurchaseBySessionId(sessionId: string): Promise<PurchaseRow | null> {
  const { rows } = await db.query<PurchaseRow>(
    `SELECT * FROM purchases WHERE stripe_checkout_session_id = $1 LIMIT 1`,
    [sessionId],
  )
  return rows[0] ?? null
}

export async function markPurchasePaid(
  sessionId: string,
  paymentIntentId: string | null,
  customerId: string | null,
): Promise<PurchaseRow | null> {
  const { rows } = await db.query<PurchaseRow>(
    `UPDATE purchases
     SET status = 'paid',
         stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
         stripe_customer_id = COALESCE($3, stripe_customer_id),
         updated_at = now()
     WHERE stripe_checkout_session_id = $1 AND status = 'pending'
     RETURNING *`,
    [sessionId, paymentIntentId, customerId],
  )
  return rows[0] ?? null
}

export async function activatePurchase(
  purchaseId: string,
  visibilityId: string | null,
  activatedAt: Date,
  expiresAt: Date,
): Promise<void> {
  await db.query(
    `UPDATE purchases
     SET status = 'activated',
         visibility_id = $2,
         activated_at = $3,
         expires_at = $4,
         updated_at = now()
     WHERE id = $1`,
    [purchaseId, visibilityId, activatedAt.toISOString(), expiresAt.toISOString()],
  )
}

export async function failPurchase(sessionId: string): Promise<void> {
  await db.query(
    `UPDATE purchases SET status = 'failed', updated_at = now()
     WHERE stripe_checkout_session_id = $1 AND status = 'pending'`,
    [sessionId],
  )
}

export async function refundPurchase(purchaseId: string): Promise<void> {
  console.info('[campaign-refund] Processing refund', { action: 'refund', purchase_id: purchaseId })

  // Fetch purchase data before updating status (need city + placement_type for slot decrement)
  const { rows: purchaseRows } = await db.query<{ city: string | null; placement_type: string | null; status: string }>(
    `SELECT city, placement_type, status FROM purchases WHERE id = $1 LIMIT 1`,
    [purchaseId],
  )
  const purchase = purchaseRows[0]

  await db.query(
    `UPDATE purchases SET status = 'refunded', updated_at = now()
     WHERE id = $1 AND status IN ('paid', 'activated')`,
    [purchaseId],
  )

  const released = await releaseInventory(purchaseId)
  console.info('[campaign-refund] Inventory released', { action: 'refund_release', purchase_id: purchaseId, released_count: released })

  await cancelSlotByPurchase(purchaseId)
  console.info('[campaign-refund] Slot cancelled', { action: 'refund_slot_cancel', purchase_id: purchaseId })

  // Decrement global slot if this was an activated placement
  if (purchase?.status === 'activated' && purchase.city && purchase.placement_type) {
    const surface = placementToSurface(purchase.placement_type)
    await decrementSlot(purchase.city, surface)
  }
}

// ─── Placement activation (creates place_visibility) ────────────────────────

const SURFACE_MAP: Record<string, string> = {
  golden_picks: 'golden_picks',
  now: 'now',
  hidden_gems: 'hidden_spots',
  category_featured: 'category_featured',
  search_priority: 'search_priority',
  new_on_goldenbook: 'new_on_goldenbook',
  route_featured_stop: 'route_featured',
  route_sponsor: 'route_sponsor',
  concierge: 'concierge',
}

const UPGRADE_TYPES = new Set(['extra_images', 'extended_description', 'listing_premium_pack'])

/**
 * Activate a purchase by creating a place_visibility record.
 *
 * SLOT SAFETY: The global slot cap (promotion_inventory) is checked and
 * incremented BEFORE the visibility record is created. If the slot is full,
 * the purchase is marked as 'inventory_conflict' and an auto-refund is
 * returned to the caller.
 *
 * Returns:
 *   - visibility ID on success
 *   - 'upgrade-activated' for listing upgrades (no visibility)
 *   - 'inventory_conflict' if the slot cap is exceeded → caller must refund
 */
export async function createVisibilityFromPurchase(purchase: PurchaseRow): Promise<string> {
  const startsAt = new Date()
  const endsAt = new Date(startsAt.getTime() + purchase.unit_days * 86_400_000)

  // Upgrades: just mark activated, no visibility record
  if (UPGRADE_TYPES.has(purchase.placement_type ?? '')) {
    await activatePurchase(purchase.id, null as unknown as string, startsAt, endsAt)
    return 'upgrade-activated'
  }

  // ── Global slot check + atomic increment BEFORE creating visibility ────
  if (purchase.city && purchase.placement_type) {
    const invKey = placementToSurface(purchase.placement_type)
    const slotOk = await incrementSlot(purchase.city, invKey)

    if (!slotOk) {
      // Slot cap exceeded — do NOT create visibility, do NOT activate.
      // Mark purchase as inventory_conflict so admin can see it and auto-refund is triggered.
      console.error(
        `[promotion-inventory] INVENTORY_CONFLICT: city=${purchase.city} surface=${invKey} ` +
        `purchase=${purchase.id} stripe_session=${purchase.stripe_checkout_session_id} ` +
        `stripe_payment=${purchase.stripe_payment_intent_id}`,
      )

      await db.query(
        `UPDATE purchases SET status = 'inventory_conflict', updated_at = now() WHERE id = $1`,
        [purchase.id],
      )

      return 'inventory_conflict'
    }
  }

  const surface = SURFACE_MAP[purchase.placement_type ?? ''] ?? purchase.placement_type ?? 'golden_picks'
  const priority = purchase.position ? (100 - purchase.position) : 10

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO place_visibility (
       place_id, surface, visibility_type, priority,
       starts_at, ends_at, is_active, source,
       placement_slot, scope_type, scope_id, notes
     ) VALUES ($1, $2, 'sponsored', $3, $4, $5, true, 'sponsored', $6, NULL, NULL, $7)
     RETURNING id`,
    [
      purchase.place_id,
      surface,
      priority,
      startsAt.toISOString(),
      endsAt.toISOString(),
      purchase.slot,
      `Auto-activated from purchase ${purchase.id}`,
    ],
  )

  const visibilityId = rows[0].id
  await activatePurchase(purchase.id, visibilityId, startsAt, endsAt)

  // ── Campaign: claim inventory atomically + create slot ─────────────────
  if (purchase.campaign_id && purchase.place_id) {
    await fulfillCampaignInventory(purchase, endsAt)
  }

  return visibilityId
}

/**
 * Atomic campaign inventory fulfillment.
 * Called ONLY after payment is confirmed (webhook).
 */
async function fulfillCampaignInventory(
  purchase: PurchaseRow,
  endsAt: Date,
): Promise<void> {
  if (!purchase.campaign_id || !purchase.place_id || !purchase.inventory_date) return

  const logCtx = {
    action: 'inventory_claim',
    campaign_id: purchase.campaign_id,
    place_id: purchase.place_id,
    purchase_id: purchase.id,
    position: purchase.inventory_position,
    date: purchase.inventory_date,
    time_bucket: purchase.inventory_time_bucket ?? 'all_day',
  }

  // Atomic claim — UPDATE WHERE status='available' prevents double-sell
  const claimed = await claimInventory({
    campaign_id: purchase.campaign_id,
    position: purchase.inventory_position,
    date: purchase.inventory_date,
    time_bucket: purchase.inventory_time_bucket ?? 'all_day',
    purchase_id: purchase.id,
    place_id: purchase.place_id,
  })

  if (!claimed) {
    console.warn('[campaign-fulfillment] Inventory unavailable at claim time — marking purchase as failed', { ...logCtx, status: 'inventory_conflict' })
    // Mark purchase as failed — inventory was sold between checkout and payment
    await db.query(
      `UPDATE purchases SET status = 'failed', updated_at = now() WHERE id = $1`,
      [purchase.id],
    )
    return
  }

  console.info('[campaign-fulfillment] Inventory claimed', { ...logCtx, inventory_id: claimed.id, status: 'claimed' })

  // Determine slot dates from campaign
  const campaign = await getCampaignById(purchase.campaign_id)
  const slotEndsAt = campaign ? campaign.end_date : endsAt.toISOString()

  await createCampaignSlot({
    campaign_id: purchase.campaign_id,
    place_id: purchase.place_id,
    purchase_id: purchase.id,
    inventory_id: claimed.id,
    status: 'active',
    starts_at: new Date().toISOString(),
    ends_at: slotEndsAt,
  })

  console.info('[campaign-fulfillment] Slot activated', { ...logCtx, inventory_id: claimed.id, status: 'active' })
}

// ─── Memberships ─────────────────────────────────────────────────────────────

export async function createMembership(data: {
  businessClientId: string
  pricingPlanId: string | null
  pricePaid: number
  currency: string
  stripeCheckoutSessionId: string | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  stripePaymentIntentId: string | null
  startsAt: Date
  expiresAt: Date
}): Promise<string> {
  await db.query(
    `UPDATE memberships SET status = 'expired', updated_at = now()
     WHERE business_client_id = $1 AND status = 'active'`,
    [data.businessClientId],
  )

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO memberships (
       business_client_id, pricing_plan_id, status, price_paid, currency,
       stripe_checkout_session_id, stripe_subscription_id, stripe_customer_id, stripe_payment_intent_id,
       starts_at, expires_at
     ) VALUES ($1,$2,'active',$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      data.businessClientId, data.pricingPlanId, data.pricePaid, data.currency,
      data.stripeCheckoutSessionId, data.stripeSubscriptionId,
      data.stripeCustomerId, data.stripePaymentIntentId,
      data.startsAt.toISOString(), data.expiresAt.toISOString(),
    ],
  )
  return rows[0].id
}

export async function cancelMembershipBySubscription(subscriptionId: string): Promise<void> {
  await db.query(
    `UPDATE memberships SET status = 'cancelled', cancelled_at = now(), updated_at = now()
     WHERE stripe_subscription_id = $1 AND status = 'active'`,
    [subscriptionId],
  )
}

export async function updateMembershipStatus(subscriptionId: string, status: string): Promise<void> {
  await db.query(
    `UPDATE memberships SET status = $2, updated_at = now()
     WHERE stripe_subscription_id = $1 AND status IN ('active', 'past_due')`,
    [subscriptionId, status],
  )
}

// ─── Stripe customer linkage ─────────────────────────────────────────────────

export async function linkStripeCustomer(businessClientId: string, stripeCustomerId: string): Promise<void> {
  await db.query(
    `UPDATE business_clients SET stripe_customer_id = $2, updated_at = now()
     WHERE id = $1 AND (stripe_customer_id IS NULL OR stripe_customer_id = $2)`,
    [businessClientId, stripeCustomerId],
  )
}
