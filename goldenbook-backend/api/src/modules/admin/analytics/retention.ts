// Cohort math for the retention table.
//
// A cohort is everyone whose first real event fell in a given ISO week
// (Monday start). For each cohort we report the share who came back:
//
//   D1      on the calendar day after their first day
//   D1-7    on any of days 1..7 after it
//   D8-30   on any of days 8..30 after it
//
// A window is only reported once every member of the cohort has lived
// through it. The last member joined on the Sunday, so the cohort is mature
// for a window ending at day N once Sunday + N is in the past. Until then the
// share is null ("pending"), never a low number that is only low because the
// days have not happened yet.

export interface CohortCounts {
  /** Monday of the cohort week, YYYY-MM-DD. */
  week: string
  users: number
  d1: number
  d1to7: number
  d8to30: number
}

export interface CohortRow {
  week: string
  users: number
  d1Pct: number | null
  d1to7Pct: number | null
  d8to30Pct: number | null
}

/** Last day offset of each window, counted from the user's first day. */
export const RETENTION_WINDOWS = { d1: 1, d1to7: 7, d8to30: 30 } as const

const DAY_MS = 86_400_000

function utcDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

/**
 * True once the window ending `lastOffset` days after a user's first day has
 * fully elapsed for every member of the cohort starting on `weekStart`.
 * `today` is the current date (YYYY-MM-DD); today itself is not complete.
 */
export function windowComplete(weekStart: string, lastOffset: number, today: string): boolean {
  const lastJoin = utcDay(weekStart) + 6
  return lastJoin + lastOffset < utcDay(today)
}

/** Percentage with one decimal, or null when there is no denominator. */
export function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 1000) / 10
}

export function toCohortRows(counts: CohortCounts[], today: string): CohortRow[] {
  return counts.map((c) => {
    const share = (n: number, offset: number) =>
      windowComplete(c.week, offset, today) ? pct(n, c.users) : null
    return {
      week: c.week,
      users: c.users,
      d1Pct: share(c.d1, RETENTION_WINDOWS.d1),
      d1to7Pct: share(c.d1to7, RETENTION_WINDOWS.d1to7),
      d8to30Pct: share(c.d8to30, RETENTION_WINDOWS.d8to30),
    }
  })
}
