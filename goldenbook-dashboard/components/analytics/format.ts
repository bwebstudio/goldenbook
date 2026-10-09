// Pure formatting helpers shared by the analytics blocks. Kept free of React
// so they can be unit-tested without a DOM.

/** "1m 05s" style duration. Placeholder for missing or non-positive values. */
export function formatSec(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "-";
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

/**
 * A percentage the server already rounded, or the given placeholder when it
 * is null (no denominator, or a window that has not finished yet). Never
 * renders null as "0%": that would read as a real, bad result.
 */
export function formatPct(value: number | null | undefined, placeholder: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return placeholder;
  return `${value}%`;
}

/** Fills `{name}` slots in a localized template. Unknown slots are left as-is. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Label for an attribution key (source or category). null means the event
 * came from an app version that did not send it, which is shown as its own
 * bucket rather than hidden.
 */
export function keyLabel(
  key: string | null,
  labels: Record<string, string>,
  unknown: string,
): string {
  if (key === null || key === "") return unknown;
  return labels[key] ?? key.replace(/[-_]/g, " ");
}

/** "2026-10-05" -> "05/10", for compact week and day axes. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${d}/${m}` : iso;
}

/**
 * Background opacity for a heat-map cell: 0 for empty or pending, then
 * scaled against the column maximum so the strongest cohort is the darkest.
 */
export function heatAlpha(value: number | null, max: number): number {
  if (value === null || value <= 0 || max <= 0) return 0;
  return Math.round(Math.min(1, value / max) * 0.6 * 100) / 100 + 0.08;
}
