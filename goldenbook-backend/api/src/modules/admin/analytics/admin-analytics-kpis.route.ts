// Admin KPIs that sit beside the v2 tabs: retention, the 18:00 push ritual,
// place-open attribution, and the catalogue counts for the dashboard home.
//
// GET /api/v1/admin/analytics/retention
// GET /api/v1/admin/analytics/push?period=7|30|90
// GET /api/v1/admin/analytics/attribution?period=7|30|90
// GET /api/v1/admin/analytics/place-counts
//
// All require a dashboard admin session and exclude internal and QA traffic
// through internal-traffic.ts. Errors propagate: the dashboard has to be able
// to tell "couldn't load" from "nothing happened".

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../../db/postgres'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { internalTrafficCtes, isNotStaff, isRealEvent } from './internal-traffic'
import { toCohortRows, RETENTION_WINDOWS } from './retention'

const periodSchema = z.object({
  period: z.enum(['7', '30', '90']).default('30'),
})

const SINCE = `now() - ($1 || ' days')::interval`

/** Weekly cohorts shown, current week included. */
const RETENTION_WEEKS = 12

export async function adminAnalyticsKpisRoutes(app: FastifyInstance) {

  // ── GET /admin/analytics/retention ──────────────────────────────────────
  // Weekly cohorts by first real event. Identity is analytics_events.user_id:
  // anonymous traffic cannot be followed across days, so it is not a cohort.
  // First activity is taken over all history, otherwise a returning user
  // would be counted as new at the start of the window.
  app.get('/admin/analytics/retention', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    const { rows } = await db.query<{
      week: string; users: string; d1: string; d1to7: string; d8to30: string; today: string
    }>(`
      WITH ${internalTrafficCtes()},
      active_days AS (
        SELECT ae.user_id, ae.created_at::date AS day
          FROM analytics_events ae
         WHERE ae.user_id IS NOT NULL
           AND ${isRealEvent('ae')}
         GROUP BY 1, 2
      ),
      firsts AS (
        SELECT user_id, MIN(day) AS first_day FROM active_days GROUP BY user_id
      ),
      cohort AS (
        SELECT user_id, first_day, date_trunc('week', first_day)::date AS week
          FROM firsts
         WHERE first_day >= date_trunc('week', current_date)::date - 7 * ($1::int - 1)
      ),
      returns AS (
        SELECT c.week, c.user_id,
               bool_or(a.day - c.first_day = $2)                  AS d1,
               bool_or(a.day - c.first_day BETWEEN 1 AND $3)      AS d1to7,
               bool_or(a.day - c.first_day BETWEEN $3 + 1 AND $4) AS d8to30
          FROM cohort c
          JOIN active_days a ON a.user_id = c.user_id
         GROUP BY c.week, c.user_id
      )
      SELECT g.week::date::text AS week,
             COUNT(r.user_id)::text                 AS users,
             COUNT(*) FILTER (WHERE r.d1)::text     AS d1,
             COUNT(*) FILTER (WHERE r.d1to7)::text  AS d1to7,
             COUNT(*) FILTER (WHERE r.d8to30)::text AS d8to30,
             current_date::text                     AS today
        FROM generate_series(date_trunc('week', current_date) - ($1::int - 1) * interval '1 week',
                             date_trunc('week', current_date), interval '1 week') g(week)
        LEFT JOIN returns r ON r.week = g.week::date
       GROUP BY g.week
       ORDER BY g.week
    `, [RETENTION_WEEKS, RETENTION_WINDOWS.d1, RETENTION_WINDOWS.d1to7, RETENTION_WINDOWS.d8to30])

    const today = rows[0]?.today ?? new Date().toISOString().slice(0, 10)
    return reply.send({
      weeks: RETENTION_WEEKS,
      cohorts: toCohortRows(rows.map(r => ({
        week: r.week,
        users: Number(r.users),
        d1: Number(r.d1),
        d1to7: Number(r.d1to7),
        d8to30: Number(r.d8to30),
      })), today),
    })
  })

  // ── GET /admin/analytics/push ───────────────────────────────────────────
  // The daily 18:00 ritual (push.service.ts). Devices come from push_tokens;
  // each delivery is a push_sends row, and opened_at is stamped by
  // POST /me/push/opened within 48h of the send. Staff devices are left out.
  app.get('/admin/analytics/push', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { period } = periodSchema.parse(request.query)
    const d = parseInt(period, 10)

    const [devices, tokenState, daily] = await Promise.all([
      db.query<{ platform: string | null; city: string | null; count: string }>(`
        WITH ${internalTrafficCtes()}
        SELECT t.device_type AS platform, t.city_slug AS city, COUNT(*)::text AS count
          FROM push_tokens t
         WHERE t.is_active
           AND ${isNotStaff('t')}
         GROUP BY 1, 2
      `),

      db.query<{ active: string; inactive: string; backoff: string }>(`
        WITH ${internalTrafficCtes()}
        SELECT COUNT(*) FILTER (WHERE t.is_active)::text                            AS active,
               COUNT(*) FILTER (WHERE NOT t.is_active)::text                        AS inactive,
               COUNT(*) FILTER (WHERE t.is_active AND t.unopened_streak >= 3)::text AS backoff
          FROM push_tokens t
         WHERE ${isNotStaff('t')}
      `),

      db.query<{ date: string; sent: string; opened: string }>(`
        WITH ${internalTrafficCtes()},
        per_day AS (
          SELECT s.sent_on AS day,
                 COUNT(*) AS sent,
                 COUNT(*) FILTER (WHERE s.opened_at IS NOT NULL) AS opened
            FROM push_sends s
           WHERE s.sent_on >= current_date - $1::int
             AND ${isNotStaff('s')}
           GROUP BY s.sent_on
        )
        SELECT g.day::date::text AS date,
               COALESCE(pd.sent, 0)::text   AS sent,
               COALESCE(pd.opened, 0)::text AS opened
          FROM generate_series(current_date - $1::int, current_date, interval '1 day') g(day)
          LEFT JOIN per_day pd ON pd.day = g.day::date
         ORDER BY g.day
      `, [d]),
    ])

    const tally = (key: 'platform' | 'city') => {
      const m = new Map<string | null, number>()
      for (const r of devices.rows) m.set(r[key], (m.get(r[key]) ?? 0) + Number(r.count))
      return [...m.entries()]
        .map(([k, count]) => ({ key: k, count }))
        .sort((a, b) => b.count - a.count)
    }

    const series = daily.rows.map(r => ({ date: r.date, sent: Number(r.sent), opened: Number(r.opened) }))
    const sent = series.reduce((s, r) => s + r.sent, 0)
    const opened = series.reduce((s, r) => s + r.opened, 0)
    const state = tokenState.rows[0]

    return reply.send({
      period: d,
      devices: {
        active:   Number(state?.active ?? 0),
        inactive: Number(state?.inactive ?? 0),
        inBackoff: Number(state?.backoff ?? 0),
        // key null = the app did not report it (older registrations).
        byPlatform: tally('platform').map(r => ({ platform: r.key, count: r.count })),
        byCity:     tally('city').map(r => ({ city: r.key, count: r.count })),
      },
      totals: {
        sent,
        opened,
        openRatePct: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : null,
      },
      daily: series,
    })
  })

  // ── GET /admin/analytics/attribution ────────────────────────────────────
  // Where place opens come from, and which categories get opened and saved.
  // place_view is the open: it fires once per detail screen, whatever led
  // there (place_open only covers in-app taps, and precedes the same view).
  // App 1.2.0 started sending `source`; older builds send null, reported as
  // its own bucket rather than hidden.
  app.get('/admin/analytics/attribution', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { period } = periodSchema.parse(request.query)
    const d = parseInt(period, 10)

    const [sources, categories] = await Promise.all([
      db.query<{ source: string | null; count: string }>(`
        WITH ${internalTrafficCtes(SINCE)}
        SELECT ae.source, COUNT(*)::text AS count
          FROM analytics_events ae
         WHERE ae.event_name = 'place_view'
           AND ae.created_at >= ${SINCE}
           AND ${isRealEvent('ae')}
         GROUP BY ae.source
         ORDER BY COUNT(*) DESC
      `, [d]),

      db.query<{ category: string | null; opens: string; saves: string }>(`
        WITH ${internalTrafficCtes(SINCE)}
        SELECT ae.category,
               COUNT(*) FILTER (WHERE ae.event_name = 'place_view')::text   AS opens,
               COUNT(*) FILTER (WHERE ae.event_name = 'favorite_add')::text AS saves
          FROM analytics_events ae
         WHERE ae.event_name IN ('place_view', 'favorite_add')
           AND ae.created_at >= ${SINCE}
           AND ${isRealEvent('ae')}
         GROUP BY ae.category
         ORDER BY COUNT(*) FILTER (WHERE ae.event_name = 'place_view') DESC,
                  COUNT(*) FILTER (WHERE ae.event_name = 'favorite_add') DESC
         LIMIT 12
      `, [d]),
    ])

    const opens = sources.rows.map(r => ({ source: r.source, count: Number(r.count) }))
    const total = opens.reduce((s, r) => s + r.count, 0)
    const attributed = opens.filter(r => r.source !== null).reduce((s, r) => s + r.count, 0)

    return reply.send({
      period: d,
      totalOpens: total,
      attributedOpens: attributed,
      opensBySource: opens,
      topCategories: categories.rows.map(r => ({
        category: r.category, opens: Number(r.opens), saves: Number(r.saves),
      })),
    })
  })

  // ── GET /admin/analytics/place-counts ───────────────────────────────────
  // Catalogue size for the dashboard home. Counts every place by status,
  // with or without coordinates: /map/places is a capped, published-only map
  // feed and was never a count.
  app.get('/admin/analytics/place-counts', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    const [cities, totals] = await Promise.all([
      db.query<{ slug: string; name: string; published: string; draft: string; archived: string; total: string }>(`
        SELECT d.slug, d.name,
               COUNT(p.id) FILTER (WHERE p.status = 'published')::text AS published,
               COUNT(p.id) FILTER (WHERE p.status = 'draft')::text     AS draft,
               COUNT(p.id) FILTER (WHERE p.status = 'archived')::text  AS archived,
               COUNT(p.id)::text                                       AS total
          FROM destinations d
          LEFT JOIN places p ON p.destination_id = d.id
         GROUP BY d.id, d.slug, d.name, d.is_active
        HAVING d.is_active OR COUNT(p.id) > 0
         ORDER BY COUNT(p.id) FILTER (WHERE p.status = 'published') DESC, d.slug
      `),
      // Straight off places, so a place without a destination still counts.
      db.query<{ published: string; draft: string; archived: string; total: string }>(`
        SELECT COUNT(*) FILTER (WHERE status = 'published')::text AS published,
               COUNT(*) FILTER (WHERE status = 'draft')::text     AS draft,
               COUNT(*) FILTER (WHERE status = 'archived')::text  AS archived,
               COUNT(*)::text                                     AS total
          FROM places
      `),
    ])

    const t = totals.rows[0]
    return reply.send({
      totals: {
        published: Number(t?.published ?? 0),
        draft:     Number(t?.draft ?? 0),
        archived:  Number(t?.archived ?? 0),
        total:     Number(t?.total ?? 0),
      },
      cities: cities.rows.map(r => ({
        slug: r.slug,
        name: r.name,
        published: Number(r.published),
        draft:     Number(r.draft),
        archived:  Number(r.archived),
        total:     Number(r.total),
      })),
    })
  })
}
