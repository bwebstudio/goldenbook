"use client";

import { useMemo, useState, useCallback } from "react";
import { useLocale } from "@/lib/i18n";
import {
  generateEditorialRoute,
  deactivateRoute,
  fetchRouteAvailability,
  createRouteFromScratch,
  updateRoute,
  fetchCuratedRoutes,
} from "@/lib/api/curated-routes";
import type { CuratedRouteDTO } from "@/lib/api/curated-routes";
import { isAdmin } from "@/lib/auth/permissions";
import type { DashboardRole } from "@/types/auth";
import { fetchAdminPlacesList } from "@/lib/api/places";

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
    title: isPt ? "Rotas" : "Routes",
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
      ? "Nenhuma rota corresponde aos filtros. Tente gerar uma nova rota."
      : "No routes match your filters. Try generating a new route.",
    noRoutesYet: isPt ? "Nenhuma rota ainda" : "No routes yet",
    noRoutesYetDesc: isPt
      ? "Comece por gerar a primeira rota."
      : "Get started by generating your first route.",
    errorGenerate: isPt
      ? "Falha ao gerar rota. Tente novamente."
      : "Failed to generate route. Please try again.",
    errorDeactivate: isPt
      ? "Falha ao desativar rota. Tente novamente."
      : "Failed to deactivate route. Please try again.",
    replaceWarning: isPt
      ? "Isto ir\u00e1 substituir a rota editorial mais antiga ativa nesta cidade."
      : "This will replace the oldest active editorial route in this city.",
    // Admin-only labels
    createRoute: isPt ? "Criar Rota" : "Create Route",
    editRoute: isPt ? "Editar" : "Edit",
    save: isPt ? "Guardar" : "Save",
    saving: isPt ? "A guardar..." : "Saving...",
    cancel: isPt ? "Cancelar" : "Cancel",
    routeTitle: isPt ? "Título" : "Title",
    routeSummary: isPt ? "Resumo" : "Summary",
    city: isPt ? "Cidade" : "City",
    routeType: isPt ? "Tipo" : "Type",
    stop: isPt ? "Paragem" : "Stop",
    selectPlace: isPt ? "Selecionar estabelecimento" : "Select place",
    editorialNote: isPt ? "Nota editorial" : "Editorial note",
    errorSave: isPt ? "Falha ao guardar. Tente novamente." : "Failed to save. Please try again.",
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

// ─── Sponsored star icon ────────────────────────────────────────────────────

function SponsoredStar() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="#B8964E"
      stroke="#B8964E"
      strokeWidth="1.5"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  initialRoutes: CuratedRouteDTO[];
  userRole: DashboardRole;
}

export default function RoutesClient({ initialRoutes, userRole }: Props) {
  const { locale } = useLocale();
  const labels = useLabels();
  const isSuperAdmin = isAdmin(userRole);

  const [routes, setRoutes] = useState(initialRoutes);
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<RouteTypeFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCity, setGenerateCity] = useState("");
  const [generating, setGenerating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replaceWarning, setReplaceWarning] = useState(false);

  // Admin: create/edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CuratedRouteDTO | null>(null); // null = create new
  const [modalTitle, setModalTitle] = useState("");
  const [modalSummary, setModalSummary] = useState("");
  const [modalCity, setModalCity] = useState("");
  const [modalType, setModalType] = useState<"editorial" | "sponsored">("editorial");
  const [modalStops, setModalStops] = useState<Array<{ placeId: string; editorialNote: string }>>([
    { placeId: "", editorialNote: "" },
    { placeId: "", editorialNote: "" },
    { placeId: "", editorialNote: "" },
  ]);
  const [modalSaving, setModalSaving] = useState(false);
  const [allPlaces, setAllPlaces] = useState<Array<{ id: string; name: string; slug: string; city_name: string }>>([]);
  const [placesLoaded, setPlacesLoaded] = useState(false);

  const loadPlaces = useCallback(async () => {
    if (placesLoaded) return;
    try {
      const places = await fetchAdminPlacesList();
      setAllPlaces(places.map((p: any) => ({ id: p.id, name: p.name, slug: p.slug, city_name: p.city_name })));
      setPlacesLoaded(true);
    } catch { /* ignore */ }
  }, [placesLoaded]);

  function openCreateModal() {
    setEditingRoute(null);
    setModalTitle("");
    setModalSummary("");
    setModalCity("");
    setModalType("editorial");
    setModalStops([
      { placeId: "", editorialNote: "" },
      { placeId: "", editorialNote: "" },
      { placeId: "", editorialNote: "" },
    ]);
    setModalOpen(true);
    loadPlaces();
  }

  function openEditModal(route: CuratedRouteDTO) {
    setEditingRoute(route);
    setModalTitle(route.title);
    setModalSummary(route.summary ?? "");
    setModalCity(route.citySlug);
    setModalType(route.routeType);
    setModalStops(
      route.stops.length > 0
        ? route.stops.map((s) => ({ placeId: s.placeId, editorialNote: s.editorialNote ?? "" }))
        : [{ placeId: "", editorialNote: "" }, { placeId: "", editorialNote: "" }, { placeId: "", editorialNote: "" }]
    );
    setModalOpen(true);
    loadPlaces();
  }

  async function handleModalSave() {
    setModalSaving(true);
    setError(null);
    try {
      const validStops = modalStops
        .map((s, i) => ({ placeId: s.placeId, stopOrder: i + 1, editorialNote: s.editorialNote || null }))
        .filter((s) => s.placeId);

      if (editingRoute) {
        // Update
        await updateRoute(editingRoute.id, {
          title: modalTitle,
          summary: modalSummary || null,
          stops: validStops,
        });
      } else {
        // Create
        await createRouteFromScratch({
          citySlug: modalCity,
          routeType: modalType,
          title: modalTitle,
          summary: modalSummary || null,
          stops: validStops,
        });
      }
      // Reload routes
      const fresh = await fetchCuratedRoutes();
      setRoutes(fresh);
      setModalOpen(false);
    } catch {
      setError(labels.errorSave);
    } finally {
      setModalSaving(false);
    }
  }

  function canEdit(route: CuratedRouteDTO): boolean {
    return isSuperAdmin && !isExpired(route);
  }

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

  async function handleCitySelect(city: string) {
    setGenerateCity(city);
    setReplaceWarning(false);
    if (!city) return;
    try {
      const availability = await fetchRouteAvailability(city);
      if (availability.editorial >= 2) {
        setReplaceWarning(true);
      }
    } catch {
      // non-critical — just skip the warning
    }
  }

  async function handleGenerate() {
    if (!generateCity) return;
    setGenerating(true);
    setError(null);
    try {
      const newRoute = await generateEditorialRoute(generateCity);
      setRoutes((prev) => [newRoute, ...prev]);
      setGenerateOpen(false);
      setGenerateCity("");
      setReplaceWarning(false);
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

  // ── Permission helpers ─────────────────────────────────────────────────────

  function canDeactivate(route: CuratedRouteDTO): boolean {
    if (isExpired(route)) return false;
    if (isSuperAdmin) return true;
    // Editors can only deactivate editorial routes
    return route.routeType === "editorial";
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
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={generateCity}
                  onChange={(e) => handleCitySelect(e.target.value)}
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
                    setReplaceWarning(false);
                  }}
                  className="px-3 py-3 rounded-xl border border-border text-muted hover:text-text transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {replaceWarning && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {labels.replaceWarning}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGenerateOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors whitespace-nowrap cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {labels.generateRoute}
              </button>
              {isSuperAdmin && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-text text-base font-semibold hover:border-gold/50 hover:text-gold transition-colors whitespace-nowrap cursor-pointer"
                >
                  {labels.createRoute}
                </button>
              )}
            </div>
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
            const isSponsored = route.routeType === "sponsored";
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
                    <h3 className="text-lg font-bold text-text leading-tight flex items-center gap-1.5">
                      {isSponsored && <SponsoredStar />}
                      {route.title}
                    </h3>

                    {/* City badge */}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#F5F1EB] text-text">
                      {cityLabel(route.citySlug)}
                    </span>

                    {/* Type badge */}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                        isSponsored
                          ? "bg-[#B8964E] text-white"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {isSponsored ? labels.sponsored : labels.editorial}
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
                  <div className="flex items-center gap-2">
                    {canEdit(route) && (
                      <button
                        onClick={() => openEditModal(route)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-text text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {labels.editRoute}
                      </button>
                    )}
                    {canDeactivate(route) && (
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

      {/* ── Create/Edit Modal (admin only) ─────────────────────────────────── */}
      {modalOpen && isSuperAdmin && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-xl font-bold text-text">
                {editingRoute ? labels.editRoute : labels.createRoute}
              </h2>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">{labels.routeTitle}</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border text-base focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  placeholder="Slow Morning by the Sea"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">{labels.routeSummary}</label>
                <textarea
                  value={modalSummary}
                  onChange={(e) => setModalSummary(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-border text-base focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 resize-none"
                />
              </div>

              {/* City + Type (only on create) */}
              {!editingRoute && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">{labels.city}</label>
                    <select
                      value={modalCity}
                      onChange={(e) => setModalCity(e.target.value)}
                      className={filterSelectClass}
                    >
                      <option value="">{labels.selectCity}</option>
                      {GENERATE_CITIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {locale === "pt" ? c.labelPt : c.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">{labels.routeType}</label>
                    <select
                      value={modalType}
                      onChange={(e) => setModalType(e.target.value as "editorial" | "sponsored")}
                      className={filterSelectClass}
                    >
                      <option value="editorial">{labels.editorial}</option>
                      <option value="sponsored">{labels.sponsored}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Stops */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-text">{labels.stops}</label>
                {modalStops.map((stop, idx) => (
                  <div key={idx} className="rounded-xl border border-border p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-gold/10 text-gold text-sm font-bold flex items-center justify-center">{idx + 1}</span>
                      <select
                        value={stop.placeId}
                        onChange={(e) => {
                          const updated = [...modalStops];
                          updated[idx] = { ...updated[idx], placeId: e.target.value };
                          setModalStops(updated);
                        }}
                        className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-gold"
                      >
                        <option value="">{labels.selectPlace}</option>
                        {allPlaces.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.city_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={stop.editorialNote}
                      onChange={(e) => {
                        const updated = [...modalStops];
                        updated[idx] = { ...updated[idx], editorialNote: e.target.value };
                        setModalStops(updated);
                      }}
                      placeholder={labels.editorialNote}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-gold"
                    />
                  </div>
                ))}
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-text transition-colors cursor-pointer"
              >
                {labels.cancel}
              </button>
              <button
                onClick={handleModalSave}
                disabled={modalSaving || !modalTitle || (!editingRoute && !modalCity)}
                className="px-5 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-60"
              >
                {modalSaving ? labels.saving : labels.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
