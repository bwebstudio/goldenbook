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
//   2. sessions already flagged is_internal, so an anonymous event whose
//      session was flagged after the fact is dropped too.
//
// Digits-only searches ("111", "1111") are NOT treated as QA sessions any
// more. They were assumed to be staff tests, but 1,200 distinct users ran one
// between April and October 2026, with the same retention, install hours and
// locale mix as everyone else: they are real users of an unexpected audience.
// Those queries are only kept out of search statistics (isRealSearch), since
// they say nothing about search quality.
//
// Task traffic (opt-in, `?audience=core`). About half of signed-in users ran
// a search for "day"/"today" (often quoted or in parentheses, i.e. copied
// from instructions) or a digits-only string within seconds of first opening
// the app: they look sent by reward / "paid task" apps. They are real people,
// so they stay in by default (`audience=all`); with excludeTaskUsers the
// internal_users CTE also takes every user_id with such a search, and since
// every predicate below already excludes internal_users, that is the whole
// filter. Their sessions fall into internal_sessions the same way.
//
// Usage: prefix the query with `WITH ${internalTrafficCtes(since, audience)}`
// and add `isRealEvent('ae')` / `isRealSession('s')` / `isRealSearch('q')` to
// the WHERE clause. Without task users both CTEs are small (a handful of
// staff and their sessions); all are MATERIALIZED, so the predicates plan as
// hash anti-joins.

import { z } from 'zod'

/** Digits-only queries: excluded from search statistics only. */
export const DIGITS_ONLY_QUERY = String.raw`^[0-9[:space:]]+$`

/** Task marker, matched against lower(query): day, today, (today), "days". */
export const TASK_DAY_QUERY = String.raw`^[^a-z0-9]*(to)?days?[^a-z0-9]*$`

/** Task marker, matched against the raw query: digits, spaces and dashes only. */
export const TASK_DIGITS_QUERY = String.raw`^[0-9[:space:]-]+$`

export interface TrafficOptions {
  /** Also treat task-app users (see header) as internal. */
  excludeTaskUsers?: boolean
}

/**
 * `?audience=all|core`. 'all' (the default, so older clients see unchanged
 * numbers) keeps task users in; 'core' leaves them out.
 */
export const audienceSchema = z.object({
  audience: z.enum(['all', 'core']).default('all'),
})

export function parseAudience(query: unknown): Required<TrafficOptions> {
  return { excludeTaskUsers: audienceSchema.parse(query ?? {}).audience === 'core' }
}

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
 *
 * `opts.excludeTaskUsers` adds task-app users to internal_users, over all
 * history (a user is one whenever they ran the marker search).
 */
export function internalTrafficCtes(since?: string, opts: TrafficOptions = {}): string {
  const sessionWindow = since ? `AND s.started_at >= (${since}) - interval '1 day'` : ''
  const taskUsers = opts.excludeTaskUsers
    ? `
    UNION
    SELECT sq.user_id
      FROM search_queries sq
     WHERE sq.user_id IS NOT NULL
       AND (lower(sq.query) ~ '${TASK_DAY_QUERY}' OR sq.query ~ '${TASK_DIGITS_QUERY}')`
    : ''
  return `
  internal_users AS MATERIALIZED (
    SELECT au.id
      FROM auth.users au
      JOIN admin_users a ON lower(a.email) = lower(au.email)${taskUsers}
  ),
  internal_sessions AS MATERIALIZED (
    SELECT s.session_id
      FROM user_sessions s
     WHERE (s.is_internal OR s.user_id IN (SELECT id FROM internal_users))
       ${sessionWindow}
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
