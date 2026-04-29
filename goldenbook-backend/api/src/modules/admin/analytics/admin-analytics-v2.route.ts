// Admin analytics readers (v2) — user, content, feature, and search tabs
// for the dashboard. All aggregate over the unified analytics_events +
// user_sessions tables produced by the mobile app's track() helper.
//
// GET /api/v1/admin/analytics/users?period=7|30|90
// GET /api/v1/admin/analytics/content?period=7|30|90
// GET /api/v1/admin/analytics/features?period=7|30|90
// GET /api/v1/admin/analytics/search?period=7|30|90
//
// All endpoints require a dashboard admin session. All queries filter on
// created_at >= now() - period interval. Daily series use
// generate_series(now() - period, now(), '1 day') so empty days become
// zero-rows (not gaps).

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../../db/postgres'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'

const periodSchema = z.object({
  period: z.enum(['7', '30', '90']).default('30'),
})

function days(period: string): number { return parseInt(period, 10) }

export async function adminAnalyticsV2Routes(app: FastifyInstance) {

  // ── GET /admin/analytics/users ──────────────────────────────────────────
  app.get('/admin/analytics/users', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { period } = periodSchema.parse(request.query)
    const d = days(period)

    const [dauRows, sessionsRows, durationAgg, kpis] = await Promise.all([
      // DAU series. We count DISTINCT COALESCE(event.user_id, session.user_id)
      // so that events whose JWT wasn't attached (typical for the first
      // `app_session_start` that fires before login) still count — provided
      // the linked `user_sessions` row has a user_id (backfilled by a
      // subsequent `sessionStart` after sign-in via the backend's COALESCE
      // upsert). Fixes the case where a user who logged in but didn't
      // otherwise interact was invisible to DAU.
      db.query<{ date: string; dau: string }>(`
        SELECT d::date::text AS date,
               COALESCE(COUNT(DISTINCT COALESCE(ae.user_id, s.user_id)), 0)::text AS dau
          FROM generate_series(
                 (now() - ($1 || ' days')::interval)::date,
                 now()::date,
                 '1 day'
               ) d
          LEFT JOIN analytics_events ae
                 ON ae.created_at::date = d::date
          LEFT JOIN user_sessions s
                 ON s.session_id = ae.session_id
         GROUP BY d ORDER BY d
      `, [d]),

      db.query<{ date: string; ios: string; android: string; web: string; total: string }>(`
        SELECT d::date::text AS date,
               COUNT(*) FILTER (WHERE us.device_type = 'ios')::text      AS ios,
               COUNT(*) FILTER (WHERE us.device_type = 'android')::text  AS android,
               COUNT(*) FILTER (WHERE us.device_type = 'web')::text      AS web,
               COUNT(*)::text AS total
          FROM generate_series(
                 (now() - ($1 || ' days')::interval)::date,
                 now()::date,
                 '1 day'
               ) d
          LEFT JOIN user_sessions us ON us.started_at::date = d::date
         GROUP BY d ORDER BY d
      `, [d]),

      db.query<{
        avg_sec: string | null; p50: string | null; p75: string | null; p95: string | null
      }>(`
        SELECT AVG(duration_sec)::text                                        AS avg_sec,
               PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY duration_sec)::text AS p50,
               PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY duration_sec)::text AS p75,
               PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_sec)::text AS p95
          FROM user_sessions
         WHERE ended_at IS NOT NULL
           AND started_at >= now() - ($1 || ' days')::interval
      `, [d]),

      // Headline KPIs. Same session-fallback logic as the DAU series — counts
      // a user whose JWT wasn't attached to the event if we can resolve their
      // identity from the linked user_sessions row. COUNT(DISTINCT ...) drops
      // NULLs naturally, so genuinely anonymous traffic is still excluded.
      //
      // dau_today uses today's calendar date (server timezone) so the headline
      // matches the rightmost bar of the daily chart. Previously the value
      // used a rolling 24h window, which drifted from the chart whenever the
      // dashboard was opened mid-day.
      //
      // The COUNT branch also unions the user_sessions row directly (not just
      // through analytics_events) so a user whose only "activity" today was
      // a foreground session_start upsert (no event row yet) still counts —
      // the mobile client now emits app_session_start on warm resume, but
      // this UNION keeps the query resilient if event ingestion is briefly
      // dropped (rate-limited / network blip).
      db.query<{ dau_today: string; wau: string; mau: string; sessions_per_user: string | null }>(`
        SELECT
          (SELECT COUNT(DISTINCT user_id) FROM (
             SELECT COALESCE(ae.user_id, s.user_id) AS user_id
               FROM analytics_events ae
               LEFT JOIN user_sessions s ON s.session_id = ae.session_id
              WHERE ae.created_at::date = current_date
             UNION
             SELECT user_id
               FROM user_sessions
              WHERE user_id IS NOT NULL
                AND (last_seen_at::date = current_date OR started_at::date = current_date)
           ) u WHERE user_id IS NOT NULL)::text AS dau_today,
          (SELECT COUNT(DISTINCT COALESCE(ae.user_id, s.user_id))
             FROM analytics_events ae
             LEFT JOIN user_sessions s ON s.session_id = ae.session_id
            WHERE ae.created_at >= now() - interval '7 days')::text AS wau,
          (SELECT COUNT(DISTINCT COALESCE(ae.user_id, s.user_id))
             FROM analytics_events ae
             LEFT JOIN user_sessions s ON s.session_id = ae.session_id
            WHERE ae.created_at >= now() - interval '30 days')::text AS mau,
          (SELECT (COUNT(*)::numeric / NULLIF(COUNT(DISTINCT user_id), 0))::text
             FROM user_sessions
            WHERE user_id IS NOT NULL AND started_at >= now() - ($1 || ' days')::interval) AS sessions_per_user
      `, [d]),
    ])

    return reply.send({
      period: d,
      kpis: {
        dauToday:        Number(kpis.rows[0]?.dau_today ?? 0),
        wau:             Number(kpis.rows[0]?.wau ?? 0),
        mau:             Number(kpis.rows[0]?.mau ?? 0),
        sessionsPerUser: Number(kpis.rows[0]?.sessions_per_user ?? 0),
        avgSessionSec:   Number(durationAgg.rows[0]?.avg_sec ?? 0),
        sessionP50Sec:   Number(durationAgg.rows[0]?.p50 ?? 0),
        sessionP75Sec:   Number(durationAgg.rows[0]?.p75 ?? 0),
        sessionP95Sec:   Number(durationAgg.rows[0]?.p95 ?? 0),
      },
      dau: dauRows.rows.map(r => ({ date: r.date, dau: Number(r.dau) })),
      sessions: sessionsRows.rows.map(r => ({
        date: r.date,
        ios: Number(r.ios), android: Number(r.android), web: Number(r.web),
        total: Number(r.total),
      })),
    })
  })

  // ── GET /admin/analytics/content ────────────────────────────────────────
  app.get('/admin/analytics/content', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { period } = periodSchema.parse(request.query)
    const d = days(period)

    const [viewed, saved, booking, categories, cities, ctrRows] = await Promise.all([
      db.query<{ place_id: string; name: string; count: string }>(`
        SELECT ae.place_id, p.name, COUNT(*)::text AS count
          FROM analytics_events ae
          JOIN places p ON p.id = ae.place_id
         WHERE ae.event_name = 'place_view'
           AND ae.created_at >= now() - ($1 || ' days')::interval
         GROUP BY ae.place_id, p.name
         ORDER BY COUNT(*) DESC
         LIMIT 10
      `, [d]),

      db.query<{ place_id: string; name: string; count: string }>(`
        SELECT ae.place_id, p.name, COUNT(*)::text AS count
          FROM analytics_events ae
          JOIN places p ON p.id = ae.place_id
         WHERE ae.event_name = 'favorite_add'
           AND ae.created_at >= now() - ($1 || ' days')::interval
         GROUP BY ae.place_id, p.name
         ORDER BY COUNT(*) DESC
         LIMIT 10
      `, [d]),

      db.query<{ place_id: string; name: string; count: string }>(`
        SELECT ae.place_id, p.name, COUNT(*)::text AS count
          FROM analytics_events ae
          JOIN places p ON p.id = ae.place_id
         WHERE ae.event_name = 'booking_click'
           AND ae.created_at >= now() - ($1 || ' days')::interval
         GROUP BY ae.place_id, p.name
         ORDER BY COUNT(*) DESC
         LIMIT 10
      `, [d]),

      db.query<{ category: string; count: string }>(`
        SELECT category, COUNT(*)::text AS count
          FROM analytics_events
         WHERE category IS NOT NULL
           AND event_name IN ('place_view','place_open')
           AND created_at >= now() - ($1 || ' days')::interval
         GROUP BY category
         ORDER BY COUNT(*) DESC
         LIMIT 10
      `, [d]),

      db.query<{ city: string; count: string }>(`
        SELECT city, COUNT(*)::text AS count
          FROM analytics_events
         WHERE city IS NOT NULL
           AND event_name IN ('place_view','place_open','map_open')
           AND created_at >= now() - ($1 || ' days')::interval
         GROUP BY city
         ORDER BY COUNT(*) DESC
         LIMIT 10
      `, [d]),

      // Booking click-through rate per place = booking_click / place_view
      db.query<{ place_id: string; name: string; views: string; clicks: string; ctr: string }>(`
        SELECT p.id AS place_id, p.name,
               COUNT(*) FILTER (WHERE ae.event_name = 'place_view')::text    AS views,
               COUNT(*) FILTER (WHERE ae.event_name = 'booking_click')::text AS clicks,
               ROUND(
                 100.0 * COUNT(*) FILTER (WHERE ae.event_name = 'booking_click')::numeric
                 / NULLIF(COUNT(*) FILTER (WHERE ae.event_name = 'place_view'), 0),
                 2
               )::text AS ctr
          FROM analytics_events ae
          JOIN places p ON p.id = ae.place_id
         WHERE ae.created_at >= now() - ($1 || ' days')::interval
         GROUP BY p.id, p.name
        HAVING COUNT(*) FILTER (WHERE ae.event_name = 'place_view') >= 20
         ORDER BY ctr DESC NULLS LAST
         LIMIT 10
      `, [d]),
    ])

    return reply.send({
      period: d,
      mostViewed:    viewed.rows.map(r => ({ placeId: r.place_id, name: r.name, count: Number(r.count) })),
      mostSaved:     saved.rows.map(r => ({ placeId: r.place_id, name: r.name, count: Number(r.count) })),
      mostBooked:    booking.rows.map(r => ({ placeId: r.place_id, name: r.name, count: Number(r.count) })),
      topCategories: categories.rows.map(r => ({ slug: r.category, count: Number(r.count) })),
      topCities:     cities.rows.map(r => ({ slug: r.city, count: Number(r.count) })),
      topBookingCtr: ctrRows.rows.map(r => ({
        placeId: r.place_id, name: r.name,
        views: Number(r.views), clicks: Number(r.clicks),
        ctrPct: Number(r.ctr ?? 0),
      })),
    })
  })

  // ── GET /admin/analytics/features ───────────────────────────────────────
  app.get('/admin/analytics/features', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { period } = periodSchema.parse(request.query)
    const d = days(period)

    // Same session-fallback pattern: resolve user_id via the linked
    // user_sessions row when the event itself doesn't carry one.
    const { rows } = await db.query<{
      now_count: string; now_users: string
      concierge_count: string; concierge_users: string
      search_count: string; search_users: string
      route_starts: string; route_completes: string
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE ae.event_name='now_used')::text                                             AS now_count,
        COUNT(DISTINCT COALESCE(ae.user_id, s.user_id)) FILTER (WHERE ae.event_name='now_used')::text      AS now_users,
        COUNT(*) FILTER (WHERE ae.event_name='concierge_used')::text                                       AS concierge_count,
        COUNT(DISTINCT COALESCE(ae.user_id, s.user_id)) FILTER (WHERE ae.event_name='concierge_used')::text AS concierge_users,
        COUNT(*) FILTER (WHERE ae.event_name='search_query')::text                                         AS search_count,
        COUNT(DISTINCT COALESCE(ae.user_id, s.user_id)) FILTER (WHERE ae.event_name='search_query')::text  AS search_users,
        COUNT(*) FILTER (WHERE ae.event_name='route_start')::text                                          AS route_starts,
        COUNT(*) FILTER (WHERE ae.event_name='route_complete')::text                                       AS route_completes
        FROM analytics_events ae
        LEFT JOIN user_sessions s ON s.session_id = ae.session_id
       WHERE ae.created_at >= now() - ($1 || ' days')::interval
    `, [d])

    const r = rows[0] ?? {} as Record<string, string>
    return reply.send({
      period: d,
      now:       { count: Number(r.now_count ?? 0),       uniqueUsers: Number(r.now_users ?? 0) },
      concierge: { count: Number(r.concierge_count ?? 0), uniqueUsers: Number(r.concierge_users ?? 0) },
      search:    { count: Number(r.search_count ?? 0),    uniqueUsers: Number(r.search_users ?? 0) },
      routes:    {
        starts:    Number(r.route_starts ?? 0),
        completes: Number(r.route_completes ?? 0),
        completionRate: Number(r.route_starts ?? 0) > 0
          ? Number(((Number(r.route_completes ?? 0) / Number(r.route_starts ?? 1)) * 100).toFixed(1))
          : 0,
      },
    })
  })

  // ── GET /admin/analytics/search ─────────────────────────────────────────
  app.get('/admin/analytics/search', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { period } = periodSchema.parse(request.query)
    const d = days(period)

    const [top, zero, agg] = await Promise.all([
      db.query<{ query: string; count: string; avg_results: string }>(`
        SELECT lower(trim(query)) AS query,
               COUNT(*)::text AS count,
               ROUND(AVG(result_count), 1)::text AS avg_results
          FROM search_queries
         WHERE created_at >= now() - ($1 || ' days')::interval
           AND length(trim(query)) > 0
         GROUP BY lower(trim(query))
         ORDER BY COUNT(*) DESC
         LIMIT 20
      `, [d]),

      db.query<{ query: string; count: string }>(`
        SELECT lower(trim(query)) AS query, COUNT(*)::text AS count
          FROM search_queries
         WHERE created_at >= now() - ($1 || ' days')::interval
           AND result_count = 0
           AND length(trim(query)) > 0
         GROUP BY lower(trim(query))
         ORDER BY COUNT(*) DESC
         LIMIT 20
      `, [d]),

      db.query<{ total: string; avg_results: string | null }>(`
        SELECT COUNT(*)::text AS total,
               ROUND(AVG(result_count), 1)::text AS avg_results
          FROM search_queries
         WHERE created_at >= now() - ($1 || ' days')::interval
      `, [d]),
    ])

    return reply.send({
      period: d,
      totals: {
        count:      Number(agg.rows[0]?.total ?? 0),
        avgResults: Number(agg.rows[0]?.avg_results ?? 0),
      },
      topQueries:        top.rows.map(r => ({ query: r.query, count: Number(r.count), avgResults: Number(r.avg_results) })),
      zeroResultQueries: zero.rows.map(r => ({ query: r.query, count: Number(r.count) })),
    })
  })
}
