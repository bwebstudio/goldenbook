// Revenue and campaign readers for the dashboard analytics page.
//
// GET /api/v1/admin/analytics/overview?period=7|30|90&audience=all|core
// GET /api/v1/admin/analytics/campaigns?period=7|30|90
// GET /api/v1/admin/analytics/establishments?period=7|30|90&audience=all|core
// GET /api/v1/admin/analytics/time
//
// audience=core leaves task-app users out of the engagement counts
// (internal-traffic.ts); revenue is never filtered by audience.
//
// Errors are not caught here. These used to resolve every failure to zero,
// which the page rendered as "no sales"; now a failing query is a 500 and the
// dashboard shows that section as "couldn't load".

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { db } from '../../../db/postgres'
import { internalTrafficCtes, isRealEvent, isRealLegacyEvent, parseAudience } from './internal-traffic'

const periodSchema = z.object({
  period: z.enum(['7', '30', '90']).default('30'),
})

const SINCE = `now() - ($1 || ' days')::interval`

/** Purchases that represent money actually taken. */
const SETTLED = `('paid', 'activated', 'expired')`

export async function campaignAnalyticsRoutes(app: FastifyInstance) {

  // ── GET /admin/analytics/overview ───────────────────────────────────────────
  app.get('/admin/analytics/overview', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    const days = parseInt(periodSchema.parse(request.query).period, 10)
    const audience = parseAudience(request.query)

    const [revenueResult, dailyResult, activePlacementsResult, conversionResult] = await Promise.all([
      db.query<{ total: string; count: string }>(`
        SELECT COALESCE(SUM(final_price::numeric), 0)::text AS total,
               COUNT(*)::text AS count
        FROM purchases
        WHERE status IN ${SETTLED}
          AND created_at >= ${SINCE}
      `, [days]),

      // Bucket once by day, then pad the empty days.
      db.query<{ date: string; revenue: string; count: string }>(`
        WITH per_day AS (
          SELECT created_at::date AS day,
                 SUM(final_price::numeric) AS revenue,
                 COUNT(*) AS count
            FROM purchases
           WHERE status IN ${SETTLED}
             AND created_at >= now()::date - $1::int
           GROUP BY created_at::date
        )
        SELECT g.day::date::text AS date,
               COALESCE(pd.revenue, 0)::text AS revenue,
               COALESCE(pd.count, 0)::text   AS count
          FROM generate_series(now()::date - $1::int, now()::date, interval '1 day') g(day)
          LEFT JOIN per_day pd ON pd.day = g.day::date
         ORDER BY g.day
      `, [days]),

      db.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM place_visibility
        WHERE is_active = true AND ends_at > now()
      `),

      // Checkout funnel. These events still land in the legacy
      // place_analytics_events table (campaigns-tracking.route.ts), which has
      // no is_internal flag, so staff and QA sessions are excluded here.
      db.query<{ event_type: string; count: string }>(`
        WITH ${internalTrafficCtes(SINCE, audience)}
        SELECT pae.event_type, COUNT(*)::text AS count
        FROM place_analytics_events pae
        WHERE pae.event_type IN ('campaign_slot_selected', 'campaign_checkout_started', 'campaign_checkout_completed')
          AND pae.created_at >= ${SINCE}
          AND ${isRealLegacyEvent('pae')}
        GROUP BY pae.event_type
      `, [days]),
    ])

    const conversionMap: Record<string, number> = {}
    for (const r of conversionResult.rows) {
      conversionMap[r.event_type] = parseInt(r.count)
    }

    const started = conversionMap['campaign_checkout_started'] ?? 0
    const completed = conversionMap['campaign_checkout_completed'] ?? 0

    return reply.send({
      revenue: {
        total: parseFloat(revenueResult.rows[0]?.total ?? '0'),
        purchases: parseInt(revenueResult.rows[0]?.count ?? '0'),
        period: days,
      },
      daily: dailyResult.rows.map((r) => ({
        date: r.date,
        revenue: parseFloat(r.revenue),
        count: parseInt(r.count),
      })),
      activePlacements: parseInt(activePlacementsResult.rows[0]?.count ?? '0'),
      conversion: {
        selected: conversionMap['campaign_slot_selected'] ?? 0,
        started,
        completed,
        rate: started > 0 ? Math.round((completed / started) * 100) : null,
      },
    })
  })

  // ── GET /admin/analytics/campaigns ──────────────────────────────────────────
  app.get('/admin/analytics/campaigns', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    const days = parseInt(periodSchema.parse(request.query).period, 10)

    const { rows } = await db.query<{
      section: string
      total_purchases: string
      total_revenue: string
      active_count: string
    }>(`
      SELECT
        placement_type AS section,
        COUNT(*)::text AS total_purchases,
        COALESCE(SUM(final_price::numeric), 0)::text AS total_revenue,
        COUNT(*) FILTER (WHERE status = 'activated')::text AS active_count
      FROM purchases
      WHERE placement_type IS NOT NULL
        AND status IN ${SETTLED}
        AND created_at >= ${SINCE}
      GROUP BY placement_type
      ORDER BY SUM(final_price::numeric) DESC
    `, [days])

    return reply.send({
      campaigns: rows.map((r) => ({
        section: r.section,
        totalPurchases: parseInt(r.total_purchases),
        totalRevenue: parseFloat(r.total_revenue),
        activeCount: parseInt(r.active_count),
      })),
    })
  })

  // ── GET /admin/analytics/establishments ─────────────────────────────────────
  // Top 20 places by revenue in the window, with what the app recorded for
  // them in the same window. Purchases are aggregated on their own before
  // joining, so two purchases of the same amount are two purchases (the old
  // SUM(DISTINCT final_price) merged them), and engagement comes from
  // analytics_events: the legacy per-event tables stopped being written.
  app.get('/admin/analytics/establishments', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    const days = parseInt(periodSchema.parse(request.query).period, 10)
    const audience = parseAudience(request.query)

    const { rows } = await db.query<{
      place_id: string
      place_name: string
      total_purchases: string
      total_revenue: string
      active_count: string
      views: string
      website_clicks: string
      booking_clicks: string
      map_opens: string
    }>(`
      WITH ${internalTrafficCtes(SINCE, audience)},
      pu AS (
        SELECT place_id,
               COUNT(*) AS total_purchases,
               SUM(final_price::numeric) AS total_revenue,
               COUNT(*) FILTER (WHERE status = 'activated') AS active_count
          FROM purchases
         WHERE status IN ${SETTLED}
           AND place_id IS NOT NULL
           AND created_at >= ${SINCE}
         GROUP BY place_id
         ORDER BY SUM(final_price::numeric) DESC
         LIMIT 20
      ),
      ev AS (
        SELECT ae.place_id,
               COUNT(*) FILTER (WHERE ae.event_name = 'place_view')    AS views,
               COUNT(*) FILTER (WHERE ae.event_name = 'website_click') AS website_clicks,
               COUNT(*) FILTER (WHERE ae.event_name = 'booking_click') AS booking_clicks,
               COUNT(*) FILTER (WHERE ae.event_name = 'map_open')      AS map_opens
          FROM analytics_events ae
         WHERE ae.place_id IN (SELECT place_id FROM pu)
           AND ae.event_name IN ('place_view', 'website_click', 'booking_click', 'map_open')
           AND ae.created_at >= ${SINCE}
           AND ${isRealEvent('ae')}
         GROUP BY ae.place_id
      )
      SELECT p.id AS place_id,
             p.name AS place_name,
             pu.total_purchases::text,
             pu.total_revenue::text,
             pu.active_count::text,
             COALESCE(ev.views, 0)::text          AS views,
             COALESCE(ev.website_clicks, 0)::text AS website_clicks,
             COALESCE(ev.booking_clicks, 0)::text AS booking_clicks,
             COALESCE(ev.map_opens, 0)::text      AS map_opens
        FROM pu
        JOIN places p ON p.id = pu.place_id
        LEFT JOIN ev ON ev.place_id = pu.place_id
       ORDER BY pu.total_revenue DESC
    `, [days])

    return reply.send({
      establishments: rows.map((r) => ({
        placeId: r.place_id,
        placeName: r.place_name,
        totalPurchases: parseInt(r.total_purchases),
        totalRevenue: parseFloat(r.total_revenue),
        activeCount: parseInt(r.active_count),
        views: parseInt(r.views),
        websiteClicks: parseInt(r.website_clicks),
        bookingClicks: parseInt(r.booking_clicks),
        mapOpens: parseInt(r.map_opens),
      })),
    })
  })

  // ── GET /admin/analytics/time ───────────────────────────────────────────────
  app.get('/admin/analytics/time', {
    preHandler: [authenticateDashboardUser],
  }, async (_request, reply) => {
    const [bucketResult, dowResult] = await Promise.all([
      // Time bucket performance from campaign inventory
      db.query<{ time_bucket: string; total: string; sold: string }>(`
        SELECT time_bucket,
               COUNT(*)::text AS total,
               COUNT(*) FILTER (WHERE status = 'sold')::text AS sold
        FROM campaign_inventory
        GROUP BY time_bucket
        ORDER BY COUNT(*) FILTER (WHERE status = 'sold') DESC
      `),

      // Revenue by day of week
      db.query<{ dow: string; revenue: string; count: string }>(`
        SELECT EXTRACT(DOW FROM created_at)::text AS dow,
               COALESCE(SUM(final_price::numeric), 0)::text AS revenue,
               COUNT(*)::text AS count
        FROM purchases
        WHERE status IN ${SETTLED}
        GROUP BY EXTRACT(DOW FROM created_at)
        ORDER BY EXTRACT(DOW FROM created_at)
      `),
    ])

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return reply.send({
      timeBuckets: bucketResult.rows.map((r) => ({
        timeBucket: r.time_bucket,
        total: parseInt(r.total),
        sold: parseInt(r.sold),
        rate: parseInt(r.total) > 0 ? Math.round((parseInt(r.sold) / parseInt(r.total)) * 100) : 0,
      })),
      dayOfWeek: dowResult.rows.map((r) => ({
        day: dayNames[parseInt(r.dow)] ?? r.dow,
        revenue: parseFloat(r.revenue),
        count: parseInt(r.count),
      })),
    })
  })
}
