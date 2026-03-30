"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import type { VisibilityGlobalDTO } from "@/lib/api/visibility";

const filterSelectClass =
  "rounded-xl border border-border bg-white px-4 py-3 text-base text-text focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition appearance-none cursor-pointer min-w-[160px]";

function isActive(item: VisibilityGlobalDTO): boolean {
  if (!item.is_active) return false;
  const now = new Date();
  if (item.starts_at && new Date(item.starts_at) > now) return false;
  if (item.ends_at && new Date(item.ends_at) < now) return false;
  return true;
}

function isExpiringSoon(item: VisibilityGlobalDTO): boolean {
  if (!item.ends_at || !item.is_active) return false;
  const endsAt = new Date(item.ends_at);
  const now = new Date();
  if (endsAt < now) return false;
  const daysLeft = (endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysLeft <= 7;
}

function isScheduled(item: VisibilityGlobalDTO): boolean {
  if (!item.is_active || !item.starts_at) return false;
  return new Date(item.starts_at) > new Date();
}

function isExpired(item: VisibilityGlobalDTO): boolean {
  if (!item.ends_at) return false;
  return new Date(item.ends_at) < new Date();
}

function getStatus(item: VisibilityGlobalDTO): "active" | "expiring" | "scheduled" | "expired" | "inactive" {
  if (!item.is_active) return "inactive";
  if (isExpired(item)) return "expired";
  if (isScheduled(item)) return "scheduled";
  if (isExpiringSoon(item)) return "expiring";
  return "active";
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  expiring: "bg-orange-100 text-orange-700",
  scheduled: "bg-blue-100 text-blue-700",
  expired: "bg-red-100 text-red-600",
  inactive: "bg-gray-100 text-gray-500",
};

interface Props {
  items: VisibilityGlobalDTO[];
  cities: string[];
  surfaces: string[];
}

export default function PlacementsClient({ items, cities, surfaces }: Props) {
  const t = useT();
  const [cityFilter, setCityFilter] = useState("all");
  const [surfaceFilter, setSurfaceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "editorial" | "sponsored">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expiring">("all");

  const STATUS_LABELS: Record<string, string> = {
    active: t.empPlacements.statusActive,
    expiring: t.empPlacements.statusExpiring,
    scheduled: t.empPlacements.statusScheduled,
    expired: t.empPlacements.statusExpired,
    inactive: t.empPlacements.statusInactive,
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (cityFilter !== "all" && item.city_name !== cityFilter) return false;
      if (surfaceFilter !== "all" && item.surface !== surfaceFilter) return false;
      if (typeFilter !== "all" && item.visibility_type !== typeFilter) return false;
      if (statusFilter === "active" && !isActive(item)) return false;
      if (statusFilter === "expiring" && !isExpiringSoon(item)) return false;
      return true;
    });
  }, [items, cityFilter, surfaceFilter, typeFilter, statusFilter]);

  // Group by city, then by surface
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, VisibilityGlobalDTO[]>>();
    for (const item of filtered) {
      if (!map.has(item.city_name)) map.set(item.city_name, new Map());
      const cityMap = map.get(item.city_name)!;
      if (!cityMap.has(item.surface)) cityMap.set(item.surface, []);
      cityMap.get(item.surface)!.push(item);
    }
    return map;
  }, [filtered]);

  const hasFilters = cityFilter !== "all" || surfaceFilter !== "all" || typeFilter !== "all" || statusFilter !== "all";

  // Stats
  const totalActive = items.filter(isActive).length;
  const totalExpiring = items.filter(isExpiringSoon).length;
  const totalSponsored = items.filter(i => i.visibility_type === "sponsored" && isActive(i)).length;

  const surfaceLabel = (key: string) =>
    (t.surfaces as Record<string, string>)[key] ?? key;

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t.empPlacements.title}</h1>
          <p className="text-sm text-muted mt-1">{t.empPlacements.subtitle}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-border px-5 py-4">
          <p className="text-2xl font-bold text-text">{totalActive}</p>
          <p className="text-xs text-muted mt-0.5">{t.empPlacements.activePlacements}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-5 py-4">
          <p className="text-2xl font-bold text-orange-600">{totalExpiring}</p>
          <p className="text-xs text-muted mt-0.5">{t.empPlacements.expiringThisWeek}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-5 py-4">
          <p className="text-2xl font-bold text-gold">{totalSponsored}</p>
          <p className="text-xs text-muted mt-0.5">{t.empPlacements.sponsoredActive}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-muted mr-1">{t.empPlacements.filter}</span>
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className={filterSelectClass}>
          <option value="all">{t.empPlacements.allCities}</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={surfaceFilter} onChange={e => setSurfaceFilter(e.target.value)} className={filterSelectClass}>
          <option value="all">{t.empPlacements.allSections}</option>
          {surfaces.map(s => <option key={s} value={s}>{surfaceLabel(s)}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className={filterSelectClass}>
          <option value="all">{t.empPlacements.allTypes}</option>
          <option value="editorial">{t.empPlacements.editorial}</option>
          <option value="sponsored">{t.empPlacements.sponsored}</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={filterSelectClass}>
          <option value="all">{t.empPlacements.allStatuses}</option>
          <option value="active">{t.empPlacements.activeOnly}</option>
          <option value="expiring">{t.empPlacements.expiringSoon}</option>
        </select>
        {hasFilters && (
          <button onClick={() => { setCityFilter("all"); setSurfaceFilter("all"); setTypeFilter("all"); setStatusFilter("all"); }} className="text-sm font-semibold text-muted hover:text-gold underline transition-colors cursor-pointer ml-1">
            {t.empPlacements.clear}
          </button>
        )}
      </div>

      {/* Grouped content */}
      {grouped.size === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-16 text-center">
          <p className="text-lg font-semibold text-text mb-1">{hasFilters ? t.empPlacements.noMatch : t.empPlacements.noPlacementsYet}</p>
          <p className="text-sm text-muted">{t.empPlacements.noPlacementsDesc}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {[...grouped.entries()].map(([cityName, surfaceMap]) => (
            <div key={cityName}>
              <h2 className="text-lg font-bold text-text mb-4">{cityName}</h2>
              <div className="flex flex-col gap-4">
                {[...surfaceMap.entries()].map(([surface, placements]) => (
                  <div key={surface} className="bg-white rounded-xl border border-border overflow-hidden">
                    <div className="px-5 py-3 bg-surface border-b border-border">
                      <p className="text-sm font-semibold text-text">{surfaceLabel(surface)}</p>
                    </div>
                    <div className="divide-y divide-border/50">
                      {placements.map((item) => {
                        const status = getStatus(item);
                        return (
                          <div key={item.id} className="px-5 py-3 flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Link href={`/places/${item.place_slug}`} className="text-sm font-semibold text-text hover:text-gold transition-colors truncate">
                                  {item.place_name}
                                </Link>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${item.visibility_type === "sponsored" ? "bg-gold/20 text-gold-dark" : "bg-blue-50 text-blue-600"}`}>
                                  {item.visibility_type}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status]}`}>
                                  {STATUS_LABELS[status]}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                                <span>{t.empPlacements.priority}: {item.priority}</span>
                                {item.source && item.source !== "system" && <span className="font-medium">{item.source}</span>}
                                {item.placement_slot && <span>{t.empPlacements.slot}: {item.placement_slot}</span>}
                                {item.scope_id && <span>{t.empPlacements.scope}: {item.scope_id}</span>}
                                {item.starts_at && <span>{t.common.from} {new Date(item.starts_at).toLocaleDateString()}</span>}
                                {item.ends_at && <span>{t.common.until} {new Date(item.ends_at).toLocaleDateString()}</span>}
                                {item.notes && <span className="italic">{item.notes}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
