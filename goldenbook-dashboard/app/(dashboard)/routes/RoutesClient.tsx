"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { UIRoute } from "@/types/ui/route";

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: UIRoute["status"] }) {
  const styles: Record<UIRoute["status"], string> = {
    draft:     "bg-[#F0EFED] text-muted",
    published: "bg-green-50 text-green-700",
    archived:  "bg-red-50 text-red-500",
  };
  const labels: Record<UIRoute["status"], string> = {
    draft:     "Draft",
    published: "Published",
    archived:  "Archived",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─── Route type label ──────────────────────────────────────────────────────────

function routeTypeLabel(type: string): string {
  const map: Record<string, string> = {
    walking: "Walking",
    driving: "Driving",
    cycling: "Cycling",
    curated: "Curated",
  };
  return map[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

// ─── Duration format ───────────────────────────────────────────────────────────

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Placeholder gradient ──────────────────────────────────────────────────────

const GRADIENTS = [
  "from-[#F5E6C8] to-[#E8C98A]",
  "from-[#F5D5C8] to-[#E8A08A]",
  "from-[#D5C8F5] to-[#A08AE8]",
  "from-[#C8F5D5] to-[#8AE8A0]",
  "from-[#C8E0F5] to-[#8AC0E8]",
];

function gradientFor(title: string) {
  return GRADIENTS[title.charCodeAt(0) % GRADIENTS.length];
}

// ─── Route card ────────────────────────────────────────────────────────────────

function RouteCard({ route }: { route: UIRoute }) {
  const duration = formatDuration(route.estimatedMinutes);

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-gold/40 transition-all flex overflow-hidden">
      {/* Cover image */}
      <div className="w-40 shrink-0 relative overflow-hidden">
        {route.coverImage ? (
          <Image
            src={route.coverImage}
            alt={route.title}
            fill
            className="object-cover"
            sizes="160px"
          />
        ) : (
          <div className={`w-full h-full bg-linear-to-br ${gradientFor(route.title)} flex items-center justify-center`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-5 flex flex-col justify-between min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-bold text-text leading-tight">{route.title}</h3>
              <StatusBadge status={route.status} />
              {route.featured && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold/15 text-gold">
                  ★ Featured
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                {route.city}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                {routeTypeLabel(route.routeType)}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                {route.stopsCount} {route.stopsCount === 1 ? "stop" : "stops"}
              </span>
              {duration && (
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {duration}
                </span>
              )}
            </div>

            {/* Summary */}
            {route.summary && (
              <p className="text-sm text-muted mt-2 line-clamp-1">{route.summary}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4">
          <Link
            href={`/routes/${route.id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main client component ─────────────────────────────────────────────────────

interface RoutesClientProps {
  routes: UIRoute[];
  cities: string[];
}

export default function RoutesClient({ routes, cities }: RoutesClientProps) {
  const [search,     setSearch]     = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = routes.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.routeType.toLowerCase().includes(q);

    const matchesCity   = cityFilter   === "all" || r.city   === cityFilter;
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;

    return matchesSearch && matchesCity && matchesStatus;
  });

  const hasActiveFilters = cityFilter !== "all" || statusFilter !== "all" || search !== "";

  function clearFilters() {
    setSearch("");
    setCityFilter("all");
    setStatusFilter("all");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl flex flex-col gap-6">

      {/* ── Top action row: search + add button ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-60 max-w-sm">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search routes…"
            className="w-full rounded-xl border border-border bg-white pl-11 pr-5 py-3 text-base text-text placeholder:text-[#B0AAA3] focus:outline-none focus:ring-2 focus:border-gold focus:ring-gold/20 transition"
          />
        </div>
        <Link
          href="/routes/new"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors whitespace-nowrap"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add route
        </Link>
      </div>

      {/* ── Filters row ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-muted mr-1">Filter by:</span>

          {/* City filter */}
          {cities.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="rounded-xl border border-border bg-white px-4 py-3.5 text-base text-text focus:outline-none focus:ring-2 focus:border-gold focus:ring-gold/20 transition appearance-none cursor-pointer"
            >
              <option value="all">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-white px-4 py-3.5 text-base text-text focus:outline-none focus:ring-2 focus:border-gold focus:ring-gold/20 transition appearance-none cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-muted hover:text-text transition-colors px-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Result count */}
        <p className="text-sm text-muted">
          {filtered.length === routes.length
            ? `${routes.length} ${routes.length === 1 ? "route" : "routes"}`
            : `${filtered.length} of ${routes.length} routes`}
        </p>
      </div>

      {/* ── Routes list ── */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filtered.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      ) : routes.length === 0 ? (
        /* Empty state — no routes exist yet */
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">No routes yet</h3>
            <p className="text-base text-muted mt-2 max-w-sm">
              Routes are curated journeys that guide app users through a series of places.
              Create your first route to get started.
            </p>
          </div>
          <Link
            href="/routes/new"
            className="px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors"
          >
            Add first route
          </Link>
        </div>
      ) : (
        /* Empty state — filters returned nothing */
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-16 flex flex-col items-center gap-4 text-center">
          <p className="text-base font-semibold text-text">No routes match your search</p>
          <p className="text-sm text-muted">Try adjusting your filters or search term.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-semibold text-gold hover:text-gold-dark transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}