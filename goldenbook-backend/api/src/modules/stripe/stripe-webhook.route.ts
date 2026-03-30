import type { FastifyInstance, FastifyRequest } from 'fastify'
import Stripe from 'stripe'
import { env } from '../../config/env'
import { db } from '../../db/postgres'
import {
  isEventProcessed,
  markEventProcessed,
  getPurchaseBySessionId,
  markPurchasePaid,
  createVisibilityFromPurchase,
  createMembership,
  cancelMembershipBySubscription,
  updateMembershipStatus,
  linkStripeCustomer,
  refundPurchase,
} from './fulfillment.query'

// Extend FastifyRequest to carry raw body for Stripe signature verification
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer
  }
}

export async function stripeWebhookRoutes(app: FastifyInstance) {

  app.removeContentTypeParser('application/json')
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req: FastifyRequest, body: Buffer, done: (err: Error | null, body?: Buffer) => void) => {
      _req.rawBody = body
      done(null, body)
    },
  )

  // ── POST /stripe/webhook ─────────────────────────────────────────────────
  app.post('/stripe/webhook', async (request, reply) => {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      app.log.warn('[stripe-webhook] Stripe not configured — ignoring webhook')
      return reply.status(503).send({ error: 'STRIPE_NOT_CONFIGURED' })
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    const sig = request.headers['stripe-signature']

    if (!sig) {
      app.log.warn('[stripe-webhook] Missing stripe-signature header')
      return reply.status(400).send({ error: 'Missing stripe-signature header' })
    }

    const rawBody = request.rawBody ?? (Buffer.isBuffer(request.body) ? request.body : null)

    if (!rawBody) {
      app.log.error('[stripe-webhook] Raw body not available — cannot verify signature')
      return reply.status(400).send({ error: 'Raw body not available' })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      app.log.warn(`[stripe-webhook] Signature verification failed: ${err}`)
      return reply.status(400).send({ error: 'Invalid signature' })
    }

    // ─── Idempotency check ─────────────────────────────────────────────────
    const alreadyProcessed = await isEventProcessed(event.id).catch(() => false)
    if (alreadyProcessed) {
      app.log.info(`[stripe-webhook] Event ${event.id} already processed — skipping`)
      return reply.send({ received: true, duplicate: true })
    }

    app.log.info(`[stripe-webhook] Processing ${event.type} (${event.id})`)

    // ─── Handle the event ──────────────────────────────────────────────────
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(app, event.data.object as Stripe.Checkout.Session)
          break

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(app, event.data.object as Stripe.Subscription)
          break

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(app, event.data.object as Stripe.Subscription)
          break

        case 'invoice.paid':
          await handleInvoicePaid(app, event.data.object as Stripe.Invoice)
          break

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(app, event.data.object as Stripe.Invoice)
          break

        case 'charge.refunded':
          await handleChargeRefunded(app, event.data.object as Stripe.Charge)
          break

        default:
          app.log.info(`[stripe-webhook] Unhandled event type: ${event.type} — acknowledging`)
      }
    } catch (err) {
      app.log.error(`[stripe-webhook] Error processing ${event.type}: ${err}`)
    }

    await markEventProcessed(event.id, event.type, {
      type: event.type,
      objectId: (event.data.object as unknown as { id?: string }).id,
    }).catch((err) => {
      app.log.error(`[stripe-webhook] Could not mark event as processed: ${err}`)
    })

    return reply.send({ received: true })
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Handlers
// ═══════════════════════════════════════════════════════════════════════════════

async function handleCheckoutCompleted(
  app: FastifyInstance,
  session: Stripe.Checkout.Session,
) {
  const meta = session.metadata ?? {}
  const businessId = meta.business_id
  const customerId = typeof session.customer === 'string' ? session.customer : null

  app.log.info(`[stripe-webhook] checkout.session.completed — mode=${session.mode} session=${session.id} business=${businessId}`)

  if (businessId && customerId) {
    await linkStripeCustomer(businessId, customerId).catch(() => {})
  }

  if (session.mode === 'payment') {
    await fulfillPlacementPurchase(app, session, meta, customerId)
  } else if (session.mode === 'subscription') {
    await fulfillMembershipPurchase(app, session, meta, customerId)
  }
}

async function fulfillPlacementPurchase(
  app: FastifyInstance,
  session: Stripe.Checkout.Session,
  meta: Record<string, string>,
  customerId: string | null,
) {
  const purchase = await getPurchaseBySessionId(session.id)

  if (!purchase) {
    app.log.info(`[stripe-webhook] No pending purchase for session ${session.id} — creating from metadata`)
    await createPurchaseFromMetadata(app, session, meta, customerId)
    return
  }

  if (purchase.status !== 'pending') {
    app.log.info(`[stripe-webhook] Purchase ${purchase.id} already ${purchase.status} — skipping`)
    return
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent : null

  const paid = await markPurchasePaid(session.id, paymentIntentId, customerId)
  if (!paid) {
    app.log.warn(`[stripe-webhook] Could not mark purchase paid for session ${session.id}`)
    return
  }

  // Activate: create visibility + claim campaign inventory atomically
  const visibilityId = await createVisibilityFromPurchase(paid)
  app.log.info(`[stripe-webhook] Activated purchase ${paid.id} — visibility ${visibilityId}`)
}

async function createPurchaseFromMetadata(
  app: FastifyInstance,
  session: Stripe.Checkout.Session,
  meta: Record<string, string>,
  customerId: string | null,
) {
  const businessId = meta.business_id
  const placeId = meta.place_id
  const planType = meta.plan_type || 'placement'
  const placementKey = meta.placement_key || null
  const city = meta.city_code || null
  const position = meta.position ? parseInt(meta.position) || null : null
  const slot = meta.slot || null
  const unitDays = parseInt(meta.unit_days || '7') || 7
  const basePrice = parseFloat(meta.computed_base_price || '0')
  const multiplier = parseFloat(meta.computed_season_mult || '1')
  const finalPrice = parseFloat(meta.computed_final_price || '0')
  const month = parseInt(meta.month || '0') || null

  if (!businessId || !placeId) {
    app.log.warn(`[stripe-webhook] Cannot create purchase — missing business_id or place_id in metadata`)
    return
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent : null

  const campaignId = meta.campaign_id || null
  const campaignSection = meta.campaign_section || null
  const invPosition = meta.inventory_position ? parseInt(meta.inventory_position) || null : null
  const invDate = meta.inventory_date || null
  const invTimeBucket = meta.inventory_time_bucket || null

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO purchases (
       business_client_id, place_id, pricing_plan_id,
       plan_type, placement_type, city, position, slot,
       unit_days, base_price, season_multiplier, final_price, currency, month,
       stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id,
       status, campaign_id, section,
       inventory_position, inventory_date, inventory_time_bucket
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'eur',$13,$14,$15,$16,'paid',$17,$18,$19,$20,$21)
     RETURNING id`,
    [
      businessId, placeId, meta.plan_id || null,
      planType, placementKey, city, position, slot,
      unitDays, basePrice, multiplier, finalPrice, month,
      session.id, paymentIntentId, customerId,
      campaignId, campaignSection,
      invPosition, invDate, invTimeBucket,
    ],
  )

  if (!rows[0]) {
    app.log.error(`[stripe-webhook] Failed to insert purchase from metadata`)
    return
  }

  const purchaseId = rows[0].id
  app.log.info(`[stripe-webhook] Created purchase ${purchaseId} from metadata`)

  const purchase = await getPurchaseBySessionId(session.id)
  if (purchase) {
    const visibilityId = await createVisibilityFromPurchase(purchase)
    app.log.info(`[stripe-webhook] Activated purchase ${purchaseId} — visibility ${visibilityId}`)
  }
}

async function fulfillMembershipPurchase(
  app: FastifyInstance,
  session: Stripe.Checkout.Session,
  meta: Record<string, string>,
  customerId: string | null,
) {
  const businessId = meta.business_id
  if (!businessId) {
    app.log.warn(`[stripe-webhook] Membership checkout missing business_id`)
    return
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription : null
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent : null

  const pricePaid = parseFloat(meta.computed_final_price || '150')
  const startsAt = new Date()
  const expiresAt = new Date(startsAt.getTime() + 365 * 86_400_000)

  const membershipId = await createMembership({
    businessClientId: businessId,
    pricingPlanId: meta.plan_id || null,
    pricePaid,
    currency: 'eur',
    stripeCheckoutSessionId: session.id,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    stripePaymentIntentId: paymentIntentId,
    startsAt,
    expiresAt,
  })

  app.log.info(`[stripe-webhook] Activated membership ${membershipId} for business ${businessId}`)
}

// ─── Refund handler ─────────────────────────────────────────────────────────

async function handleChargeRefunded(
  app: FastifyInstance,
  charge: Stripe.Charge,
) {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent : null

  app.log.info(`[stripe-webhook] charge.refunded — charge=${charge.id} pi=${paymentIntentId}`)

  if (!paymentIntentId) return

  // Find purchase by payment_intent
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM purchases
     WHERE stripe_payment_intent_id = $1
       AND status IN ('paid', 'activated')
     LIMIT 1`,
    [paymentIntentId],
  )

  if (!rows[0]) {
    app.log.info(`[stripe-webhook] No matching purchase for refunded charge pi=${paymentIntentId}`)
    return
  }

  await refundPurchase(rows[0].id)
  app.log.info(`[stripe-webhook] Refunded purchase ${rows[0].id} — inventory released`)
}

// ─── Subscription handlers ──────────────────────────────────────────────────

async function handleSubscriptionUpdate(
  app: FastifyInstance,
  subscription: Stripe.Subscription,
) {
  app.log.info(`[stripe-webhook] subscription update — id=${subscription.id} status=${subscription.status}`)

  switch (subscription.status) {
    case 'active':
    case 'trialing':
      await updateMembershipStatus(subscription.id, 'active')
      break
    case 'past_due':
      await updateMembershipStatus(subscription.id, 'past_due')
      break
    case 'canceled':
    case 'unpaid':
      await cancelMembershipBySubscription(subscription.id)
      break
  }
}

async function handleSubscriptionDeleted(
  app: FastifyInstance,
  subscription: Stripe.Subscription,
) {
  app.log.info(`[stripe-webhook] subscription deleted — id=${subscription.id}`)
  await cancelMembershipBySubscription(subscription.id)
}

function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as Record<string, unknown>
  const sub = raw.subscription
  if (typeof sub === 'string') return sub
  if (sub && typeof sub === 'object' && 'id' in sub) return (sub as { id: string }).id
  return null
}

async function handleInvoicePaid(
  app: FastifyInstance,
  invoice: Stripe.Invoice,
) {
  const subId = extractSubscriptionId(invoice)
  app.log.info(`[stripe-webhook] invoice.paid — id=${invoice.id} sub=${subId} amount=${invoice.amount_paid}`)

  if (subId) {
    const now = new Date()
    const newExpiry = new Date(now.getTime() + 365 * 86_400_000)
    await db.query(
      `UPDATE memberships SET expires_at = $2, status = 'active', updated_at = now()
       WHERE stripe_subscription_id = $1 AND status IN ('active', 'past_due')`,
      [subId, newExpiry.toISOString()],
    ).catch(() => {})
  }
}

async function handleInvoicePaymentFailed(
  app: FastifyInstance,
  invoice: Stripe.Invoice,
) {
  const subId = extractSubscriptionId(invoice)
  app.log.warn(`[stripe-webhook] invoice.payment_failed — id=${invoice.id} sub=${subId}`)
  if (subId) {
    await updateMembershipStatus(subId, 'past_due').catch(() => {})
  }
}
