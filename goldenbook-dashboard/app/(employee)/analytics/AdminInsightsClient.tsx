"use client";

import { useT } from "@/lib/i18n";
import type { AdminInsights } from "@/lib/api/recommendations";
import Card from "@/components/ui/Card";

const SECTION_LABELS: Record<string, string> = {
  golden_picks: "Golden Picks", now: "Now", hidden_gems: "Hidden Gems",
  new_on_goldenbook: "New on Goldenbook", search_priority: "Search Priority",
  category_featured: "Category Featured", concierge: "Concierge",
  extended_description: "Extended Description", extra_images: "Extra Images",
  listing_premium_pack: "Premium Pack",
};

export default function AdminInsightsClient({ insights }: { insights: AdminInsights }) {
  const t = useT();
  const ca = t.campAnalytics as Record<string, string>;
  const { topSections, topCities, demandSignals } = insights;

  if (topSections.length === 0 && topCities.length === 0) return null;

  const BUCKET_LABELS: Record<string, string> = {
    all_day: "All Day", morning: "Morning", lunch: "Lunch",
    afternoon: "Afternoon", evening: "Evening", night: "Night",
  };

  const textInsights: string[] = [];
  if (topSections.length > 0) {
    const top = topSections[0];
    textInsights.push(`${SECTION_LABELS[top.section] ?? top.section} — €${Math.round(top.revenue)} (${top.count} ${ca.purchases.toLowerCase()})`);
  }
  if (topCities.length > 0) {
    const c = topCities[0];
    textInsights.push(`${c.city.charAt(0).toUpperCase() + c.city.slice(1)} — €${Math.round(c.revenue)}`);
  }
  if (insights.bestTimeBucket && insights.bestTimeBucket.pct > 0) {
    textInsights.push(`${BUCKET_LABELS[insights.bestTimeBucket.timeBucket] ?? insights.bestTimeBucket.timeBucket} — ${insights.bestTimeBucket.pct}% sell-through`);
  } else if (demandSignals.length > 0 && demandSignals[0].demandScore > 50) {
    textInsights.push(`${SECTION_LABELS[demandSignals[0].section] ?? demandSignals[0].section} — ${demandSignals[0].demandScore}% sell-through`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-text">{ca.insights}</h2>
        <p className="text-sm text-muted mt-0.5">{ca.insightsSub}</p>
      </div>

      {textInsights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {textInsights.map((text, i) => (
            <Card key={i} className="!p-4 border-l-4 !border-l-gold">
              <p className="text-sm text-text leading-relaxed">{text}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topSections.length > 0 && (
          <Card className="!p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface">
              <p className="text-xs font-bold text-text">{ca.topSections}</p>
            </div>
            <div className="divide-y divide-border/50">
              {topSections.slice(0, 5).map((s, i) => (
                <div key={s.section} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted w-4">{i + 1}.</span>
                    <span className="text-sm text-text">{SECTION_LABELS[s.section] ?? s.section}</span>
                  </div>
                  <span className="text-sm font-bold text-text">€{Math.round(s.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {topCities.length > 0 && (
          <Card className="!p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface">
              <p className="text-xs font-bold text-text">{ca.topCities}</p>
            </div>
            <div className="divide-y divide-border/50">
              {topCities.map((c, i) => (
                <div key={c.city} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted w-4">{i + 1}.</span>
                    <span className="text-sm text-text capitalize">{c.city}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-text">€{Math.round(c.revenue)}</span>
                    <span className="text-[10px] text-muted ml-1.5">{c.count} {ca.purchases.toLowerCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {demandSignals.length > 0 && (
          <Card className="!p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface">
              <p className="text-xs font-bold text-text">{ca.demandScore}</p>
            </div>
            <div className="divide-y divide-border/50">
              {demandSignals.map((d) => (
                <div key={d.section} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-text">{SECTION_LABELS[d.section] ?? d.section}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${d.demandScore}%`,
                        backgroundColor: d.demandScore > 70 ? "#EF4444" : d.demandScore > 40 ? "#F59E0B" : "#10B981",
                      }} />
                    </div>
                    <span className="text-xs font-semibold text-text w-10 text-right">{d.demandScore}%</span>
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
