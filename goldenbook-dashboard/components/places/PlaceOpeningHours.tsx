"use client";

import { useT } from "@/lib/i18n";
import {
  type OpeningDay,
  type OpeningDayProblem,
  WEEK_ORDER,
  DEFAULT_INTERVAL,
  copyDayToAll,
  isOvernight,
  isWeekEmpty,
  validateOpeningDayInWeek,
} from "@/lib/utils/opening-hours";

interface Props {
  /** Always 7 entries, indexed by dayOfWeek (0 = Sunday). */
  value: OpeningDay[];
  onChange: (next: OpeningDay[]) => void;
}

/**
 * Weekly opening hours editor. Per day: open/closed, one or more intervals,
 * and "copy to all days". Overnight intervals (closing time earlier than the
 * opening time) are allowed and labelled "next day", matching how the app and
 * the NOW engine read them.
 */
export default function PlaceOpeningHours({ value, onChange }: Props) {
  const t = useT();
  const pf = t.placeForm;

  const dayNames: Record<number, string> = {
    0: pf.daySun, 1: pf.dayMon, 2: pf.dayTue, 3: pf.dayWed,
    4: pf.dayThu, 5: pf.dayFri, 6: pf.daySat,
  };
  const problemText: Record<OpeningDayProblem, string> = {
    "overlap":      pf.hoursErrorOverlap,
    "same-time":    pf.hoursErrorSameTime,
    "invalid-time": pf.hoursErrorInvalid,
    "no-intervals": pf.hoursErrorNoIntervals,
    "overlaps-previous-night": pf.hoursErrorPreviousNight,
  };

  function updateDay(dayOfWeek: number, patch: (d: OpeningDay) => OpeningDay) {
    onChange(value.map((d) => (d.dayOfWeek === dayOfWeek ? patch(d) : d)));
  }

  function setOpen(dayOfWeek: number, open: boolean) {
    updateDay(dayOfWeek, (d) => ({
      ...d,
      closed: !open,
      intervals: open ? (d.intervals.length > 0 ? d.intervals : [{ ...DEFAULT_INTERVAL }]) : [],
    }));
  }

  function setInterval(dayOfWeek: number, index: number, key: "opens" | "closes", v: string) {
    updateDay(dayOfWeek, (d) => ({
      ...d,
      intervals: d.intervals.map((iv, i) => (i === index ? { ...iv, [key]: v } : iv)),
    }));
  }

  function addInterval(dayOfWeek: number) {
    updateDay(dayOfWeek, (d) => {
      const last = d.intervals[d.intervals.length - 1];
      // Start the new interval one hour after the previous one closes, which
      // is what a split shift (lunch, then dinner) usually looks like.
      const next = last && !isOvernight(last)
        ? { opens: last.closes, closes: last.closes <= "22:00" ? "23:00" : "23:59" }
        : { ...DEFAULT_INTERVAL };
      return { ...d, closed: false, intervals: [...d.intervals, next] };
    });
  }

  function removeInterval(dayOfWeek: number, index: number) {
    updateDay(dayOfWeek, (d) => {
      const intervals = d.intervals.filter((_, i) => i !== index);
      return { ...d, intervals, closed: intervals.length === 0 };
    });
  }

  const empty = isWeekEmpty(value);
  const timeCls =
    "rounded-lg border border-border px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:border-gold";

  return (
    <div className="flex flex-col gap-3">
      {empty && (
        <div className="rounded-lg border border-border bg-surface px-3 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{pf.openingHoursEmpty}</p>
        </div>
      )}

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-white">
        {WEEK_ORDER.map((dow) => {
          const day = value[dow];
          const problem = validateOpeningDayInWeek(value, dow);
          const isOpen = !day.closed;
          return (
            <div key={dow} className="px-4 py-3 flex flex-col gap-2 md:flex-row md:items-start md:gap-4">
              <div className="flex items-center gap-3 md:w-48 md:pt-1.5 shrink-0">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => setOpen(dow, e.target.checked)}
                    className="accent-gold w-4 h-4 cursor-pointer"
                    aria-label={`${dayNames[dow]}: ${isOpen ? pf.hoursOpen : pf.hoursClosed}`}
                  />
                  <span className="text-sm font-medium text-text">{dayNames[dow]}</span>
                </label>
              </div>

              <div className="flex-1 flex flex-col gap-2">
                {!isOpen ? (
                  <p className="text-sm text-muted md:pt-1.5">{pf.hoursClosed}</p>
                ) : (
                  day.intervals.map((iv, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={iv.opens}
                        onChange={(e) => setInterval(dow, i, "opens", e.target.value)}
                        className={timeCls}
                        aria-label={`${dayNames[dow]} ${i + 1}: ${pf.hoursOpen}`}
                      />
                      <span className="text-muted text-sm">–</span>
                      <input
                        type="time"
                        value={iv.closes}
                        onChange={(e) => setInterval(dow, i, "closes", e.target.value)}
                        className={timeCls}
                        aria-label={`${dayNames[dow]} ${i + 1}: ${pf.hoursClosed}`}
                      />
                      {isOvernight(iv) && (
                        <span className="text-[11px] text-muted bg-surface border border-border rounded px-1.5 py-0.5">
                          {pf.hoursNextDay}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeInterval(dow, i)}
                        className="text-xs text-muted hover:text-red-600 transition-colors cursor-pointer px-1"
                        aria-label={pf.hoursRemoveInterval}
                        title={pf.hoursRemoveInterval}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
                {problem && <p className="text-xs text-red-600">{problemText[problem]}</p>}
              </div>

              <div className="flex items-center gap-3 md:pt-1.5 shrink-0">
                {isOpen && (
                  <button
                    type="button"
                    onClick={() => addInterval(dow)}
                    className="text-xs font-semibold text-gold hover:text-gold-dark transition-colors cursor-pointer"
                  >
                    + {pf.hoursAddInterval}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChange(copyDayToAll(value, dow))}
                  className="text-xs font-semibold text-muted hover:text-text transition-colors cursor-pointer"
                >
                  {pf.hoursCopyToAll}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!empty && (
        <div>
          <button
            type="button"
            onClick={() => onChange(value.map((d) => ({ ...d, closed: true, intervals: [] })))}
            className="text-xs font-semibold text-muted hover:text-red-600 transition-colors cursor-pointer"
          >
            {pf.openingHoursClear}
          </button>
        </div>
      )}
    </div>
  );
}
