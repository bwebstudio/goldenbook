import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { db } from '../../../db/postgres'

export async function campaignAnalyticsRoutes(app: FastifyInstance) {

  // ── GET /admin/analytics/overview ───────────────────────────────────────────
  app.get('/admin/analytics/overview', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    const { period } = z.object({
      period: z.enum(['7', '30', '90']).default('30'),
    }).parse(request.query)

    const days = parseInt(period)

    const [revenueResult, purchasesResult, activePlacementsResult, conversionResult] = await Promise.all([
      // Total revenue
      db.query<{ total: string; count: string }>(`
        SELECT COALESCE(SUM(final_price::numeric), 0)::text AS total,
               COUNT(*)::text AS count
        FROM purchases
        WHERE status IN ('paid', 'activated', 'expired')
          AND created_at >= now() - ($1 || ' days')::interval
      `, [days]).catch(() => ({ rows: [{ total: '0', count: '0' }] })),

      // Revenue by day
      db.query<{ date: string; revenue: string; count: string }>(`
        SELECT d::date::text AS date,
               COALESCE(SUM(p.final_price::numeric), 0)::text AS revenue,
               COUNT(p.id)::text AS count
        FROM generate_series(
          (now() - ($1 || ' days')::interval)::date,
          now()::date,
          '1 day'
        ) AS d
        LEFT JOIN purchases p ON p.created_at::date = d::date
          AND p.status IN ('paid', 'activated', 'expired')
        GROUP BY d
        ORDER BY d
      `, [days]).catch(() => ({ rows: [] as { date: string; revenue: string; count: string }[] })),

      // Active placements
      db.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM place_visibility
        WHERE is_active = true AND ends_at > now()
      `).catch(() => ({ rows: [{ count: '0' }] })),

      // Conversion funnel from tracking events
      db.query<{ event_type: string; count: string }>(`
        SELECT event_type, COUNT(*)::text AS count
        FROM place_analytics_events
        WHERE event_type IN ('campaign_slot_selected', 'campaign_checkout_started', 'campaign_checkout_completed')
          AND created_at >= now() - ($1 || ' days')::interval
        GROUP BY event_type
      `, [days]).catch(() => ({ rows: [] as { event_type: string; count: string }[] })),
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
      daily: purchasesResult.rows.map((r) => ({
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
  }, async (_request, reply) => {
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
      GROUP BY placement_type
      ORDER BY SUM(final_price::numeric) DESC
    `).catch(() => ({ rows: [] as never[] }))

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
  app.get('/admin/analytics/establishments', {
    preHandler: [authenticateDashboardUser],
  }, async (_request, reply) => {
    const { rows } = await db.query<{
      place_id: string
      place_name: string
      total_purchases: string
      total_revenue: string
      active_count: string
      views: string
      clicks: string
      selections: string
      checkouts: string
    }>(`
      SELECT
        p.id AS place_id,
        p.name AS place_name,
        COUNT(DISTINCT pu.id)::text AS total_purchases,
        COALESCE(SUM(DISTINCT pu.final_price::numeric), 0)::text AS total_revenue,
        COUNT(DISTINCT pu.id) FILTER (WHERE pu.status = 'activated')::text AS active_count,
        (SELECT COUNT(*) FROM place_view_events pve WHERE pve.place_id = p.id)::text AS views,
        (SELECT COUNT(*) FROM place_website_click_events pwce WHERE pwce.place_id = p.id)::text AS clicks,
        (SELECT COUNT(*) FROM place_analytics_events pae WHERE pae.place_id = p.id AND pae.event_type = 'campaign_slot_selected')::text AS selections,
        (SELECT COUNT(*) FROM place_analytics_events pae WHERE pae.place_id = p.id AND pae.event_type = 'campaign_checkout_completed')::text AS checkouts
      FROM places p
      LEFT JOIN purchases pu ON pu.place_id = p.id
        AND pu.status IN ('paid', 'activated', 'expired')
      GROUP BY p.id, p.name
      HAVING COUNT(pu.id) > 0
      ORDER BY COALESCE(SUM(pu.final_price::numeric), 0) DESC
      LIMIT 20
    `).catch(() => ({ rows: [] as never[] }))

    return reply.send({
      establishments: rows.map((r) => ({
        placeId: r.place_id,
        placeName: r.place_name,
        totalPurchases: parseInt(r.total_purchases),
        totalRevenue: parseFloat(r.total_revenue),
        activeCount: parseInt(r.active_count),
        views: parseInt(r.views) || parseInt(r.selections),
        clicks: parseInt(r.clicks) || parseInt(r.checkouts),
      })),
    })
  })

  // ── GET /admin/analytics/time ───────────────────────────────────────────────
  app.get('/admin/analytics/time', {
    preHandler: [authenticateDashboardUser],
  }, async (_request, reply) => {
    // Time bucket performance from campaign inventory
    const { rows: bucketRows } = await db.query<{
      time_bucket: string
      total: string
      sold: string
    }>(`
      SELECT time_bucket,
             COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE status = 'sold')::text AS sold
      FROM campaign_inventory
      GROUP BY time_bucket
      ORDER BY COUNT(*) FILTER (WHERE status = 'sold') DESC
    `).catch(() => ({ rows: [] as { time_bucket: string; total: string; sold: string }[] }))

    // Revenue by day of week
    const { rows: dowRows } = await db.query<{
      dow: string
      revenue: string
      count: string
    }>(`
      SELECT EXTRACT(DOW FROM created_at)::text AS dow,
             COALESCE(SUM(final_price::numeric), 0)::text AS revenue,
             COUNT(*)::text AS count
      FROM purchases
      WHERE status IN ('paid', 'activated', 'expired')
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY EXTRACT(DOW FROM created_at)
    `).catch(() => ({ rows: [] as { dow: string; revenue: string; count: string }[] }))

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return reply.send({
      timeBuckets: bucketRows.map((r) => ({
        timeBucket: r.time_bucket,
        total: parseInt(r.total),
        sold: parseInt(r.sold),
        rate: parseInt(r.total) > 0 ? Math.round((parseInt(r.sold) / parseInt(r.total)) * 100) : 0,
      })),
      dayOfWeek: dowRows.map((r) => ({
        day: dayNames[parseInt(r.dow)] ?? r.dow,
        revenue: parseFloat(r.revenue),
        count: parseInt(r.count),
      })),
    })
  })

  // ── GET /admin/analytics/booking ────────────────────────────────────────────
  // Booking provider analytics (TheFork, Booking.com, Viator, etc.)
  app.get('/admin/analytics/booking', {
    preHandler: [authenticateDashboardUser],
  }, async (_request, reply) => {
    const [providersResult, clicksResult, topPlacesResult] = await Promise.all([
      // Candidates by provider
      db.query<{ provider: string; total: string; active: string; valid: string }>(`
        SELECT provider,
               COUNT(*)::text AS total,
               COUNT(*) FILTER (WHERE is_active = true)::text AS active,
               COUNT(*) FILTER (WHERE validation_status = 'valid')::text AS valid
        FROM place_booking_candidates
        GROUP BY provider
        ORDER BY COUNT(*) DESC
      `).catch(() => ({ rows: [] as { provider: string; total: string; active: string; valid: string }[] })),

      // Website clicks over time (last 30 days)
      db.query<{ date: string; count: string }>(`
        SELECT d::date::text AS date, COUNT(c.id)::text AS count
        FROM generate_series(
          (now() - '30 days'::interval)::date,
          now()::date,
          '1 day'
        ) AS d
        LEFT JOIN place_website_click_events c ON c.created_at::date = d::date
        GROUP BY d ORDER BY d
      `).catch(() => ({ rows: [] as { date: string; count: string }[] })),

      // Top places by clicks
      db.query<{ place_name: string; clicks: string; views: string }>(`
        SELECT p.name AS place_name,
               (SELECT COUNT(*) FROM place_website_click_events wc WHERE wc.place_id = p.id)::text AS clicks,
               (SELECT COUNT(*) FROM place_view_events ve WHERE ve.place_id = p.id)::text AS views
        FROM places p
        WHERE EXISTS (SELECT 1 FROM place_booking_candidates bc WHERE bc.place_id = p.id AND bc.is_active = true)
        ORDER BY (SELECT COUNT(*) FROM place_website_click_events wc WHERE wc.place_id = p.id) DESC
        LIMIT 10
      `).catch(() => ({ rows: [] as { place_name: string; clicks: string; views: string }[] })),
    ])

    return reply.send({
      providers: providersResult.rows.map((r) => ({
        provider: r.provider,
        total: parseInt(r.total),
        active: parseInt(r.active),
        valid: parseInt(r.valid),
      })),
      dailyClicks: clicksResult.rows.map((r) => ({
        date: r.date,
        count: parseInt(r.count),
      })),
      topPlaces: topPlacesResult.rows.map((r) => ({
        placeName: r.place_name,
        clicks: parseInt(r.clicks),
        views: parseInt(r.views),
      })),
    })
  })
}
