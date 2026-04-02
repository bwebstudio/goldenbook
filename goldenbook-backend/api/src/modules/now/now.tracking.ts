// ─── NOW Tracking Service ─────────────────────────────────────────────────────
//
// Fire-and-forget impression and click tracking for the NOW recommendation.
// All writes are non-blocking — tracking failures never affect recommendations.

import { db } from '../../db/postgres'
import type { NowWeights } from './now.weights'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImpressionContext {
  time_of_day: string
  weather: string | null
  moment: string | null
  segment: string | null
  experiment_variant: string | null
}

// ─── Track impression ────────────────────────────────────────────────────────

/**
 * Record that a NOW recommendation was shown to a user.
 * Non-blocking — errors are swallowed.
 */
export function trackImpression(params: {
  sessionId: string | null
  userId: string | null
  placeId: string
  city: string
  context: ImpressionContext
  weightsUsed: NowWeights | null
}): void {
  db.query(`
    INSERT INTO now_impressions (session_id, user_id, place_id, city, context, weights_used)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    params.sessionId,
    params.userId,
    params.placeId,
    params.city,
    JSON.stringify(params.context),
    params.weightsUsed ? JSON.stringify(params.weightsUsed) : null,
  ]).catch(() => {}) // fire-and-forget
}

// ─── Track click ─────────────────────────────────────────────────────────────

/**
 * Record that a user clicked/tapped on a NOW recommendation.
 * Called from the mobile client via POST /concierge/now/click.
 */
export async function trackClick(params: {
  sessionId: string | null
  userId: string | null
  placeId: string
  city: string | null
}): Promise<void> {
  await db.query(`
    INSERT INTO now_clicks (session_id, user_id, place_id, city)
    VALUES ($1, $2, $3, $4)
  `, [params.sessionId, params.userId, params.placeId, params.city]).catch(() => {})
}