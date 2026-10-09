// Where place opens come from (source) and which categories people open and
// save. App 1.2.0 started sending both on place events; anything from older
// builds arrives without them and is shown as "unknown (older app)" instead
// of being dropped, so the totals still add up.

import Card from "@/components/ui/Card";
import type { TranslationKeys } from "@/lib/i18n";
import type { AttributionAnalytics } from "@/lib/api/analytics-v2";
import { fill, keyLabel } from "./format";

type Txt = TranslationKeys["behaviorV2"];

export default function AttributionBlock({ d, t }: { d: AttributionAnalytics; t: Txt }) {
  if (d.totalOpens === 0 && d.topCategories.length === 0) return null;

  const sharePct = d.totalOpens > 0 ? Math.round((d.attributedOpens / d.totalOpens) * 100) : 0;
  const maxSource = Math.max(...d.opensBySource.map((r) => r.count), 1);
  const sourceLabels = t.sources as Record<string, string>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-text">{t.attributionTitle}</h3>
        <p className="text-xs text-muted mt-0.5 max-w-2xl">{t.attributionSub}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm font-bold text-text">{t.opensBySource}</p>
          <p className="text-xs text-muted mt-0.5 mb-4">
            {fill(t.attributedShare, { pct: sharePct, total: d.totalOpens.toLocaleString() })}
          </p>
          <div className="flex flex-col gap-2.5">
            {d.opensBySource.map((r) => {
              const unknown = r.source === null;
              const pct = Math.round((r.count / maxSource) * 100);
              return (
                <div key={r.source ?? "unknown"} className="flex items-center gap-3">
                  <span className={`text-sm w-36 shrink-0 truncate ${unknown ? "text-muted italic" : "text-text"}`}>
                    {keyLabel(r.source, sourceLabels, t.unknownOlderApp)}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: unknown ? "#D9D3CA" : "#A5835A" }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-text w-10 text-right">{r.count.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {d.topCategories.length > 0 && (
          <Card className="!p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface flex items-center justify-between">
              <p className="text-xs font-bold text-text">{t.topCategoriesBySource}</p>
              <div className="flex gap-4 text-[10px] font-semibold text-muted uppercase tracking-wide">
                <span className="w-14 text-right">{t.opens}</span>
                <span className="w-14 text-right">{t.saves}</span>
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {d.topCategories.map((r) => (
                <div key={r.category ?? "unknown"} className="px-4 py-2.5 flex items-center justify-between">
                  <span className={`text-sm truncate capitalize ${r.category === null ? "text-muted italic" : "text-text"}`}>
                    {keyLabel(r.category, {}, t.unknownOlderApp)}
                  </span>
                  <div className="flex gap-4 text-sm shrink-0">
                    <span className="w-14 text-right font-semibold text-text">{r.opens.toLocaleString()}</span>
                    <span className="w-14 text-right text-muted">{r.saves.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
