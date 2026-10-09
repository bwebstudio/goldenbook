// ─── Opening hours: editor model <-> API ────────────────────────────────────
//
// The API returns hours as flat rows (one per day x interval, a closed day as
// a single `isClosed` row, times as "HH:MM:SS"). The editor works on one entry
// per weekday and submits that shape back (see the API's opening-hours.ts).
//
// Overnight intervals (22:00 to 02:00) live on the day they open with
// closes < opens, the same way Google-imported rows are stored.

export interface OpeningInterval {
  opens: string;  // "HH:MM"
  closes: string; // "HH:MM"
}

export interface OpeningDay {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  closed: boolean;
  intervals: OpeningInterval[];
}

/** Flat row as returned by the place detail endpoint. */
export interface OpeningHourRow {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

/** Display order Monday to Sunday, matching the app. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_INTERVAL: OpeningInterval = { opens: "09:00", closes: "18:00" };

function hhmm(t: string | null): string {
  return (t ?? "").slice(0, 5);
}

/** A week with every day closed and no intervals: the "no hours" state. */
export function emptyWeek(): OpeningDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, closed: true, intervals: [] }));
}

/**
 * Rows from the API -> one entry per weekday (0..6). A day without any row is
 * closed, which is how the app renders it too.
 */
export function rowsToWeek(rows: readonly OpeningHourRow[]): OpeningDay[] {
  const week = emptyWeek();
  for (const row of rows) {
    const day = week[row.dayOfWeek];
    if (!day || row.isClosed || !row.opensAt || !row.closesAt) continue;
    day.closed = false;
    day.intervals.push({ opens: hhmm(row.opensAt), closes: hhmm(row.closesAt) });
  }
  for (const day of week) day.intervals.sort((a, b) => a.opens.localeCompare(b.opens));
  return week;
}

/**
 * Google preview periods -> week. Days Google does not list are closed (Google
 * omits closed days). A single 00:00 to 23:59 period is Google's "open 24
 * hours", which the backfill script also expands to every day.
 */
export function googlePeriodsToWeek(
  periods: ReadonlyArray<{ dayOfWeek: number; opensAt: string; closesAt: string }>,
): OpeningDay[] {
  if (periods.length === 1 && periods[0].opensAt === "00:00" && periods[0].closesAt === "23:59") {
    return [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      closed: false,
      intervals: [{ opens: "00:00", closes: "23:59" }],
    }));
  }
  return rowsToWeek(periods.map((p) => ({ ...p, isClosed: false })));
}

export type OpeningDayProblem = "invalid-time" | "same-time" | "overlap" | "no-intervals";

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Mirrors the API's `validateOpeningWeek` for one day so the editor sees the
 * problem next to the day instead of a failed save.
 */
export function validateOpeningDay(day: OpeningDay): OpeningDayProblem | null {
  if (day.closed) return null;
  if (day.intervals.length === 0) return "no-intervals";
  if (day.intervals.some((iv) => !TIME_RE.test(iv.opens) || !TIME_RE.test(iv.closes))) return "invalid-time";
  const spans = day.intervals.map((iv) => {
    const start = toMinutes(iv.opens);
    let end = toMinutes(iv.closes);
    if (end < start) end += 24 * 60;
    return { start, end };
  });
  if (spans.some((s) => s.start === s.end)) return "same-time";
  spans.sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].start < spans[i - 1].end) return "overlap";
  }
  return null;
}

export function isOvernight(iv: OpeningInterval): boolean {
  return TIME_RE.test(iv.opens) && TIME_RE.test(iv.closes) && toMinutes(iv.closes) < toMinutes(iv.opens);
}

/** True when no day is open: saving this means "hours unknown" (no rows). */
export function isWeekEmpty(week: readonly OpeningDay[]): boolean {
  return week.every((d) => d.closed || d.intervals.length === 0);
}

/**
 * Week -> API payload. An all-closed week is sent as [] so the place goes back
 * to "hours unknown" rather than "closed every day", which would hide it from
 * NOW for good.
 */
export function weekToPayload(week: readonly OpeningDay[]): OpeningDay[] {
  if (isWeekEmpty(week)) return [];
  return week.map((d) => ({
    dayOfWeek: d.dayOfWeek,
    closed: d.closed || d.intervals.length === 0,
    intervals: d.closed ? [] : d.intervals.map((iv) => ({ opens: iv.opens, closes: iv.closes })),
  }));
}

/** Copy one day's schedule onto every day of the week. */
export function copyDayToAll(week: readonly OpeningDay[], fromDay: number): OpeningDay[] {
  const source = week.find((d) => d.dayOfWeek === fromDay);
  if (!source) return week.map((d) => ({ ...d, intervals: [...d.intervals] }));
  return week.map((d) => ({
    dayOfWeek: d.dayOfWeek,
    closed: source.closed,
    intervals: source.intervals.map((iv) => ({ ...iv })),
  }));
}

export function weeksEqual(a: readonly OpeningDay[], b: readonly OpeningDay[]): boolean {
  return JSON.stringify(weekToPayload(a)) === JSON.stringify(weekToPayload(b));
}
