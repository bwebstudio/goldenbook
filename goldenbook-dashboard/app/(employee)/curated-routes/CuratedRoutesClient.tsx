"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "@/lib/i18n";
import {
  fetchCuratedRoutes,
  generateEditorialRoute,
  deactivateRoute,
} from "@/lib/api/curated-routes";
import type { CuratedRouteDTO } from "@/lib/api/curated-routes";

// ─── Constants ──────────────────────────────────────────────────────────────

const CITIES = [
  { value: "all", labelEn: "All cities", labelPt: "Todas as cidades" },
  { value: "porto", labelEn: "Porto", labelPt: "Porto" },
  { value: "lisboa", labelEn: "Lisboa", labelPt: "Lisboa" },
  { value: "algarve", labelEn: "Algarve", labelPt: "Algarve" },
  { value: "madeira", labelEn: "Madeira", labelPt: "Madeira" },
];

const GENERATE_CITIES = CITIES.filter((c) => c.value !== "all");

type RouteTypeFilter = "all" | "editorial" | "sponsored";
type ActiveFilter = "all" | "active" | "expired";

const filterSelectClass =
  "rounded-xl border border-border bg-white px-4 py-3 text-base text-text focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition appearance-none cursor-pointer w-full sm:min-w-[160px] sm:w-auto";

// ─── Labels (bilingual) ─────────────────────────────────────────────────────

function useLabels() {
  const { locale } = useLocale();
  const isPt = locale === "pt";
  return {
    title: isPt ? "Rotas Curadas" : "Curated Routes",
    subtitle: isPt
      ? "Gerir rotas editoriais e patrocinadas"
      : "Manage editorial and sponsored routes",
    allTypes: isPt ? "Todos os tipos" : "All types",
    editorial: isPt ? "Editorial" : "Editorial",
    sponsored: isPt ? "Patrocinada" : "Sponsored",
    allStatuses: isPt ? "Todos os estados" : "All statuses",
    active: isPt ? "Ativa" : "Active",
    expired: isPt ? "Expirada" : "Expired",
    clearFilters: isPt ? "Limpar filtros" : "Clear filters",
    showing: isPt ? "A mostrar" : "Showing",
    of: isPt ? "de" : "of",
    routes: isPt ? "rotas" : "routes",
    generateRoute: isPt ? "Gerar Rota" : "Generate Route",
    generating: isPt ? "A gerar..." : "Generating...",
    selectCity: isPt ? "Selecionar cidade" : "Select city",
    deactivate: isPt ? "Desativar" : "Deactivate",
    deactivating: isPt ? "A desativar..." : "Deactivating...",
    template: isPt ? "Modelo" : "Template",
    stops: isPt ? "Paragens" : "Stops",
    noRoutes: isPt ? "Nenhuma rota encontrada" : "No routes found",
    noRoutesDesc: isPt
      ? "Nenhuma rota curada corresponde aos filtros. Tente gerar uma nova rota."
      : "No curated routes match your filters. Try generating a new route.",
    noRoutesYet: isPt ? "Nenhuma rota ainda" : "No routes yet",
    noRoutesYetDesc: isPt
      ? "Comece por gerar a primeira rota curada."
      : "Get started by generating your first curated route.",
    errorGenerate: isPt
      ? "Falha ao gerar rota. Tente novamente."
      : "Failed to generate route. Please try again.",
    errorDeactivate: isPt
      ? "Falha ao desativar rota. Tente novamente."
      : "Failed to deactivate route. Please try again.",
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isExpired(route: CuratedRouteDTO): boolean {
  return !route.isActive || new Date(route.expiresAt) < new Date();
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  initialRoutes: CuratedRouteDTO[];
}

export default function CuratedRoutesClient({ initialRoutes }: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const labels = useLabels();

  const [routes, setRoutes] = useState(initialRoutes);
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<RouteTypeFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCity, setGenerateCity] = useState("");
  const [generating, setGenerating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return routes.filter((r) => {
      const matchesCity = cityFilter === "all" || r.citySlug === cityFilter;
      const matchesType = typeFilter === "all" || r.routeType === typeFilter;
      let matchesActive = true;
      if (activeFilter === "active") matchesActive = r.isActive && !isExpired(r);
      if (activeFilter === "expired") matchesActive = isExpired(r);
      return matchesCity && matchesType && matchesActive;
    });
  }, [routes, cityFilter, typeFilter, activeFilter]);

  const hasActiveFilters =
    cityFilter !== "all" || typeFilter !== "all" || activeFilter !== "all";

  function clearFilters() {
    setCityFilter("all");
    setTypeFilter("all");
    setActiveFilter("all");
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!generateCity) return;
    setGenerating(true);
    setError(null);
    try {
      const newRoute = await generateEditorialRoute(generateCity);
      setRoutes((prev) => [newRoute, ...prev]);
      setGenerateOpen(false);
      setGenerateCity("");
    } catch {
      setError(labels.errorGenerate);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeactivate(id: string) {
    setDeactivatingId(id);
    setError(null);
    try {
      await deactivateRoute(id);
      setRoutes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: false } : r))
      );
    } catch {
      setError(labels.errorDeactivate);
    } finally {
      setDeactivatingId(null);
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = routes.length;
    const editorial = routes.filter((r) => r.routeType === "editorial").length;
    const sponsored = routes.filter((r) => r.routeType === "sponsored").length;
    const active = routes.filter((r) => r.isActive && !isExpired(r)).length;
    return { total, editorial, sponsored, active };
  }, [routes]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const cityLabel = (slug: string) =>
    CITIES.find((c) => c.value === slug)?.[locale === "pt" ? "labelPt" : "labelEn"] ?? slug;

  return (
    <div className="w-full max-w-5xl flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text">{labels.title}</h1>
        <p className="text-base text-muted mt-1">{labels.subtitle}</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: labels.routes, value: stats.total, color: "text-text" },
          { label: labels.editorial, value: stats.editorial, color: "text-blue-600" },
          { label: labels.sponsored, value: stats.sponsored, color: "text-gold" },
          { label: labels.active, value: stats.active, color: "text-emerald-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-border px-4 py-3 flex flex-col items-center"
          >
            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
            <span className="text-sm text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <p className="text-sm text-muted">
          {labels.showing}{" "}
          <span className="font-semibold text-text">{filtered.length}</span> {labels.of}{" "}
          <span className="font-semibold text-text">{routes.length}</span> {labels.routes}
        </p>

        {/* Generate button / dropdown */}
        <div className="relative">
          {generateOpen ? (
            <div className="flex items-center gap-2">
              <select
                value={generateCity}
                onChange={(e) => setGenerateCity(e.target.value)}
                className={filterSelectClass}
              >
                <option value="">{labels.selectCity}</option>
                {GENERATE_CITIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {locale === "pt" ? c.labelPt : c.labelEn}
                  </option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={!generateCity || generating}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
              >
                {generating ? labels.generating : labels.generateRoute}
              </button>
              <button
                onClick={() => {
                  setGenerateOpen(false);
                  setGenerateCity("");
                }}
                className="px-3 py-3 rounded-xl border border-border text-muted hover:text-text transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setGenerateOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors whitespace-nowrap w-full sm:w-auto cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {labels.generateRoute}
            </button>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* City */}
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className={filterSelectClass}
        >
          {CITIES.map((c) => (
            <option key={c.value} value={c.value}>
              {locale === "pt" ? c.labelPt : c.labelEn}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as RouteTypeFilter)}
          className={filterSelectClass}
        >
          <option value="all">{labels.allTypes}</option>
          <option value="editorial">{labels.editorial}</option>
          <option value="sponsored">{labels.sponsored}</option>
        </select>

        {/* Active */}
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          className={filterSelectClass}
        >
          <option value="all">{labels.allStatuses}</option>
          <option value="active">{labels.active}</option>
          <option value="expired">{labels.expired}</option>
        </select>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="text-sm font-semibold text-muted hover:text-gold underline transition-colors cursor-pointer self-start -mt-3"
        >
          {labels.clearFilters}
        </button>
      )}

      {/* Route cards */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filtered.map((route) => {
            const expired = isExpired(route);
            const stopNames = route.stops
              .slice(0, 3)
              .map((s) => s.placeName)
              .join(" / ");
            const moreStops = route.stops.length > 3 ? ` +${route.stops.length - 3}` : "";

            return (
              <div
                key={route.id}
                className={`bg-white rounded-xl border shadow-sm px-5 py-4 flex flex-col gap-3 transition-colors ${
                  expired ? "border-border/60 opacity-75" : "border-border"
                }`}
              >
                {/* Top row: title + badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-text leading-tight">
                      {route.title}
                    </h3>

                    {/* City badge */}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#F5F1EB] text-text">
                      {cityLabel(route.citySlug)}
                    </span>

                    {/* Type badge */}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                        route.routeType === "sponsored"
                          ? "bg-gold/15 text-gold"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {route.routeType === "sponsored" ? labels.sponsored : labels.editorial}
                    </span>

                    {/* Status badge */}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                        expired
                          ? "bg-gray-100 text-gray-500"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {expired ? labels.expired : labels.active}
                    </span>
                  </div>

                  {/* Actions */}
                  {!expired && (
                    <button
                      onClick={() => handleDeactivate(route.id)}
                      disabled={deactivatingId === route.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    >
                      {deactivatingId === route.id
                        ? labels.deactivating
                        : labels.deactivate}
                    </button>
                  )}
                </div>

                {/* Summary */}
                {route.summary && (
                  <p className="text-sm text-muted line-clamp-2">{route.summary}</p>
                )}

                {/* Details row */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
                  {route.templateType && (
                    <span>
                      <span className="font-medium text-text">{labels.template}:</span>{" "}
                      {route.templateType}
                    </span>
                  )}

                  <span>
                    <span className="font-medium text-text">{labels.stops}:</span>{" "}
                    {stopNames}
                    {moreStops && (
                      <span className="text-muted">{moreStops}</span>
                    )}
                  </span>

                  <span>
                    {formatDate(route.startsAt)} &rarr; {formatDate(route.expiresAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-sm px-4 py-12 sm:px-8 sm:py-20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">
              {hasActiveFilters ? labels.noRoutes : labels.noRoutesYet}
            </h3>
            <p className="text-base text-muted mt-2 max-w-xs">
              {hasActiveFilters ? labels.noRoutesDesc : labels.noRoutesYetDesc}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white cursor-pointer"
            >
              {labels.clearFilters}
            </button>
          ) : (
            <button
              onClick={() => setGenerateOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors cursor-pointer"
            >
              {labels.generateRoute}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
