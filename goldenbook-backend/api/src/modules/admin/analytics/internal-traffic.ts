// Internal and QA traffic, excluded at read time.
//
// `is_internal` is stamped at write time from the `x-gb-internal` header, but
// only dev and TestFlight builds send it. Staff testing on a store build, and
// QA sessions that slipped through, land as real usage until someone re-runs
// src/scripts/flag-internal-traffic.ts (last run: 12 Sep 2026). So every
// analytics reader also excludes, at query time:
//
//   1. rows from a user whose email is in admin_users. public.users has no
//      email; ids are shared with auth.users, which does.
//   2. any session that ran a digits-only search ("111", "1111"), the same
//      QA marker the flag script uses. The whole session goes, not just the
//      search, because a test session is a test session end to end.
//   3. sessions already flagged is_internal, so an anonymous event whose
//      session was flagged after the fact is dropped too.
//
// Usage: prefix the query with `WITH ${internalTrafficCtes(since)}` and add
// `isRealEvent('ae')` / `isRealSession('s')` / `isRealSearch('q')` to the
// WHERE clause. Both CTEs are tiny (a handful of staff, a few hundred
// sessions) and MATERIALIZED, so the predicates plan as hash anti-joins.

/** The QA marker. Keep in sync with flag-internal-traffic.ts. */
export const DIGITS_ONLY_QUERY = String.raw`^[0-9[:space:]]+$`

const IDENT = /^[a-z_][a-z0-9_]*$/i

function alias(a: string): string {
  // Aliases are interpolated into SQL. They are always code constants, but
  // refuse anything that is not a bare identifier rather than trust that.
  if (!IDENT.test(a)) throw new Error(`invalid SQL alias: ${a}`)
  return a
}

/**
 * The two CTEs every predicate below depends on, without the leading WITH.
 *
 * `since` is an optional SQL expression (e.g. `now() - ($1 || ' days')::interval`)
 * that bounds how far back the session lookup scans. Leave it out for
 * all-history readers such as retention cohorts. A one-day margin covers
 * sessions that started just before the window and kept emitting into it.
 */
export function internalTrafficCtes(since?: string): string {
  const sessionWindow = since ? `AND s.started_at >= (${since}) - interval '1 day'` : ''
  const searchWindow = since ? `AND q.created_at >= (${since}) - interval '1 day'` : ''
  return `
  internal_users AS MATERIALIZED (
    SELECT au.id
      FROM auth.users au
      JOIN admin_users a ON lower(a.email) = lower(au.email)
  ),
  internal_sessions AS MATERIALIZED (
    SELECT s.session_id
      FROM user_sessions s
     WHERE (s.is_internal OR s.user_id IN (SELECT id FROM internal_users))
       ${sessionWindow}
    UNION
    SELECT q.session_id
      FROM search_queries q
     WHERE q.session_id IS NOT NULL
       AND q.query ~ '${DIGITS_ONLY_QUERY}'
       ${searchWindow}
  )`
}

function notStaff(col: string): string {
  return `NOT EXISTS (SELECT 1 FROM internal_users iu WHERE iu.id = ${col})`
}

function notQaSession(col: string): string {
  return `NOT EXISTS (SELECT 1 FROM internal_sessions isn WHERE isn.session_id = ${col})`
}

/**
 * For tables keyed only by user (push_tokens, push_sends): true unless the
 * row belongs to a staff account.
 */
export function isNotStaff(a: string, column = 'user_id'): string {
  return notStaff(`${alias(a)}.${alias(column)}`)
}

/** Real-traffic predicate for an analytics_events alias. */
export function isRealEvent(a: string): string {
  const t = alias(a)
  return `(NOT ${t}.is_internal AND ${notStaff(`${t}.user_id`)} AND ${notQaSession(`${t}.session_id`)})`
}

/** Real-traffic predicate for a user_sessions alias. */
export function isRealSession(a: string): string {
  const t = alias(a)
  return `(NOT ${t}.is_internal AND ${notStaff(`${t}.user_id`)} AND ${notQaSession(`${t}.session_id`)})`
}

/** Real-traffic predicate for a search_queries alias. */
export function isRealSearch(a: string): string {
  const t = alias(a)
  return `(NOT ${t}.is_internal AND ${t}.query !~ '${DIGITS_ONLY_QUERY}' AND ${notStaff(`${t}.user_id`)} AND ${notQaSession(`${t}.session_id`)})`
}

/**
 * Real-traffic predicate for the legacy place_analytics_events table, which
 * still carries the campaign checkout funnel. It has no is_internal column,
 * so only the staff and QA-session checks apply.
 */
export function isRealLegacyEvent(a: string): string {
  const t = alias(a)
  return `(${notStaff(`${t}.user_id`)} AND ${notQaSession(`${t}.session_id`)})`
}
