import { db } from '../../db/postgres'
import { createNotification, createNotificationIfNew } from './notifications.query'

/**
 * Called after a campaign/purchase is activated for a place.
 */
export async function notifyCampaignActivated(userId: string, placementType: string): Promise<void> {
  await createNotification(
    userId,
    'campaign_activated',
    'Your campaign is now live',
    `Your ${placementType.replace(/_/g, ' ')} campaign has been activated and is now visible.`,
  )
}

/**
 * Called after a campaign/purchase expires.
 */
export async function notifyCampaignEnded(userId: string, placementType: string): Promise<void> {
  await createNotification(
    userId,
    'campaign_ended',
    'Your campaign has ended',
    `Your ${placementType.replace(/_/g, ' ')} campaign has ended. Consider renewing to stay visible.`,
  )
}

/**
 * Called when a change request is approved.
 */
export async function notifyChangeApproved(userId: string, fieldName: string): Promise<void> {
  await createNotification(
    userId,
    'change_approved',
    'Your listing change was approved',
    `Your update to "${fieldName.replace(/_/g, ' ')}" has been approved and is now live.`,
  )
}

/**
 * Called when a change request is rejected.
 */
export async function notifyChangeRejected(userId: string, fieldName: string, reason: string | null): Promise<void> {
  const msg = reason
    ? `Your update to "${fieldName.replace(/_/g, ' ')}" was not approved. Reason: ${reason}`
    : `Your update to "${fieldName.replace(/_/g, ' ')}" was not approved.`
  await createNotification(userId, 'change_rejected', 'Your listing change was not approved', msg)
}

/**
 * Called when a placement request is approved.
 */
export async function notifyPromotionApproved(userId: string, placementType: string): Promise<void> {
  await createNotification(
    userId,
    'promotion_approved',
    'Your promotion was approved',
    `Your ${placementType.replace(/_/g, ' ')} request has been approved.`,
  )
}

/**
 * Called when a placement request is rejected.
 */
export async function notifyPromotionRejected(userId: string, placementType: string, reason: string | null): Promise<void> {
  const msg = reason
    ? `Your ${placementType.replace(/_/g, ' ')} request was not approved. Reason: ${reason}`
    : `Your ${placementType.replace(/_/g, ' ')} request was not approved.`
  await createNotification(userId, 'promotion_rejected', 'Your promotion was not approved', msg)
}

/**
 * Checks for users with no active campaigns and notifies them (deduped per 7 days).
 */
export async function checkNoActiveCampaigns(): Promise<void> {
  try {
    const { rows } = await db.query<{ user_id: string }>(`
      SELECT DISTINCT bc.user_id
      FROM business_clients bc
      WHERE bc.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM purchases pu
          WHERE pu.business_client_id = bc.id
            AND pu.status IN ('paid', 'activated')
            AND (pu.expires_at IS NULL OR pu.expires_at > now())
        )
        AND NOT EXISTS (
          SELECT 1 FROM placement_requests pr
          WHERE pr.client_id = bc.id
            AND pr.status IN ('active', 'approved')
        )
    `)
    for (const { user_id } of rows) {
      await createNotificationIfNew(
        user_id,
        'no_active_campaigns',
        'You have no active visibility',
        'Your establishment has no active campaigns. Consider promoting to increase your visibility.',
        168, // 7 days
      )
    }
  } catch { /* tables may not exist */ }
}

/**
 * Checks for places with high performance and notifies (deduped per 7 days).
 */
export async function checkHighPerformance(): Promise<void> {
  try {
    const { rows } = await db.query<{ user_id: string; views: string }>(`
      SELECT bc.user_id, COUNT(pve.id)::text AS views
      FROM business_clients bc
      JOIN place_view_events pve ON pve.place_id = bc.place_id
        AND pve.created_at > now() - interval '7 days'
      WHERE bc.is_active = true
      GROUP BY bc.user_id
      HAVING COUNT(pve.id) >= 50
    `)
    for (const { user_id, views } of rows) {
      await createNotificationIfNew(
        user_id,
        'high_performance',
        'Your listing is performing well',
        `Your establishment received ${views} views in the last 7 days. Keep it up!`,
        168, // 7 days
      )
    }
  } catch { /* tables may not exist */ }
}
