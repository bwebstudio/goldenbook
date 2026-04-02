import { db } from '../../db/postgres'

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export async function getNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  try {
    const { rows } = await db.query<NotificationRow>(
      `SELECT id, user_id, type, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    )
    return rows
  } catch {
    return []
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId],
    )
    return parseInt(rows[0]?.count ?? '0')
  } catch {
    return 0
  }
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    const { rowCount } = await db.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [notificationId, userId],
    )
    return (rowCount ?? 0) > 0
  } catch {
    return false
  }
}

export async function markAllAsRead(userId: string): Promise<void> {
  try {
    await db.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [userId],
    )
  } catch { /* table may not exist */ }
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)`,
      [userId, type, title, message],
    )
  } catch { /* table may not exist */ }
}

export async function createNotificationIfNew(
  userId: string,
  type: string,
  title: string,
  message: string,
  dedupWindowHours = 24,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message)
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE user_id = $1 AND type = $2 AND title = $3
           AND created_at > now() - interval '1 hour' * $5
       )`,
      [userId, type, title, message, dedupWindowHours],
    )
  } catch { /* table may not exist */ }
}
