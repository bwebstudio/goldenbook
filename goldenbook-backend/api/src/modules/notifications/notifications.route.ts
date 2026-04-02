import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../shared/auth/authPlugin'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './notifications.query'

export async function notificationsRoutes(app: FastifyInstance) {

  // ── GET /me/notifications ──────────────────────────────────────────────
  app.get('/me/notifications', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.sub

    const [items, unreadCount] = await Promise.all([
      getNotifications(userId),
      getUnreadCount(userId),
    ])

    return reply.send({
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
        createdAt: n.created_at,
      })),
      unreadCount,
    })
  })

  // ── GET /me/notifications/unread-count ─────────────────────────────────
  app.get('/me/notifications/unread-count', { preHandler: [authenticate] }, async (request, reply) => {
    const count = await getUnreadCount(request.user.sub)
    return reply.send({ unreadCount: count })
  })

  // ── POST /me/notifications/mark-read ───────────────────────────────────
  app.post('/me/notifications/mark-read', { preHandler: [authenticate] }, async (request, reply) => {
    const body = z.object({
      notificationId: z.string().uuid(),
    }).parse(request.body)

    const ok = await markAsRead(body.notificationId, request.user.sub)
    return reply.send({ ok })
  })

  // ── POST /me/notifications/mark-all-read ───────────────────────────────
  app.post('/me/notifications/mark-all-read', { preHandler: [authenticate] }, async (request, reply) => {
    await markAllAsRead(request.user.sub)
    return reply.send({ ok: true })
  })
}
