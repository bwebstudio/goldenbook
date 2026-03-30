"use client";

import type { BookingProvider, DailyClicks, TopBookingPlace } from "@/lib/api/campaign-analytics";
import Card from "@/components/ui/Card";

const PROVIDER_LABELS: Record<string, string> = {
  thefork: "TheFork",
  booking: "Booking.com",
  viator: "Viator",
  getyourguide: "GetYourGuide",
  website: "Direct Website",
};

const PROVIDER_COLORS: Record<string, string> = {
  thefork: "bg-emerald-50 text-emerald-700 border-emerald-200",
  booking: "bg-blue-50 text-blue-700 border-blue-200",
  viator: "bg-purple-50 text-purple-700 border-purple-200",
  getyourguide: "bg-amber-50 text-amber-700 border-amber-200",
  website: "bg-gray-50 text-gray-700 border-gray-200",
};

export default function BookingAnalyticsClient({
  providers,
  dailyClicks,
  topPlaces,
}: {
  providers: BookingProvider[];
  dailyClicks: DailyClicks[];
  topPlaces: TopBookingPlace[];
}) {
  const hasProviders = providers.length > 0;
  const hasClicks = dailyClicks.some((d) => d.count > 0);
  const hasPlaces = topPlaces.length > 0;

  if (!hasProviders && !hasClicks && !hasPlaces) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-text">Booking & Reservation Partners</h2>
        <p className="text-sm text-muted mt-0.5">TheFork, Booking.com, Viator and other providers</p>
      </div>

      {/* Provider cards */}
      {hasProviders && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {providers.map((p) => (
            <Card key={p.provider} className="!p-4">
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mb-2 ${PROVIDER_COLORS[p.provider] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                {PROVIDER_LABELS[p.provider] ?? p.provider}
              </span>
              <p className="text-2xl font-bold text-text">{p.total}</p>
              <p className="text-[10px] text-muted mt-0.5">listings</p>
              <div className="flex items-center gap-3 mt-2 text-[10px]">
                <span className="text-emerald-600 font-semibold">{p.active} active</span>
                <span className="text-muted">{p.valid} valid</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily clicks chart */}
        {hasClicks && (
          <div>
            <h3 className="text-base font-bold text-text mb-3">Daily Clicks (30d)</h3>
            <Card>
              <div className="flex items-end gap-1 h-28">
                {dailyClicks.map((d) => {
                  const max = Math.max(...dailyClicks.map((x) => x.count), 1);
                  const height = d.count > 0 ? Math.max(4, (d.count / max) * 100) : 0;
                  return (
                    <div key={d.date} className="flex-1" title={`${d.date}: ${d.count} clicks`}>
                      <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: d.count > 0 ? "#D2B68A" : "#F0ECE6", minHeight: "2px" }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-muted">
                <span>{dailyClicks[0]?.date.slice(5)}</span>
                <span>{dailyClicks[dailyClicks.length - 1]?.date.slice(5)}</span>
              </div>
            </Card>
          </div>
        )}

        {/* Top places by clicks */}
        {hasPlaces && (
          <div>
            <h3 className="text-base font-bold text-text mb-3">Top Places (by clicks)</h3>
            <Card className="!p-0 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-4 py-2.5 font-semibold text-muted">Place</th>
                    <th className="px-4 py-2.5 font-semibold text-muted text-right">Views</th>
                    <th className="px-4 py-2.5 font-semibold text-muted text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {topPlaces.slice(0, 8).map((p) => (
                    <tr key={p.placeName} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2 font-medium text-text text-sm">{p.placeName}</td>
                      <td className="px-4 py-2 text-right text-muted">{p.views || "—"}</td>
                      <td className="px-4 py-2 text-right text-muted">{p.clicks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>

      {/* No click data note */}
      {!hasClicks && hasProviders && (
        <Card className="!py-8 text-center">
          <p className="text-sm text-muted">No click data recorded yet. Clicks will be tracked when users interact with booking links.</p>
        </Card>
      )}
    </div>
  );
}
