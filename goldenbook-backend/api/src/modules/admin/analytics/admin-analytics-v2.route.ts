// Admin analytics readers (v2) — user, content, feature, and search tabs
// for the dashboard. All aggregate over the unified analytics_events +
// user_sessions tables produced by the mobile app's track() helper.
//
// GET /api/v1/admin/analytics/users?period=7|30|90
// GET /api/v1/admin/analytics/content?period=7|30|90
// GET /api/v1/admin/analytics/features?period=7|30|90
// GET /api/v1/admin/analytics/search?period=7|30|90
//
// All endpoints require a dashboard admin session. Every query excludes
// internal and QA traffic through internal-traffic.ts, never by hand.
//
// Daily series bucket the rows once (range predicate on created_at, GROUP BY
// day) and then LEFT JOIN that onto generate_series, so empty days become
// zero-rows without a per-day join that defeats the created_at index.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../../db/postgres'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { internalTrafficCtes, isRealEvent, isRealSession, isRealSearch } from './internal-traffic'

const periodSchema = z.object({
  period: z.enum(['7', '30', '90']).default('30'),
})

function days(period: string): number { return parseInt(period, 10) }

/** Start of the selected window. $1 is always the period in days. */
const SINCE = `now() - ($1 || ' days')::interval`

/**
 * Sessions before this date had a broken ended_at (fixed in the 6 Aug 2026
 * release), so their durations are noise and stay out of the stats.
 */
export const DURATION_RELIABLE_FROM = '2026-08-06'

/** Weeks shown in the zero-result trend, independent of the period. */
const SEARCH_TREND_WEEKS = 12

/**
 * "Active" means the same thing in the headline and in the chart: a known
 * user with a real event that day (the user resolved through the session
 * row when the event's JWT was missing, typical of the first
 * app_session_start before login), or a real session that started or was
 * last seen that day. The session rows keep a warm resume visible even if
 * event ingestion briefly dropped.
 *
 * Expects internal_users/internal_sessions in scope and `since` as an SQL
 * expression bounding the scan.
 */
function activityCte(since: string): string {
  return `
  activity AS (
    SELECT COALESCE(ae.user_id, s.user_id) AS user_id, ae.created_at AS ts
      FROM analytics_events ae
      LEFT JOIN user_sessions s ON s.session_id = ae.session_id
     WHERE ae.created_at >= ${since}
       AND ${isRealEvent('ae')}
    UNION ALL
    SELECT us.user_id, x.ts
      FROM user_sessions us
     CROSS JOIN LATERAL (VALUES (us.started_at), (us.last_seen_at)) x(ts)
     WHERE us.user_id IS NOT NULL
       AND us.started_at >= ${since} - interval '1 day'
       AND x.ts >= ${since}
       AND ${isRealSession('us')}
  )`
}

export async function adminAnalyticsV2Routes(app: FastifyInstance) {

  // ── GET /admin/analytics/users ──────────────────────────────────────────
  app.get('/admin/analytics/users', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { period } = periodSchema.parse(request.query)
    const d = days(period)
    // WAU/MAU always need 30 days of activity, whatever the chart shows.
    const scanDays = Math.max(d, 30)

    const [dauRows, rolling, sessionsRows, durationAgg] = await Promise.all([
      // Daily active users. dauToday is the last row, so the headline and
      // the rightmost bar cannot disagree.
      db.query<{ date: string; dau: string }>(`
        WITH ${internalTrafficCtes(SINCE)},
        ${activityCte(`(now()::date - ($1::int))::timestamptz`)},
        per_day AS (
          SELECT ts::date AS day, COUNT(DISTINCT user_id) AS dau
            FROM activity
           WHERE user_id IS NOT NULL
           GROUP BY ts::date
        )
        SELECT g.day::date::text AS date, COALESCE(pd.dau, 0)::text AS dau
          FROM generate_series(now()::date - ($1::int), now()::date, interval '1 day') g(day)
          LEFT JOIN per_day pd ON pd.day = g.day::date
         ORDER BY g.day
      `, [d]),

      db.query<{ wau: string; mau: string; sessions_per_user: string | null }>(`
        WITH ${internalTrafficCtes(SINCE)},
        ${activityCte(`now() - interval '30 days'`)}
        SELECT
          COUNT(DISTINCT user_id) FILTER (WHERE ts >= now() - interval '7 days')::text AS wau,
          COUNT(DISTINCT user_id)::text AS mau,
          (SELECT (COUNT(*)::numeric / NULLIF(COUNT(DISTINCT s.user_id), 0))::text
             FROM user_sessions s
            WHERE s.user_id IS NOT NULL
              AND s.started_at >= now() - ($2 || ' days')::interval
              AND ${isRealSession('s')}) AS sessions_per_user
          FROM activity
      `, [scanDays, d]),

      db.query<{ date: string; ios: string; android: string; web: string; total: string }>(`
        WITH ${internalTrafficCtes(SINCE)},
        per_day AS (
          SELECT us.started_at::date AS day,
                 COUNT(*) FILTER (WHERE us.device_type = 'ios')     AS ios,
                 COUNT(*) FILTER (WHERE us.device_type = 'android') AS android,
                 COUNT(*) FILTER (WHERE us.device_type = 'web')     AS web,
                 COUNT(*) AS total
            FROM user_sessions us
           WHERE us.started_at >= now()::date - ($1::int)
             AND ${isRealSession('us')}
           GROUP BY us.started_at::date
        )
        SELECT g.day::date::text AS date,
               COALESCE(pd.ios, 0)::text     AS ios,
               COALESCE(pd.android, 0)::text AS android,
               COALESCE(pd.web, 0)::text     AS web,
               COALESCE(pd.total, 0)::text   AS total
          FROM generate_series(now()::date - ($1::int), now()::date, interval '1 day') g(day)
          LEFT JOIN per_day pd ON pd.day = g.day::date
         ORDER BY g.day
      `, [d]),

      // Session length. The mean is not reported: a session left in the
      // background inflates it by orders of magnitude (prod: median ~19s,
      // mean ~579s), so the median is the headline and p75/p90 the spread.
      db.query<{ n: string; p50: string | null; p75: string | null; p90: string | null }>(`
        WITH ${internalTrafficCtes(SINCE)}
        SELECT COUNT(*)::text AS n,
               PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY s.duration_sec)::text AS p50,
               PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY s.duration_sec)::text AS p75,
               PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY s.duration_sec)::text AS p90
          FROM user_sessions s
         WHERE s.ended_at IS NOT NULL
           AND s.duration_sec IS NOT NULL
           AND s.started_at >= GREATEST(${SINCE}, $2::timestamptz)
           AND ${isRealSession('s')}
      `, [d, DURATION_RELIABLE_FROM]),
    ])

    const dau = dauRows.rows.map(r => ({ date: r.date, dau: Number(r.dau) }))
    const dur = durationAgg.rows[0]

    return reply.send({
      period: d,
      kpis: {
        dauToday:        dau.at(-1)?.dau ?? 0,
        wau:             Number(rolling.rows[0]?.wau ?? 0),
        mau:             Number(rolling.rows[0]?.mau ?? 0),
        sessionsPerUser: Number(rolling.rows[0]?.sessions_per_user ?? 0),
        sessionP50Sec:   Number(dur?.p50 ?? 0),
        sessionP75Sec:   Number(dur?.p75 ?? 0),
        sessionP90Sec:   Number(dur?.p90 ?? 0),
        sessionsMeasured: Number(dur?.n ?? 0),
        durationSince:   DURATION_RELIABLE_FROM,
      },
      dau,
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

    // One pass over the window's place events; every list below is a
    // different cut of it.
    const { rows } = await db.query<{
      kind: string; key: string; name: string | null
      count: string; views: string | null; clicks: string | null
    }>(`
      WITH ${internalTrafficCtes(SINCE)},
      ev AS (
        SELECT ae.event_name, ae.place_id, ae.category, ae.city
          FROM analytics_events ae
         WHERE ae.created_at >= ${SINCE}
           AND ae.event_name IN ('place_view','favorite_add','booking_click','map_open')
           AND ${isRealEvent('ae')}
      ),
      per_place AS (
        SELECT place_id,
               COUNT(*) FILTER (WHERE event_name = 'place_view')    AS views,
               COUNT(*) FILTER (WHERE event_name = 'favorite_add')  AS saves,
               COUNT(*) FILTER (WHERE event_name = 'booking_click') AS bookings
          FROM ev
         WHERE place_id IS NOT NULL
         GROUP BY place_id
      ),
      ranked AS (
        SELECT 'viewed' AS kind, place_id, NULL::text AS label, views AS count,
               NULL::bigint AS v, NULL::bigint AS c,
               ROW_NUMBER() OVER (ORDER BY views DESC) AS rn
          FROM per_place WHERE views > 0
        UNION ALL
        SELECT 'saved', place_id, NULL, saves, NULL, NULL, ROW_NUMBER() OVER (ORDER BY saves DESC)
          FROM per_place WHERE saves > 0
        UNION ALL
        SELECT 'booked', place_id, NULL, bookings, NULL, NULL, ROW_NUMBER() OVER (ORDER BY bookings DESC)
          FROM per_place WHERE bookings > 0
        UNION ALL
        -- Booking click-through = booking_click / place_view, places with
        -- enough views for the ratio to mean something.
        SELECT 'ctr', place_id, NULL, 0, views, bookings,
               ROW_NUMBER() OVER (ORDER BY bookings::numeric / views DESC)
          FROM per_place WHERE views >= 20
        UNION ALL
        -- place_view only: place_open fires for the same tap just before.
        SELECT 'category', NULL, category, COUNT(*), NULL, NULL, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)
          FROM ev WHERE event_name = 'place_view' AND category IS NOT NULL
         GROUP BY category
        UNION ALL
        SELECT 'city', NULL, city, COUNT(*), NULL, NULL, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)
          FROM ev WHERE event_name IN ('place_view','map_open') AND city IS NOT NULL
         GROUP BY city
      )
      SELECT r.kind, COALESCE(r.place_id::text, r.label) AS key, p.name,
             r.count::text AS count, r.v::text AS views, r.c::text AS clicks
        FROM ranked r
        LEFT JOIN places p ON p.id = r.place_id
       WHERE r.rn <= 10
         AND (r.place_id IS NULL OR p.id IS NOT NULL)
       ORDER BY r.kind, r.rn
    `, [d])

    const pick = (kind: string) => rows.filter(r => r.kind === kind)
    const placeList = (kind: string) =>
      pick(kind).map(r => ({ placeId: r.key, name: r.name ?? '', count: Number(r.count) }))

    return reply.send({
      period: d,
      mostViewed:    placeList('viewed'),
      mostSaved:     placeList('saved'),
      mostBooked:    placeList('booked'),
      topCategories: pick('category').map(r => ({ slug: r.key, count: Number(r.count) })),
      topCities:     pick('city').map(r => ({ slug: r.key, count: Number(r.count) })),
      topBookingCtr: pick('ctr').map(r => {
        const views = Number(r.views ?? 0)
        const clicks = Number(r.clicks ?? 0)
        return {
          placeId: r.key, name: r.name ?? '', views, clicks,
          ctrPct: views > 0 ? Math.round((clicks / views) * 10000) / 100 : 0,
        }
      }),
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
      WITH ${internalTrafficCtes(SINCE)}
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
       WHERE ae.created_at >= ${SINCE}
         AND ae.event_name IN ('now_used','concierge_used','search_query','route_start','route_complete')
         AND ${isRealEvent('ae')}
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
  // Only live queries count: NOT superseded drops the keystrokes of a query
  // the user kept typing, so "lis" on the way to "lisboa" is not a miss.
  app.get('/admin/analytics/search', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { period } = periodSchema.parse(request.query)
    const d = days(period)

    const [top, zero, agg, trend] = await Promise.all([
      db.query<{ query: string; count: string; avg_results: string }>(`
        WITH ${internalTrafficCtes(SINCE)}
        SELECT lower(trim(q.query)) AS query,
               COUNT(*)::text AS count,
               ROUND(AVG(q.result_count), 1)::text AS avg_results
          FROM search_queries q
         WHERE q.created_at >= ${SINCE}
           AND NOT q.superseded
           AND ${isRealSearch('q')}
           AND length(trim(q.query)) > 0
         GROUP BY lower(trim(q.query))
         ORDER BY COUNT(*) DESC
         LIMIT 20
      `, [d]),

      db.query<{ query: string; count: string }>(`
        WITH ${internalTrafficCtes(SINCE)}
        SELECT lower(trim(q.query)) AS query, COUNT(*)::text AS count
          FROM search_queries q
         WHERE q.created_at >= ${SINCE}
           AND NOT q.superseded
           AND ${isRealSearch('q')}
           AND q.result_count = 0
           AND length(trim(q.query)) > 0
         GROUP BY lower(trim(q.query))
         ORDER BY COUNT(*) DESC
         LIMIT 20
      `, [d]),

      db.query<{ total: string; zero: string; avg_results: string | null }>(`
        WITH ${internalTrafficCtes(SINCE)}
        SELECT COUNT(*)::text AS total,
               COUNT(*) FILTER (WHERE q.result_count = 0)::text AS zero,
               ROUND(AVG(q.result_count), 1)::text AS avg_results
          FROM search_queries q
         WHERE q.created_at >= ${SINCE}
           AND NOT q.superseded
           AND ${isRealSearch('q')}
           AND length(trim(q.query)) > 0
      `, [d]),

      // Weekly zero-result rate over a fixed window, so a 7-day period still
      // shows whether content gaps are closing.
      db.query<{ week: string; total: string; zero: string }>(`
        WITH ${internalTrafficCtes(`date_trunc('week', now()) - ($1::int - 1) * interval '1 week'`)},
        per_week AS (
          SELECT date_trunc('week', q.created_at)::date AS week,
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE q.result_count = 0) AS zero
            FROM search_queries q
           WHERE q.created_at >= date_trunc('week', now()) - ($1::int - 1) * interval '1 week'
             AND NOT q.superseded
             AND ${isRealSearch('q')}
             AND length(trim(q.query)) > 0
           GROUP BY 1
        )
        SELECT g.week::date::text AS week,
               COALESCE(pw.total, 0)::text AS total,
               COALESCE(pw.zero, 0)::text  AS zero
          FROM generate_series(date_trunc('week', now()) - ($1::int - 1) * interval '1 week',
                               date_trunc('week', now()), interval '1 week') g(week)
          LEFT JOIN per_week pw ON pw.week = g.week::date
         ORDER BY g.week
      `, [SEARCH_TREND_WEEKS]),
    ])

    const total = Number(agg.rows[0]?.total ?? 0)
    const zeroCount = Number(agg.rows[0]?.zero ?? 0)
    const rate = (z: number, t: number) => (t > 0 ? Math.round((z / t) * 1000) / 10 : null)

    return reply.send({
      period: d,
      totals: {
        count:       total,
        avgResults:  Number(agg.rows[0]?.avg_results ?? 0),
        zeroResults: zeroCount,
        // null when there were no searches: "0%" would read as a success.
        zeroResultRatePct: rate(zeroCount, total),
      },
      zeroResultTrend: trend.rows.map(r => ({
        week: r.week,
        total: Number(r.total),
        zero: Number(r.zero),
        ratePct: rate(Number(r.zero), Number(r.total)),
      })),
      topQueries:        top.rows.map(r => ({ query: r.query, count: Number(r.count), avgResults: Number(r.avg_results) })),
      zeroResultQueries: zero.rows.map(r => ({ query: r.query, count: Number(r.count) })),
    })
  })
}
