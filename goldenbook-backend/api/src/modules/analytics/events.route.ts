// Unified analytics ingest.
//
// POST /api/v1/analytics/events          — fire-and-forget event ingest
// POST /api/v1/analytics/sessions/start  — create/refresh a user_sessions row
// POST /api/v1/analytics/sessions/ping   — heartbeat updates last_seen_at
// POST /api/v1/analytics/sessions/end    — stamps ended_at, freezes duration
//
// All endpoints are auth-optional: if a valid Bearer token is present the
// decoded user id is attached server-side, otherwise only the session id is
// trusted. The client never sends user_id/device/app_version as payload —
// those come from headers (`x-session-id`, `x-app-version`, `x-device-type`)
// and the JWT, to prevent clients from spoofing context.
//
// Rate limit: 100 events / minute / session (or IP when unauthenticated).

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/postgres'
import { verifySupabaseToken } from '../../shared/auth/verifySupabaseToken'

const EVENT_NAMES = [
  'app_session_start','app_session_end',
  'place_view','place_open','map_open',
  'website_click','booking_click',
  'favorite_add','favorite_remove',
  'search_query','search_result_click',
  'now_used','concierge_used',
  'route_start','route_complete',
] as const

const EventSchema = z.object({
  event:       z.enum(EVENT_NAMES),
  placeId:     z.string().uuid().optional(),
  routeId:     z.string().uuid().optional(),
  category:    z.string().max(100).optional(),
  source:      z.string().max(32).optional(),
  // The client MAY pass city/locale as a hint; server still prefers its own
  // sources (headers / JWT / session row) when resolving the final value.
  city:        z.string().max(64).optional(),
  locale:      z.string().max(8).optional(),
  metadata:    z.record(z.unknown()).optional(),
})

const StartSchema = z.object({
  sessionId:   z.string().min(4).max(64),
  locale:      z.string().max(8).optional(),
  city:        z.string().max(64).optional(),
  appVersion:  z.string().max(32).optional(),
  deviceType:  z.enum(['ios', 'android', 'web']).optional(),
})

const PingSchema = z.object({ sessionId: z.string().min(4).max(64) })
const EndSchema  = z.object({ sessionId: z.string().min(4).max(64) })

// Shortest query the search API will answer. Anything below this never hits
// the index, so recording it would only fabricate zero-result rows. Keep in
// sync with MIN_SEARCH_LEN in the mobile search screen.
const MIN_QUERY_LEN = 3

// ─── In-memory rate limiter ────────────────────────────────────────────────
const limiter = new Map<string, { count: number; resetAt: number }>()
function ratePass(key: string, max = 100): boolean {
  const now = Date.now()
  const cur = limiter.get(key)
  if (!cur || cur.resetAt < now) {
    limiter.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (cur.count >= max) return false
  cur.count++
  return true
}
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of limiter) if (v.resetAt < now) limiter.delete(k)
}, 5 * 60_000)

// ─── Optional auth: reads Bearer token but never throws ─────────────────
async function tryReadUserId(request: FastifyRequest): Promise<string | null> {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const payload = await verifySupabaseToken(auth.slice(7))
    return payload.sub ?? null
  } catch {
    return null
  }
}

function headerStr(request: FastifyRequest, name: string): string | null {
  const v = request.headers[name]
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

// Dev and TestFlight builds send `x-gb-internal: 1`. Store builds never do.
// Rows flagged this way are excluded from every admin reader, so QA sessions
// stop inflating DAU, retention and the search reports.
function isInternalTraffic(request: FastifyRequest): boolean {
  return headerStr(request, 'x-gb-internal') === '1'
}

// Analytics writes are fire-and-forget by design: the caller gets its 204
// immediately and a failed insert must never surface in the app. But
// swallowing the error entirely is what let a foreign-key violation drop
// every route event for 107 days without a trace. Log instead.
function fireAndForget(
  request: FastifyRequest,
  what: string,
  promise: Promise<unknown>,
): void {
  promise.catch((err) => {
    request.log.error({ err, what }, '[analytics] write failed')
  })
}

// ─── Routes ────────────────────────────────────────────────────────────────

export async function analyticsEventsRoutes(app: FastifyInstance) {

  // POST /analytics/sessions/start
  app.post('/analytics/sessions/start', async (request, reply) => {
    const parsed = StartSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(204).send()
    const { sessionId, locale, city, appVersion, deviceType } = parsed.data

    const userId = await tryReadUserId(request)

    // Upsert — repeated starts are idempotent, and a start on an already-closed
    // session REOPENS it (`ended_at = NULL`). That last part is the fix for the
    // frozen-duration bug: the client sends a start on every foreground, so a
    // session the user comes back to resumes accumulating instead of staying
    // stamped with the moment it first lost focus. `duration_sec` is generated
    // from ended_at - started_at, so the final close yields the true span.
    fireAndForget(request, 'sessions/start', db.query(
      `INSERT INTO user_sessions (
         session_id, user_id, started_at, locale, city, app_version, device_type,
         last_seen_at, is_internal
       ) VALUES ($1, $2, now(), $3, $4, $5, $6, now(), $7)
       ON CONFLICT (session_id) DO UPDATE SET
         user_id      = COALESCE(user_sessions.user_id, EXCLUDED.user_id),
         locale       = COALESCE(EXCLUDED.locale, user_sessions.locale),
         city         = COALESCE(EXCLUDED.city,   user_sessions.city),
         app_version  = COALESCE(EXCLUDED.app_version, user_sessions.app_version),
         device_type  = COALESCE(EXCLUDED.device_type, user_sessions.device_type),
         is_internal  = user_sessions.is_internal OR EXCLUDED.is_internal,
         ended_at     = NULL,
         last_seen_at = now()`,
      [sessionId, userId, locale ?? null, city ?? null, appVersion ?? null,
       deviceType ?? null, isInternalTraffic(request)],
    ))

    return reply.status(204).send()
  })

  // POST /analytics/sessions/ping  — keep last_seen_at fresh
  app.post('/analytics/sessions/ping', async (request, reply) => {
    const parsed = PingSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(204).send()
    fireAndForget(request, 'sessions/ping', db.query(
      `UPDATE user_sessions SET last_seen_at = now() WHERE session_id = $1`,
      [parsed.data.sessionId],
    ))
    return reply.status(204).send()
  })

  // POST /analytics/sessions/end
  app.post('/analytics/sessions/end', async (request, reply) => {
    const parsed = EndSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(204).send()
    // Always stamp `now()`. The old COALESCE kept the first close forever, so
    // a session reopened on foreground could never record its real end. The
    // start handler clears `ended_at`, so the last close before the app is
    // gone for good is the one that sticks.
    fireAndForget(request, 'sessions/end', db.query(
      `UPDATE user_sessions
          SET ended_at = now(),
              last_seen_at = now()
        WHERE session_id = $1`,
      [parsed.data.sessionId],
    ))
    return reply.status(204).send()
  })

  // POST /analytics/events
  app.post('/analytics/events', async (request, reply) => {
    const parsed = EventSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(204).send()
    const p = parsed.data

    const sessionId = headerStr(request, 'x-session-id')
    const rateKey   = sessionId ?? request.ip ?? 'unknown'
    if (!ratePass(rateKey)) return reply.status(204).send()

    const userId      = await tryReadUserId(request)
    const appVersion  = headerStr(request, 'x-app-version')
    const deviceType  = headerStr(request, 'x-device-type')

    // Server-side enrichment: if the session row exists, prefer its values for
    // city/locale/app_version/device. The client's payload is a hint only.
    let enriched = {
      city: p.city ?? null,
      locale: p.locale ?? null,
      app_version: appVersion,
      device: deviceType,
    }
    if (sessionId) {
      const { rows } = await db.query<{
        city: string | null; locale: string | null
        app_version: string | null; device_type: string | null
      }>(
        `SELECT city, locale, app_version, device_type
           FROM user_sessions WHERE session_id = $1 LIMIT 1`,
        [sessionId],
      ).catch(() => ({ rows: [] as never[] }))
      const s = rows[0]
      if (s) {
        enriched = {
          city:        enriched.city        ?? s.city,
          locale:      enriched.locale      ?? s.locale,
          app_version: enriched.app_version ?? s.app_version,
          device:      enriched.device      ?? s.device_type,
        }
      }
    }

    // Resolve category from the place row when not supplied — saves a client
    // round-trip and keeps top-categories reports accurate.
    let category: string | null = p.category ?? null
    if (!category && p.placeId) {
      const { rows } = await db.query<{ slug: string }>(
        `SELECT c.slug
           FROM place_categories pc
           JOIN categories c ON c.id = pc.category_id
          WHERE pc.place_id = $1 AND pc.is_primary = true
          LIMIT 1`,
        [p.placeId],
      ).catch(() => ({ rows: [] as never[] }))
      category = rows[0]?.slug ?? null
    }

    const internal = isInternalTraffic(request)

    fireAndForget(request, `events/${p.event}`, db.query(
      `INSERT INTO analytics_events (
         event_name, user_id, session_id, place_id, route_id,
         category, city, locale, device, app_version, source, metadata,
         is_internal, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())`,
      [
        p.event, userId, sessionId,
        p.placeId ?? null, p.routeId ?? null,
        category, enriched.city, enriched.locale,
        enriched.device, enriched.app_version, p.source ?? null,
        p.metadata ? JSON.stringify(p.metadata) : '{}',
        internal,
      ],
    ))

    // Side-effect: search_query events also land in search_queries so
    // the dashboard can answer "zero-result queries" without scanning JSON.
    //
    // The client now sends one event per query the user actually finished,
    // with the result count read after the response resolved. When a query
    // refines an earlier one ("algar" → "algarve"), it carries `supersedes`
    // so we retire the shorter row rather than letting keystrokes pile up in
    // the report. Anything under MIN_QUERY_LEN never reaches the search API,
    // so logging it would only manufacture zero-result rows.
    if (p.event === 'search_query' && typeof p.metadata?.query === 'string') {
      const q = String(p.metadata.query).trim().slice(0, 160)
      const resultCount = Number(p.metadata?.result_count ?? 0) | 0
      const supersedes = typeof p.metadata?.supersedes === 'string'
        ? String(p.metadata.supersedes).trim().slice(0, 160)
        : null

      if (q.length >= MIN_QUERY_LEN) {
        if (supersedes && sessionId) {
          fireAndForget(request, 'search/supersede', db.query(
            `UPDATE search_queries
                SET superseded = true
              WHERE session_id = $1
                AND lower(query) = lower($2)
                AND created_at >= now() - interval '5 minutes'`,
            [sessionId, supersedes],
          ))
        }
        fireAndForget(request, 'search/insert', db.query(
          `INSERT INTO search_queries (
             user_id, session_id, query, result_count, city, locale, is_internal
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [userId, sessionId, q, resultCount, enriched.city, enriched.locale, internal],
        ))
      }
    }

    return reply.status(204).send()
  })
}

// ─── Cron: close stale sessions ────────────────────────────────────────────
// Called from app.ts on an interval. Any session whose last_seen_at is older
// than 30 minutes and that hasn't been explicitly ended is force-closed so
// avg-session-duration metrics aren't polluted by force-quit apps.
export async function closeStaleSessions(): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE user_sessions
        SET ended_at = last_seen_at
      WHERE ended_at IS NULL
        AND last_seen_at < now() - interval '30 minutes'`,
  )
  return rowCount ?? 0
}
