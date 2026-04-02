import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../shared/auth/dashboardAuth'
import { db } from '../../db/postgres'

export async function behaviorAnalyticsRoutes(app: FastifyInstance) {

  // ── GET /admin/analytics/behavior ───────────────────────────────────────────
  app.get('/admin/analytics/behavior', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    const { period } = z.object({
      period: z.enum(['7', '30', '90']).default('30'),
    }).parse(request.query)

    const days = parseInt(period)

    const [topViewed, topClicked, topSaved, topCategories, dailyEvents] = await Promise.all([
      // Most viewed places
      db.query<{ place_id: string; place_name: string; count: string }>(`
        SELECT pae.place_id, p.name AS place_name, COUNT(*)::text AS count
        FROM place_analytics_events pae
        JOIN places p ON p.id = pae.place_id
        WHERE pae.event_type = 'view_place'
          AND pae.created_at >= now() - ($1 || ' days')::interval
        GROUP BY pae.place_id, p.name
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, [days]).catch(() => ({ rows: [] as never[] })),

      // Most clicked places
      db.query<{ place_id: string; place_name: string; count: string }>(`
        SELECT pae.place_id, p.name AS place_name, COUNT(*)::text AS count
        FROM place_analytics_events pae
        JOIN places p ON p.id = pae.place_id
        WHERE pae.event_type = 'click_place'
          AND pae.created_at >= now() - ($1 || ' days')::interval
        GROUP BY pae.place_id, p.name
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, [days]).catch(() => ({ rows: [] as never[] })),

      // Most saved places
      db.query<{ place_id: string; place_name: string; count: string }>(`
        SELECT pae.place_id, p.name AS place_name, COUNT(*)::text AS count
        FROM place_analytics_events pae
        JOIN places p ON p.id = pae.place_id
        WHERE pae.event_type = 'save_place'
          AND pae.created_at >= now() - ($1 || ' days')::interval
        GROUP BY pae.place_id, p.name
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, [days]).catch(() => ({ rows: [] as never[] })),

      // Top categories
      db.query<{ category: string; count: string }>(`
        SELECT category, COUNT(*)::text AS count
        FROM place_analytics_events
        WHERE category IS NOT NULL
          AND event_type IN ('view_place', 'click_place')
          AND created_at >= now() - ($1 || ' days')::interval
        GROUP BY category
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, [days]).catch(() => ({ rows: [] as { category: string; count: string }[] })),

      // Daily event volume
      db.query<{ date: string; views: string; clicks: string; saves: string; bookings: string }>(`
        SELECT d::date::text AS date,
               COUNT(*) FILTER (WHERE pae.event_type = 'view_place')::text AS views,
               COUNT(*) FILTER (WHERE pae.event_type = 'click_place')::text AS clicks,
               COUNT(*) FILTER (WHERE pae.event_type = 'save_place')::text AS saves,
               COUNT(*) FILTER (WHERE pae.event_type = 'click_booking')::text AS bookings
        FROM generate_series(
          (now() - ($1 || ' days')::interval)::date,
          now()::date, '1 day'
        ) AS d
        LEFT JOIN place_analytics_events pae ON pae.created_at::date = d::date
        GROUP BY d ORDER BY d
      `, [days]).catch(() => ({ rows: [] as never[] })),
    ])

    // Total event counts
    const totalViews = topViewed.rows.reduce((s, r) => s + parseInt(r.count), 0)
    const totalClicks = topClicked.rows.reduce((s, r) => s + parseInt(r.count), 0)
    const totalSaves = topSaved.rows.reduce((s, r) => s + parseInt(r.count), 0)

    return reply.send({
      period: days,
      totals: { views: totalViews, clicks: totalClicks, saves: totalSaves },
      topViewed: topViewed.rows.map((r) => ({ placeId: r.place_id, placeName: r.place_name, count: parseInt(r.count) })),
      topClicked: topClicked.rows.map((r) => ({ placeId: r.place_id, placeName: r.place_name, count: parseInt(r.count) })),
      topSaved: topSaved.rows.map((r) => ({ placeId: r.place_id, placeName: r.place_name, count: parseInt(r.count) })),
      topCategories: topCategories.rows.map((r) => ({ category: r.category, count: parseInt(r.count) })),
      daily: dailyEvents.rows.map((r) => ({
        date: r.date,
        views: parseInt(r.views),
        clicks: parseInt(r.clicks),
        saves: parseInt(r.saves),
        bookings: parseInt(r.bookings),
      })),
    })
  })
}
