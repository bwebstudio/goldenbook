"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { fetchAdminPlacesList } from "@/lib/api/places";
import type { AdminPlaceListItem } from "@/types/api/place";
import Card from "@/components/ui/Card";

interface CityCount {
  city: string;
  count: number;
}

interface CategoryCount {
  category: string;
  count: number;
}

interface CoverageItem {
  label: string;
  value: number;
  total: number;
}

export default function ContentOverviewClient() {
  const t = useT();
  const ca = t.campAnalytics as Record<string, string>;

  const [places, setPlaces] = useState<AdminPlaceListItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchAdminPlacesList()
      .then(setPlaces)
      .catch((err) => { console.error('[ContentOverview] fetch failed:', err); setError(true); setPlaces([]); });
  }, []);

  if (places === null) {
    return (
      <Card className="!py-8 text-center">
        <p className="text-sm text-muted">{t.common.loading}</p>
      </Card>
    );
  }

  if (error || places.length === 0) {
    return (
      <Card className="!py-8 text-center">
        <p className="text-sm text-muted">{error ? "Could not load content data" : "No places found"}</p>
      </Card>
    );
  }

  const total = places.length;
  const published = places.filter((p) => p.status === "published").length;
  const draft = places.filter((p) => p.status === "draft").length;
  const withImage = places.filter((p) => p.hero_bucket && p.hero_path).length;
  const withBooking = places.filter((p) =>
    p.has_booking_link || p.booking_enabled || (p.booking_mode && p.booking_mode !== 'none')
  ).length;

  // Places by city
  const cityMap = new Map<string, number>();
  for (const p of places) {
    cityMap.set(p.city_name, (cityMap.get(p.city_name) ?? 0) + 1);
  }
  const byCities: CityCount[] = Array.from(cityMap.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);

  // Places by category
  const catMap = new Map<string, number>();
  for (const p of places) {
    const slug = p.category_slug ?? "uncategorized";
    catMap.set(slug, (catMap.get(slug) ?? 0) + 1);
  }
  const byCategories: CategoryCount[] = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const maxCityCount = Math.max(...byCities.map((c) => c.count), 1);

  const coverageItems: CoverageItem[] = [
    { label: ca.published, value: published, total },
    { label: ca.withImages, value: withImage, total },
    { label: ca.withBooking, value: withBooking, total },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-text">{ca.contentOverview}</h2>
        <p className="text-sm text-muted mt-0.5">{ca.contentOverviewSub}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.totalPlaces}</p>
          <p className="text-2xl font-bold text-text mt-1">{total}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.published}</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{published}</p>
          <p className="text-[10px] text-muted mt-0.5">{draft} {ca.draft.toLowerCase()}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.withImages}</p>
          <p className="text-2xl font-bold text-text mt-1">{withImage}</p>
          <p className="text-[10px] text-muted mt-0.5">{Math.round((withImage / total) * 100)}% {ca.ofTotal} {total}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">{ca.withBooking}</p>
          <p className="text-2xl font-bold text-text mt-1">{withBooking}</p>
          <p className="text-[10px] text-muted mt-0.5">{Math.round((withBooking / total) * 100)}% {ca.ofTotal} {total}</p>
        </Card>
      </div>

      {/* Coverage bars */}
      <Card>
        <p className="text-sm font-bold text-text mb-4">{ca.coverage}</p>
        <div className="flex flex-col gap-3">
          {coverageItems.map((item) => {
            const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
            return (
              <div key={item.label} className="flex items-center gap-4">
                <span className="text-sm text-text w-32 shrink-0">{item.label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 80 ? "#10B981" : pct >= 50 ? "#D2B68A" : "#F59E0B",
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-text w-16 text-right">{item.value}/{item.total}</span>
                <span className="text-xs text-muted w-10 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* City + Category breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Places by city */}
        {byCities.length > 0 && (
          <Card>
            <p className="text-sm font-bold text-text mb-4">{ca.placesByCity}</p>
            <div className="flex flex-col gap-2.5">
              {byCities.map((c) => {
                const pct = Math.round((c.count / maxCityCount) * 100);
                return (
                  <div key={c.city} className="flex items-center gap-3">
                    <span className="text-sm text-text w-24 shrink-0 capitalize truncate">{c.city}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-text w-8 text-right">{c.count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Places by category */}
        {byCategories.length > 0 && (
          <Card className="!p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-surface">
              <p className="text-sm font-bold text-text">{ca.placesByCategory}</p>
            </div>
            <div className="divide-y divide-border/50">
              {byCategories.slice(0, 10).map((c) => (
                <div key={c.category} className="px-5 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-text capitalize">{c.category.replace(/-/g, " ")}</span>
                  <span className="text-sm font-semibold text-text">{c.count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
