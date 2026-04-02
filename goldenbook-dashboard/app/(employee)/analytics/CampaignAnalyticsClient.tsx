"use client";

import { useT } from "@/lib/i18n";
import type {
  AnalyticsOverview,
  CampaignPerformance,
  EstablishmentPerformance,
  TimeBucketPerformance,
  DayOfWeekPerformance,
} from "@/lib/api/campaign-analytics";
import Card from "@/components/ui/Card";

const SECTION_LABELS: Record<string, string> = {
  golden_picks: "Golden Picks", now: "Now", hidden_gems: "Hidden Gems",
  new_on_goldenbook: "New on Goldenbook", search_priority: "Search Priority",
  category_featured: "Category Featured", concierge: "Concierge",
  extended_description: "Extended Description", extra_images: "Extra Images",
  listing_premium_pack: "Premium Pack",
};

const BUCKET_LABELS: Record<string, string> = {
  all_day: "All Day", morning: "Morning", lunch: "Lunch",
  afternoon: "Afternoon", evening: "Evening", night: "Night",
};

function fmtCurrency(n: number): string {
  return n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${Math.round(n)}`;
}

export default function CampaignAnalyticsClient({
  overview, campaigns, establishments, timeBuckets, dayOfWeek,
}: {
  overview: AnalyticsOverview | null;
  campaigns: CampaignPerformance[];
  establishments: EstablishmentPerformance[];
  timeBuckets: TimeBucketPerformance[];
  dayOfWeek: DayOfWeekPerformance[];
}) {
  const t = useT();
  const ca = t.campAnalytics as Record<string, string>;

  const hasRevenue = overview && overview.revenue.total > 0;
  const hasCampaigns = campaigns.length > 0;

  // Filter daily data to only show days with activity + 3 days context around them
  const dailyWithData = overview?.daily.filter((d) => d.revenue > 0) ?? [];
  const hasDaily = dailyWithData.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-text">{ca.revenueCampaigns}</h2>
        <p className="text-sm text-muted mt-0.5">{ca.last30}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.revenue}</p>
          <p className="text-2xl font-bold text-text mt-1">
            {hasRevenue ? fmtCurrency(overview!.revenue.total) : <span className="text-sm font-normal text-muted">{ca.noDataYet}</span>}
          </p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.purchases}</p>
          <p className="text-2xl font-bold text-text mt-1">
            {overview && overview.revenue.purchases > 0 ? overview.revenue.purchases : <span className="text-sm font-normal text-muted">{ca.noDataYet}</span>}
          </p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.conversion}</p>
          <p className="text-2xl font-bold text-text mt-1">
            {overview?.conversion.rate !== null && overview?.conversion.rate !== undefined
              ? `${overview.conversion.rate}%`
              : <span className="text-sm font-normal text-muted">{ca.noDataYet}</span>}
          </p>
          {overview && overview.conversion.started > 0 && (
            <p className="text-[10px] text-muted mt-0.5">
              {overview.conversion.completed}/{overview.conversion.started} {ca.checkouts}
            </p>
          )}
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.activePlacements}</p>
          <p className="text-2xl font-bold text-text mt-1">
            {overview ? overview.activePlacements : <span className="text-sm font-normal text-muted">{ca.noDataYet}</span>}
          </p>
        </Card>
      </div>

      {/* Daily Revenue Chart — show last 14 days for better visibility */}
      {overview && hasDaily && (() => {
        const last14 = overview.daily.slice(-14);
        const maxRev = Math.max(...last14.map((x) => x.revenue), 1);
        const BAR_H = 140;
        return (
          <Card>
            <p className="text-sm font-bold text-text mb-4">{ca.dailyRevenue}</p>
            <div className="w-full overflow-x-auto">
            <div className="flex items-end gap-1.5 min-w-100" style={{ height: `${BAR_H + 20}px` }}>
              {last14.map((d) => {
                const h = d.revenue > 0 ? Math.max(12, Math.round((d.revenue / maxRev) * BAR_H)) : 4;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-end justify-end" title={`${d.date}: €${d.revenue.toFixed(0)} (${d.count})`}>
                    {d.revenue > 0 && (
                      <span className="text-[9px] font-semibold text-text mb-1">€{Math.round(d.revenue)}</span>
                    )}
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${h}px`,
                        backgroundColor: d.revenue > 0 ? "#D2B68A" : "#F0ECE6",
                      }}
                    />
                    <span className="text-[8px] text-muted mt-1 self-center">{d.date.slice(8)}</span>
                  </div>
                );
              })}
            </div>
            </div>
          </Card>
        );
      })()}

      {/* Revenue by Section */}
      {hasCampaigns && (
        <>
          <h3 className="text-base font-bold text-text">{ca.revenueBySection}</h3>
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-left text-sm min-w-80">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-5 py-3 font-semibold text-muted">{ca.section}</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">{ca.revenue}</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">{ca.purchases}</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">{ca.active}</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.section} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3 font-medium text-text">{SECTION_LABELS[c.section] ?? c.section}</td>
                    <td className="px-5 py-3 text-right font-semibold text-text">{fmtCurrency(c.totalRevenue)}</td>
                    <td className="px-5 py-3 text-right text-muted">{c.totalPurchases}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.activeCount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                        {c.activeCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Top Establishments */}
      {establishments.length > 0 && (
        <>
          <h3 className="text-base font-bold text-text">{ca.topEstablishments}</h3>
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-left text-sm min-w-96">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-5 py-3 font-semibold text-muted">{ca.place}</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">{ca.revenue}</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">{ca.purchases}</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">{ca.selections}</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">{ca.checkouts}</th>
                </tr>
              </thead>
              <tbody>
                {establishments.map((e) => (
                  <tr key={e.placeId} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3 font-medium text-text">{e.placeName}</td>
                    <td className="px-5 py-3 text-right font-semibold text-text">{fmtCurrency(e.totalRevenue)}</td>
                    <td className="px-5 py-3 text-right text-muted">{e.totalPurchases}</td>
                    <td className="px-5 py-3 text-right text-muted">{e.views}</td>
                    <td className="px-5 py-3 text-right text-muted">{e.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Time Performance */}
      <div className="flex flex-col lg:flex-row gap-6">
        {timeBuckets.length > 0 && (
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-text mb-3">{ca.timeSlotPerf}</h3>
            <Card className="!p-0 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-5 py-3 font-semibold text-muted">{ca.time}</th>
                    <th className="px-5 py-3 font-semibold text-muted text-right">{ca.sold}</th>
                    <th className="px-5 py-3 font-semibold text-muted text-right">{ca.rate}</th>
                  </tr>
                </thead>
                <tbody>
                  {timeBuckets.map((tb) => (
                    <tr key={tb.timeBucket} className="border-b border-border/50 last:border-0">
                      <td className="px-5 py-3 font-medium text-text">{BUCKET_LABELS[tb.timeBucket] ?? tb.timeBucket}</td>
                      <td className="px-5 py-3 text-right text-muted">{tb.sold}/{tb.total}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gold rounded-full" style={{ width: `${tb.rate}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-text w-8 text-right">{tb.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {dayOfWeek.length > 0 && (() => {
          const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const dowMap = new Map(dayOfWeek.map((d) => [d.day, d]));
          const full = allDays.map((day) => dowMap.get(day) ?? { day, revenue: 0, count: 0 });
          const maxRev = Math.max(...full.map((x) => x.revenue), 1);
          const DOW_H = 120;
          return (
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-text mb-3">{ca.revenueByDay}</h3>
              <Card>
                <div className="w-full overflow-x-auto">
                <div className="flex items-end justify-center gap-4 min-w-64" style={{ height: `${DOW_H + 30}px` }}>
                  {full.map((d) => {
                    const h = d.revenue > 0 ? Math.max(16, Math.round((d.revenue / maxRev) * DOW_H)) : 4;
                    return (
                      <div key={d.day} className="flex flex-col items-center justify-end w-10">
                        {d.revenue > 0 && <span className="text-[9px] font-semibold text-text mb-1">€{Math.round(d.revenue)}</span>}
                        <div className="w-6 rounded-t" style={{ height: `${h}px`, backgroundColor: d.revenue > 0 ? "#D2B68A" : "#F0ECE6" }} />
                        <span className="text-[10px] text-muted mt-1.5">{d.day}</span>
                      </div>
                    );
                  })}
                </div>
                </div>
              </Card>
            </div>
          );
        })()}
      </div>

      {/* No data */}
      {!overview && !hasCampaigns && establishments.length === 0 && (
        <Card className="text-center !py-12">
          <p className="text-base font-semibold text-text">{ca.noDataYet}</p>
          <p className="text-sm text-muted mt-1">{ca.analyticsWillAppear}</p>
        </Card>
      )}
    </div>
  );
}
