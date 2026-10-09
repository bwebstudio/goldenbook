import { describe, it, expect } from 'vitest'
import {
  DIGITS_ONLY_QUERY,
  TASK_DAY_QUERY,
  TASK_DIGITS_QUERY,
  internalTrafficCtes,
  parseAudience,
  isNotStaff,
  isRealEvent,
  isRealLegacyEvent,
  isRealSearch,
  isRealSession,
} from '../internal-traffic'

describe('internalTrafficCtes', () => {
  it('maps staff through auth.users by email, case-insensitively', () => {
    const sql = internalTrafficCtes()
    expect(sql).toContain('FROM auth.users au')
    expect(sql).toContain('lower(a.email) = lower(au.email)')
  })

  it('does not treat digits-only searches as QA sessions', () => {
    // 1,200 real users ran one between April and October 2026; they are an
    // audience, not staff tests. Only search statistics leave those queries out.
    expect(internalTrafficCtes()).not.toContain('search_queries')
    expect(isRealSearch('q')).toContain(`q.query !~ '${DIGITS_ONLY_QUERY}'`)
    // POSIX class: this is a Postgres regex, not a JS one.
    expect(DIGITS_ONLY_QUERY).toBe('^[0-9[:space:]]+$')
  })

  it('is unbounded without a window and bounded with one', () => {
    expect(internalTrafficCtes()).not.toContain('started_at >=')
    const sql = internalTrafficCtes(`now() - ($1 || ' days')::interval`)
    expect(sql).toContain(`s.started_at >= (now() - ($1 || ' days')::interval) - interval '1 day'`)
  })

  it('materializes both CTEs so each is computed once per query', () => {
    const sql = internalTrafficCtes()
    expect(sql).toContain('internal_users AS MATERIALIZED')
    expect(sql).toContain('internal_sessions AS MATERIALIZED')
  })
})

describe('task traffic', () => {
  it('stays in by default and with the flag off', () => {
    expect(internalTrafficCtes()).not.toContain('search_queries')
    expect(internalTrafficCtes(undefined, { excludeTaskUsers: false })).not.toContain('search_queries')
  })

  it('joins internal_users with both markers when the flag is on', () => {
    const sql = internalTrafficCtes(undefined, { excludeTaskUsers: true })
    expect(sql).toContain('UNION')
    expect(sql).toContain('FROM search_queries sq')
    expect(sql).toContain(`lower(sq.query) ~ '${TASK_DAY_QUERY}'`)
    expect(sql).toContain(`sq.query ~ '${TASK_DIGITS_QUERY}'`)
    // Both still inside internal_users, before internal_sessions.
    expect(sql.indexOf('search_queries')).toBeLessThan(sql.indexOf('internal_sessions'))
  })

  it('keeps the session window when the flag is on', () => {
    const sql = internalTrafficCtes(`now() - interval '7 days'`, { excludeTaskUsers: true })
    expect(sql).toContain(`s.started_at >= (now() - interval '7 days') - interval '1 day'`)
  })

  it('markers match what task apps paste, not real searches', () => {
    // JS regex stand-ins for the Postgres ones ([:space:] -> \s).
    const day = new RegExp(TASK_DAY_QUERY)
    const digits = new RegExp(TASK_DIGITS_QUERY.replace('[:space:]', '\\s'))
    for (const q of ['day', 'today', '"today"', '(day)', 'days', ' today. ']) expect(day.test(q)).toBe(true)
    for (const q of ['monday', 'today lisboa', 'day spa', 'holiday']) expect(day.test(q)).toBe(false)
    for (const q of ['111', '1 2 3', '12-34']) expect(digits.test(q)).toBe(true)
    for (const q of ['a1', '25 de abril']) expect(digits.test(q)).toBe(false)
  })

  it('parses ?audience, defaulting to all', () => {
    expect(parseAudience({})).toEqual({ excludeTaskUsers: false })
    expect(parseAudience(undefined)).toEqual({ excludeTaskUsers: false })
    expect(parseAudience({ audience: 'all', period: '7' })).toEqual({ excludeTaskUsers: false })
    expect(parseAudience({ audience: 'core' })).toEqual({ excludeTaskUsers: true })
    expect(() => parseAudience({ audience: 'everyone' })).toThrow()
  })
})

describe('real-traffic predicates', () => {
  it('events: flag, staff and QA session, on the given alias', () => {
    const p = isRealEvent('ae')
    expect(p).toContain('NOT ae.is_internal')
    expect(p).toContain('iu.id = ae.user_id')
    expect(p).toContain('isn.session_id = ae.session_id')
  })

  it('sessions use the same three checks', () => {
    const p = isRealSession('s')
    expect(p).toContain('NOT s.is_internal')
    expect(p).toContain('iu.id = s.user_id')
    expect(p).toContain('isn.session_id = s.session_id')
  })

  it('searches also drop the marker query itself', () => {
    expect(isRealSearch('q')).toContain(`q.query !~ '${DIGITS_ONLY_QUERY}'`)
  })

  it('legacy events have no is_internal column to read', () => {
    const p = isRealLegacyEvent('pae')
    expect(p).not.toContain('is_internal')
    expect(p).toContain('iu.id = pae.user_id')
  })

  it('staff-only check for user-keyed tables', () => {
    expect(isNotStaff('t')).toBe('NOT EXISTS (SELECT 1 FROM internal_users iu WHERE iu.id = t.user_id)')
  })

  it('wraps each predicate in parentheses so it composes with OR', () => {
    for (const p of [isRealEvent('a'), isRealSession('a'), isRealSearch('a'), isRealLegacyEvent('a')]) {
      expect(p.startsWith('(') && p.endsWith(')')).toBe(true)
    }
  })

  it('refuses anything that is not a bare SQL identifier', () => {
    expect(() => isRealEvent('ae; DROP TABLE x')).toThrow()
    expect(() => isRealSession('s.user_id')).toThrow()
    expect(() => isNotStaff('t', 'user_id OR true')).toThrow()
  })
})
