// Weekly retention cohorts. Each row is the people whose first day in the
// app fell in that week; the cells are the share who came back. A cell stays
// "pending" until its window has passed for everyone in the row, so a young
// cohort never shows a low number that is only low because time has not
// passed yet.

import Card from "@/components/ui/Card";
import type { TranslationKeys } from "@/lib/i18n";
import type { RetentionAnalytics, RetentionCohort } from "@/lib/api/analytics-v2";
import { formatPct, heatAlpha, shortDate } from "./format";

type Txt = TranslationKeys["behaviorV2"];
type PctKey = "d1Pct" | "d1to7Pct" | "d8to30Pct";

export default function RetentionBlock({ d, t }: { d: RetentionAnalytics; t: Txt }) {
  const cols: { key: PctKey; label: string }[] = [
    { key: "d1Pct", label: t.retD1 },
    { key: "d1to7Pct", label: t.retD1to7 },
    { key: "d8to30Pct", label: t.retD8to30 },
  ];
  const maxOf = (key: PctKey) => Math.max(0, ...d.cohorts.map((c) => c[key] ?? 0));
  const max = Object.fromEntries(cols.map((c) => [c.key, maxOf(c.key)])) as Record<PctKey, number>;
  // Newest first: the row someone is most likely to be checking.
  const rows: RetentionCohort[] = [...d.cohorts].reverse();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-text">{t.retentionTitle}</h3>
        <p className="text-xs text-muted mt-0.5 max-w-2xl">{t.retentionSub}</p>
      </div>

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-left text-sm min-w-96">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 font-semibold text-muted">{t.cohortWeek}</th>
              <th className="px-4 py-3 font-semibold text-muted text-right">{t.newUsers}</th>
              {cols.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold text-muted text-right">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.week} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-text">{shortDate(r.week)}</td>
                <td className="px-4 py-2.5 text-right text-text">{r.users.toLocaleString()}</td>
                {cols.map((c) => {
                  const v = r[c.key];
                  return (
                    <td key={c.key} className="px-2 py-1.5 text-right">
                      <span
                        className={`inline-block min-w-16 px-2 py-1 rounded-md ${
                          v === null ? "text-muted italic text-xs" : "font-semibold text-text"
                        }`}
                        style={{ backgroundColor: `rgba(165, 131, 90, ${heatAlpha(v, max[c.key])})` }}
                      >
                        {r.users === 0 && v === null ? "-" : formatPct(v, t.pending)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-[11px] text-muted -mt-2">{t.retentionNote}</p>
    </div>
  );
}
