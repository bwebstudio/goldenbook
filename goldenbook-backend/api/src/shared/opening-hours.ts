// ─── Opening hours: "is it open right now?" in one place ────────────────────
//
// Storage (see modules/admin/places/opening-hours.ts for the writer side):
//
//   opening_hours(place_id, day_of_week 0=Sunday..6, opens_at time,
//                 closes_at time, is_closed bool, slot_order int)
//
//   - one row per open interval
//   - an overnight interval (Fri 22:00-02:00) is stored on the day it OPENS
//     with closes_at < opens_at. Google writes "closes at midnight" the same
//     way: opens_at 20:00, closes_at 00:00.
//   - a place with no rows at all means "hours unknown"
//
// Before this module every caller compared `opens_at <= now < closes_at` on
// today's row only. That never matches an interval with closes_at <= opens_at,
// so on 9 Oct 2026 the 205 such rows in production (112 of them "until
// midnight") made those places look closed for the whole evening, and the
// 00:30 half of a Friday 22:00-02:00 bar was never found at all because it
// lives on Friday's row, not Saturday's.
//
// Semantics, implemented once in SQL and mirrored in TS (the TS copy is what
// the unit tests pin down; scripts compare both against production):
//
//   open now if
//     (a) today's row, opens <= now < closes                      (normal), or
//     (b) today's row, closes <= opens (overnight / until midnight),
//         and now >= opens, or
//     (c) yesterday's row is overnight (closes < opens) and now < closes.
//
//   closes_at 23:59 is the "24h" convention the editor uses (00:00-23:59), so
//   it counts as end of day too, otherwise the last minute of the day would
//   read as closed. Rows with is_closed = true or NULL times never open.
//
// "Now" is always the destination's wall clock, never the server's. Railway
// runs in UTC, which in summer is an hour off Portugal.

/** City slug → IANA timezone. Madeira shares Lisbon's offset (WET/WEST). */
export const CITY_TIMEZONES: Record<string, string> = {
  lisbon:    'Europe/Lisbon',
  lisboa:    'Europe/Lisbon',
  porto:     'Europe/Lisbon',
  algarve:   'Europe/Lisbon',
  madeira:   'Atlantic/Madeira',
  barcelona: 'Europe/Madrid',
  madrid:    'Europe/Madrid',
  paris:     'Europe/Paris',
  london:    'Europe/London',
  rome:      'Europe/Rome',
  milan:     'Europe/Rome',
  amsterdam: 'Europe/Amsterdam',
  berlin:    'Europe/Berlin',
}

export const DEFAULT_TIMEZONE = 'Europe/Lisbon'

export function cityTimezone(citySlug: string | null | undefined): string {
  return (citySlug && CITY_TIMEZONES[citySlug.toLowerCase()]) || DEFAULT_TIMEZONE
}

const TZ_RE = /^[A-Za-z]+(?:\/[A-Za-z_+-]+)+$/

/** Guard for interpolating a timezone into SQL text. */
export function assertTimezone(tz: string): string {
  if (!TZ_RE.test(tz)) throw new Error(`Invalid timezone: ${tz}`)
  return tz
}

// ─── Local clock ─────────────────────────────────────────────────────────────

export interface LocalClock {
  /** 0 = Sunday .. 6 = Saturday, in the destination. */
  dow: number
  hour: number
  minute: number
  /** Minutes since local midnight (0..1439). */
  minutes: number
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function localClock(tz: string, at: Date = new Date()): LocalClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  // Some ICU builds format midnight as "24".
  const hour = parseInt(get('hour'), 10) % 24
  const minute = parseInt(get('minute'), 10)
  return { dow: WEEKDAYS[get('weekday')] ?? at.getUTCDay(), hour, minute, minutes: hour * 60 + minute }
}

// ─── TS mirror ───────────────────────────────────────────────────────────────

export interface OpeningHoursRow {
  day_of_week: number
  opens_at: string | null
  closes_at: string | null
  is_closed: boolean
}

/** "HH:MM" or "HH:MM:SS" → minutes since midnight. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map((n) => parseInt(n, 10))
  return h * 60 + (m || 0)
}

const END_OF_DAY_2359 = 23 * 60 + 59

/** Whether one row covers (dow, minutes). */
export function rowIsOpenAt(row: OpeningHoursRow, dow: number, minutes: number): boolean {
  if (row.is_closed || !row.opens_at || !row.closes_at) return false
  const o = toMinutes(row.opens_at)
  const c = toMinutes(row.closes_at)
  const yesterday = (dow + 6) % 7
  if (row.day_of_week === dow && o <= minutes && (c > minutes || c <= o || c === END_OF_DAY_2359)) return true
  if (row.day_of_week === yesterday && c < o && minutes < c) return true
  return false
}

/**
 * Open at the given local day/time? null when the place holds no rows at all
 * (unknown), which callers keep treating as "do not exclude".
 */
export function isOpenAt(rows: readonly OpeningHoursRow[], dow: number, minutes: number): boolean | null {
  if (rows.length === 0) return null
  return rows.some((r) => rowIsOpenAt(r, dow, minutes))
}

/** Open right now in `tz`? null = unknown. */
export function isOpenNow(rows: readonly OpeningHoursRow[], tz: string, at: Date = new Date()): boolean | null {
  const { dow, minutes } = localClock(tz, at)
  return isOpenAt(rows, dow, minutes)
}

/**
 * Minutes from `nowMinutes` until an "HH:MM" closing time that belongs to a
 * slot open right now. Wraps past midnight (open until 02:00 at 23:30 is 150
 * minutes, until 00:00 at 23:30 is 30). A close a few minutes in the past is
 * the query racing the clock and reads as closed, not as "in 24h".
 */
export function minutesUntil(hhmm: string | null, nowMinutes: number): number | null {
  if (!hhmm) return null
  const close = toMinutes(hhmm)
  if (Number.isNaN(close) || Number.isNaN(nowMinutes)) return null
  let diff = close - nowMinutes
  if (diff < -5) diff += 24 * 60
  return diff > 0 ? diff : null
}

// ─── SQL ─────────────────────────────────────────────────────────────────────

/** Local wall-clock timestamp (no tz) for `tz`, as SQL. */
export function localNowSql(tz: string): string {
  return `(now() AT TIME ZONE '${assertTimezone(tz)}')`
}

/**
 * Boolean SQL: row `alias` of opening_hours is open at local timestamp
 * `localTs` (an expression of type timestamp without time zone, normally
 * localNowSql(tz)). Same rules as rowIsOpenAt.
 */
export function openingRowOpenSql(alias: string, localTs: string): string {
  const t = `(${localTs})::time`
  const d = `EXTRACT(DOW FROM ${localTs})::int`
  return `(
    ${alias}.is_closed = false
    AND ${alias}.opens_at IS NOT NULL AND ${alias}.closes_at IS NOT NULL
    AND (
      (${alias}.day_of_week = ${d}
        AND ${alias}.opens_at <= ${t}
        AND (${alias}.closes_at > ${t}
             OR ${alias}.closes_at <= ${alias}.opens_at
             OR ${alias}.closes_at = TIME '23:59'))
      OR
      (${alias}.day_of_week = (${d} + 6) % 7
        AND ${alias}.closes_at < ${alias}.opens_at
        AND ${t} < ${alias}.closes_at)
    )
  )`
}

/** Boolean SQL: place `placeIdExpr` has at least one row open at `localTs`. */
export function placeOpenSql(placeIdExpr: string, localTs: string): string {
  return `EXISTS (
    SELECT 1 FROM opening_hours oh_open
     WHERE oh_open.place_id = ${placeIdExpr}
       AND ${openingRowOpenSql('oh_open', localTs)}
  )`
}

/** Boolean SQL: open at `localTs`, or no hours on file (unknown → keep). */
export function placeOpenOrUnknownSql(placeIdExpr: string, localTs: string): string {
  return `(
    NOT EXISTS (SELECT 1 FROM opening_hours oh_any WHERE oh_any.place_id = ${placeIdExpr})
    OR ${placeOpenSql(placeIdExpr, localTs)}
  )`
}

/**
 * Text SQL: "HH:MM" closing time of the slot open at `localTs`, NULL when
 * none. For an overnight slot this is the early-morning time (02:00), and
 * "until midnight" reads 00:00. When two slots overlap, the one that runs
 * past midnight wins, then the latest close.
 */
export function closingTimeSql(placeIdExpr: string, localTs: string): string {
  return `(SELECT to_char(oh_close.closes_at, 'HH24:MI')
     FROM opening_hours oh_close
    WHERE oh_close.place_id = ${placeIdExpr}
      AND ${openingRowOpenSql('oh_close', localTs)}
    ORDER BY (oh_close.closes_at <= oh_close.opens_at OR oh_close.closes_at = TIME '23:59') DESC,
             oh_close.closes_at DESC
    LIMIT 1)`
}
