"use client";

import { useT } from "@/lib/i18n";
import type { BehaviorAnalytics } from "@/lib/api/tracking";
import Card from "@/components/ui/Card";

export default function BehaviorAnalyticsClient({ data }: { data: BehaviorAnalytics | null }) {
  const t = useT();
  const ca = t.campAnalytics as Record<string, string>;

  if (!data || (data.totals.views === 0 && data.totals.clicks === 0 && data.totals.saves === 0)) {
    return null;
  }

  const hasDaily = data.daily.some((d) => d.views > 0 || d.clicks > 0);
  const BAR_H = 120;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-text">User Behavior</h2>
        <p className="text-sm text-muted mt-0.5">{ca.last30}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.views}</p>
          <p className="text-2xl font-bold text-text mt-1">{data.totals.views.toLocaleString()}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.clicks}</p>
          <p className="text-2xl font-bold text-text mt-1">{data.totals.clicks.toLocaleString()}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">Saves</p>
          <p className="text-2xl font-bold text-text mt-1">{data.totals.saves.toLocaleString()}</p>
        </Card>
      </div>

      {/* Daily activity chart */}
      {hasDaily && (() => {
        const last14 = data.daily.slice(-14);
        const maxVal = Math.max(...last14.map((d) => d.views + d.clicks), 1);
        return (
          <Card>
            <p className="text-sm font-bold text-text mb-4">Daily Activity</p>
            <div className="flex items-end gap-1.5" style={{ height: `${BAR_H + 20}px` }}>
              {last14.map((d) => {
                const hViews = d.views > 0 ? Math.max(4, Math.round((d.views / maxVal) * BAR_H)) : 0;
                const hClicks = d.clicks > 0 ? Math.max(4, Math.round((d.clicks / maxVal) * BAR_H)) : 0;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ${d.views} views, ${d.clicks} clicks`}>
                    <div className="w-full flex flex-col items-center">
                      {hViews > 0 && <div className="w-full rounded-t" style={{ height: `${hViews}px`, backgroundColor: "#D2B68A" }} />}
                      {hClicks > 0 && <div className="w-full" style={{ height: `${hClicks}px`, backgroundColor: "#A5835A" }} />}
                      {hViews === 0 && hClicks === 0 && <div className="w-full rounded-t" style={{ height: "2px", backgroundColor: "#F0ECE6" }} />}
                    </div>
                    <span className="text-[8px] text-muted mt-1">{d.date.slice(8)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "#D2B68A" }} /> Views</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "#A5835A" }} /> Clicks</span>
            </div>
          </Card>
        );
      })()}

      {/* Top lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.topViewed.length > 0 && (
          <TopList title="Most Viewed" items={data.topViewed.map((r) => ({ label: r.placeName, count: r.count }))} />
        )}
        {data.topClicked.length > 0 && (
          <TopList title="Most Clicked" items={data.topClicked.map((r) => ({ label: r.placeName, count: r.count }))} />
        )}
        {data.topSaved.length > 0 && (
          <TopList title="Most Saved" items={data.topSaved.map((r) => ({ label: r.placeName, count: r.count }))} />
        )}
        {data.topCategories.length > 0 && (
          <TopList title="Top Categories" items={data.topCategories.map((r) => ({ label: r.category, count: r.count }))} />
        )}
      </div>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface">
        <p className="text-xs font-bold text-text">{title}</p>
      </div>
      <div className="divide-y divide-border/50">
        {items.slice(0, 5).map((item, i) => (
          <div key={item.label} className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-muted w-4 shrink-0">{i + 1}.</span>
              <span className="text-sm text-text truncate">{item.label}</span>
            </div>
            <span className="text-sm font-semibold text-text shrink-0 ml-2">{item.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
