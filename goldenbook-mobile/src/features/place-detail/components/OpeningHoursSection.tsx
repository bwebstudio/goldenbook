import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from '@/i18n';
import type { PlaceDetailDTO } from '../types';

type OpeningHour = PlaceDetailDTO['openingHours'][number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "10:00:00" → "10:00". Empty for null. */
function formatTime(t: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}

/** "10:00:00"+"13:00:00" → "10:00–13:00" */
function formatRange(opens: string | null, closes: string | null): string {
  return `${formatTime(opens)}–${formatTime(closes)}`;
}

interface DaySlot {
  opensAt: string | null;
  closesAt: string | null;
}

interface DayBucket {
  dayOfWeek: number;
  isClosed: boolean;
  slots: DaySlot[];
}

/**
 * Collapse the flat backend payload (one row per day×slot) into one bucket
 * per day, with all open ranges merged in order. Handles:
 *   - one continuous range          → 1 slot
 *   - split shift (lunch + dinner)  → 2 slots
 *   - more than two ranges          → N slots, all rendered on one line
 *   - day fully closed              → isClosed=true, no slots
 *   - day with no record at all     → not present in the bucket map
 *
 * The grouping is by dayOfWeek only — we never repeat the day label in the UI.
 */
function groupByDay(rows: OpeningHour[]): Map<number, DayBucket> {
  const map = new Map<number, DayBucket>();

  for (const row of rows) {
    const existing = map.get(row.dayOfWeek);

    // A row marked closed is the canonical "this day is closed" signal.
    // Even if other rows accidentally exist for the same day, we honour
    // any non-closed slot found later — but if every row for the day is
    // closed, the bucket stays closed. In practice the dashboard never
    // mixes both, so this is just defensive.
    if (row.isClosed) {
      if (!existing) {
        map.set(row.dayOfWeek, { dayOfWeek: row.dayOfWeek, isClosed: true, slots: [] });
      }
      continue;
    }

    if (!existing || existing.isClosed) {
      map.set(row.dayOfWeek, {
        dayOfWeek: row.dayOfWeek,
        isClosed: false,
        slots: [{ opensAt: row.opensAt, closesAt: row.closesAt }],
      });
    } else {
      existing.slots.push({ opensAt: row.opensAt, closesAt: row.closesAt });
    }
  }

  // Sort each day's slots by opens_at so a backend that doesn't pre-sort
  // (or that lost slot_order) still renders "lunch · dinner" in the right
  // order, never "dinner · lunch".
  for (const bucket of map.values()) {
    bucket.slots.sort((a, b) => {
      if (!a.opensAt) return 1;
      if (!b.opensAt) return -1;
      return a.opensAt.localeCompare(b.opensAt);
    });
  }

  return map;
}

/**
 * Compose the right-hand text for a day:
 *   closed       → "Closed"
 *   1 range      → "10:00–19:00"
 *   2 ranges     → "10:00–13:00 · 14:00–19:00"
 *   N ranges     → joined with " · "
 */
function renderDayText(bucket: DayBucket | undefined, closedLabel: string): string {
  if (!bucket || bucket.isClosed || bucket.slots.length === 0) return closedLabel;
  return bucket.slots
    .filter((s) => s.opensAt && s.closesAt)
    .map((s) => formatRange(s.opensAt, s.closesAt))
    .join('  ·  ');
}

interface OpeningHoursSectionProps {
  openingHours: OpeningHour[];
}

export function OpeningHoursSection({ openingHours }: OpeningHoursSectionProps) {
  const t = useTranslation();
  // dayOfWeek 0 = Sunday in our schema, but we render Mon→Sun.
  const dayNames = [t.days.sun, t.days.mon, t.days.tue, t.days.wed, t.days.thu, t.days.fri, t.days.sat];
  const today = useMemo(() => new Date().getDay(), []);

  // Hooks must run unconditionally — compute the bucket BEFORE the early
  // return so the rules of hooks aren't violated when openingHours is empty.
  const buckets = useMemo(() => groupByDay(openingHours), [openingHours]);

  // Render Mon (1) → Sun (0). We always render all 7 days so the table feels
  // complete even if the backend only returned a subset.
  const orderedDays = useMemo(() => [1, 2, 3, 4, 5, 6, 0], []);

  if (!openingHours.length) return null;

  return (
    <View className="px-5 pb-4">
      <Text className="text-xs font-semibold tracking-widest uppercase text-navy/40 mb-3">
        {t.place.openingHours}
      </Text>

      <View className="bg-ivory-soft rounded-2xl overflow-hidden">
        {orderedDays.map((dow, idx) => {
          const bucket = buckets.get(dow);
          // Skip days that have no record at all to avoid implying false data.
          // (If the backend never returned anything for Tuesday, we don't
          //  fabricate a "Closed" — that would be misleading.)
          if (!bucket) return null;

          const isToday = dow === today;
          const isLast = idx === orderedDays.length - 1
            || !orderedDays.slice(idx + 1).some((d) => buckets.has(d));
          const text = renderDayText(bucket, t.place.closed);
          const isClosed = bucket.isClosed || bucket.slots.length === 0;

          return (
            <View
              key={`day-${dow}`}
              className={`flex-row justify-between items-start px-5 py-3 ${
                !isLast ? 'border-b border-navy/5' : ''
              } ${isToday ? 'bg-primary/8' : ''}`}
            >
              <Text
                className={`text-sm tracking-wide ${
                  isToday ? 'font-semibold text-navy' : 'text-navy/65'
                }`}
                style={{ minWidth: 44 }}
              >
                {dayNames[dow]}
              </Text>

              <View className="flex-1 items-end">
                <Text
                  className={`text-sm text-right leading-snug ${
                    isClosed
                      ? 'text-navy/30 italic'
                      : isToday
                        ? 'font-semibold text-primary'
                        : 'text-navy/70'
                  }`}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {text}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
