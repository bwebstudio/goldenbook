import Stripe from 'stripe'
import { db } from '../../db/postgres'
import { env } from '../../config/env'

// ─── Queue a failed refund for retry ──────────────────────────────────────────

export async function queuePendingRefund(
  purchaseId: string,
  paymentIntentId: string,
  reason: string,
  error: string,
): Promise<void> {
  await db.query(
    `INSERT INTO pending_refunds (purchase_id, payment_intent_id, reason, attempts, last_attempt_at, last_error)
     VALUES ($1, $2, $3, 1, now(), $4)
     ON CONFLICT DO NOTHING`,
    [purchaseId, paymentIntentId, reason, error],
  ).catch(() => {
    // Table may not exist yet — log and continue
    console.error(`[pending-refunds] Could not queue refund for purchase ${purchaseId} — table may not exist`)
  })
}

// ─── Retry pending refunds (called by scheduled job) ─────────────────────────

const MAX_ATTEMPTS = 10

export async function retryPendingRefunds(): Promise<number> {
  if (!env.STRIPE_SECRET_KEY) return 0

  let pending: { id: string; purchase_id: string; payment_intent_id: string; reason: string; attempts: number }[]
  try {
    const { rows } = await db.query<{
      id: string; purchase_id: string; payment_intent_id: string; reason: string; attempts: number
    }>(
      `SELECT id, purchase_id, payment_intent_id, reason, attempts
       FROM pending_refunds
       WHERE resolved = false AND attempts < $1
       ORDER BY created_at ASC
       LIMIT 10`,
      [MAX_ATTEMPTS],
    )
    pending = rows
  } catch {
    // Table may not exist
    return 0
  }

  if (pending.length === 0) return 0

  const stripe = new Stripe(env.STRIPE_SECRET_KEY)
  let resolved = 0

  for (const row of pending) {
    try {
      await stripe.refunds.create({
        payment_intent: row.payment_intent_id,
        reason: 'requested_by_customer',
        metadata: {
          reason: row.reason,
          purchase_id: row.purchase_id,
          retry_attempt: String(row.attempts + 1),
        },
      })

      // Success — mark resolved
      await db.query(
        `UPDATE pending_refunds SET resolved = true, attempts = attempts + 1, last_attempt_at = now(), updated_at = now() WHERE id = $1`,
        [row.id],
      )
      console.info(`[pending-refunds] Refund succeeded for purchase ${row.purchase_id} on attempt ${row.attempts + 1}`)
      resolved++
    } catch (err) {
      // Failed again — increment attempts
      const errMsg = err instanceof Error ? err.message : 'unknown'
      await db.query(
        `UPDATE pending_refunds SET attempts = attempts + 1, last_attempt_at = now(), last_error = $2, updated_at = now() WHERE id = $1`,
        [row.id, errMsg],
      )
      console.error(`[pending-refunds] Retry failed for purchase ${row.purchase_id}: ${errMsg}`)
    }
  }

  return resolved
}

// ─── Mark refund as resolved (called when charge.refunded webhook arrives) ───

export async function markRefundResolved(paymentIntentId: string): Promise<void> {
  await db.query(
    `UPDATE pending_refunds SET resolved = true, updated_at = now() WHERE payment_intent_id = $1 AND resolved = false`,
    [paymentIntentId],
  ).catch(() => {})
}
