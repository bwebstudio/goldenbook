"use client";

import type {
  AnalyticsOverview,
  CampaignPerformance,
  EstablishmentPerformance,
  TimeBucketPerformance,
  DayOfWeekPerformance,
} from "@/lib/api/campaign-analytics";
import Card from "@/components/ui/Card";

const SECTION_LABELS: Record<string, string> = {
  golden_picks: "Golden Picks",
  now: "Now",
  hidden_gems: "Hidden Gems",
  new_on_goldenbook: "New on Goldenbook",
  search_priority: "Search Priority",
  category_featured: "Category Featured",
  concierge: "Concierge",
  extended_description: "Extended Description",
  extra_images: "Extra Images",
  listing_premium_pack: "Premium Pack",
};

const BUCKET_LABELS: Record<string, string> = {
  all_day: "All Day",
  morning: "Morning",
  lunch: "Lunch",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

function fmtCurrency(n: number): string {
  return n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${Math.round(n)}`;
}

export default function CampaignAnalyticsClient({
  overview,
  campaigns,
  establishments,
  timeBuckets,
  dayOfWeek,
}: {
  overview: AnalyticsOverview | null;
  campaigns: CampaignPerformance[];
  establishments: EstablishmentPerformance[];
  timeBuckets: TimeBucketPerformance[];
  dayOfWeek: DayOfWeekPerformance[];
}) {
  const hasRevenue = overview && overview.revenue.total > 0;
  const hasCampaigns = campaigns.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-text">Revenue & Campaigns</h2>
        <p className="text-sm text-muted mt-0.5">Last {overview?.revenue.period ?? 30} days</p>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="!p-5">
          <p className="text-sm text-muted">Revenue</p>
          <p className="text-2xl font-bold text-text mt-1">
            {hasRevenue ? fmtCurrency(overview!.revenue.total) : "—"}
          </p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">Purchases</p>
          <p className="text-2xl font-bold text-text mt-1">
            {overview ? overview.revenue.purchases : "—"}
          </p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">Conversion</p>
          <p className="text-2xl font-bold text-text mt-1">
            {overview?.conversion.rate !== null && overview?.conversion.rate !== undefined
              ? `${overview.conversion.rate}%`
              : "—"}
          </p>
          {overview && overview.conversion.started > 0 && (
            <p className="text-[10px] text-muted mt-0.5">
              {overview.conversion.completed}/{overview.conversion.started} checkouts
            </p>
          )}
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">Active Placements</p>
          <p className="text-2xl font-bold text-text mt-1">
            {overview ? overview.activePlacements : "—"}
          </p>
        </Card>
      </div>

      {/* ── Revenue Chart (simple bar) ───────────────────────────────────── */}
      {overview && overview.daily.length > 0 && (
        <Card>
          <p className="text-sm font-bold text-text mb-4">Daily Revenue</p>
          <div className="flex items-end gap-1 h-32">
            {overview.daily.map((d) => {
              const maxRev = Math.max(...overview.daily.map((x) => x.revenue), 1);
              const height = d.revenue > 0 ? Math.max(4, (d.revenue / maxRev) * 100) : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: €${d.revenue.toFixed(0)} (${d.count} purchases)`}>
                  <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: d.revenue > 0 ? "#D2B68A" : "#F0ECE6", minHeight: "2px" }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-muted">
            <span>{overview.daily[0]?.date.slice(5)}</span>
            <span>{overview.daily[overview.daily.length - 1]?.date.slice(5)}</span>
          </div>
        </Card>
      )}

      {/* ── Campaigns Table ──────────────────────────────────────────────── */}
      {hasCampaigns && (
        <>
          <h3 className="text-base font-bold text-text">Revenue by Section</h3>
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-5 py-3 font-semibold text-muted">Section</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">Revenue</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">Purchases</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">Active</th>
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

      {/* ── Top Establishments ────────────────────────────────────────────── */}
      {establishments.length > 0 && (
        <>
          <h3 className="text-base font-bold text-text">Top Establishments</h3>
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-5 py-3 font-semibold text-muted">Place</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">Revenue</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">Purchases</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">Views</th>
                  <th className="px-5 py-3 font-semibold text-muted text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {establishments.map((e) => (
                  <tr key={e.placeId} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3 font-medium text-text">{e.placeName}</td>
                    <td className="px-5 py-3 text-right font-semibold text-text">{fmtCurrency(e.totalRevenue)}</td>
                    <td className="px-5 py-3 text-right text-muted">{e.totalPurchases}</td>
                    <td className="px-5 py-3 text-right text-muted">{e.views || "—"}</td>
                    <td className="px-5 py-3 text-right text-muted">{e.clicks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ── Time Performance ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time Buckets */}
        {timeBuckets.length > 0 && (
          <div>
            <h3 className="text-base font-bold text-text mb-3">Time Slot Performance</h3>
            <Card className="!p-0 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-5 py-3 font-semibold text-muted">Time</th>
                    <th className="px-5 py-3 font-semibold text-muted text-right">Sold</th>
                    <th className="px-5 py-3 font-semibold text-muted text-right">Rate</th>
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

        {/* Day of Week */}
        {dayOfWeek.length > 0 && (
          <div>
            <h3 className="text-base font-bold text-text mb-3">Revenue by Day</h3>
            <Card>
              <div className="flex items-end gap-2 h-28">
                {dayOfWeek.map((d) => {
                  const maxRev = Math.max(...dayOfWeek.map((x) => x.revenue), 1);
                  const height = d.revenue > 0 ? Math.max(8, (d.revenue / maxRev) * 100) : 4;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: d.revenue > 0 ? "#D2B68A" : "#F0ECE6" }} />
                      <span className="text-[10px] text-muted">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* No data fallback */}
      {!hasRevenue && !hasCampaigns && establishments.length === 0 && (
        <Card className="text-center !py-12">
          <p className="text-base font-semibold text-text">No revenue data yet</p>
          <p className="text-sm text-muted mt-1">Revenue analytics will appear here once placements are sold.</p>
        </Card>
      )}
    </div>
  );
}
