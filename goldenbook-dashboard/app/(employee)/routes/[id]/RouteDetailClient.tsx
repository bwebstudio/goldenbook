"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { deactivateRoute, fetchRouteById, type CuratedRouteDTO } from "@/lib/api/curated-routes";
import { isAdmin } from "@/lib/auth/permissions";
import { getStorageUrl } from "@/lib/utils/storage";
import type { DashboardRole } from "@/types/auth";

// Route detail view — visible to every dashboard role (admin + editor).
// Admin sees Edit; both admin and editor see Deactivate while the route is
// still active. The backend (requireSuperAdmin on PUT) is the real gate for
// edits — this UI mirrors that rule but does not enforce it on its own.

const CITY_LABELS: Record<string, { en: string; pt: string }> = {
  porto:   { en: "Porto",   pt: "Porto" },
  lisboa:  { en: "Lisboa",  pt: "Lisboa" },
  algarve: { en: "Algarve", pt: "Algarve" },
  madeira: { en: "Madeira", pt: "Madeira" },
};

function isExpired(route: CuratedRouteDTO): boolean {
  if (!route.isActive) return true;
  if (!route.expiresAt) return false;
  return new Date(route.expiresAt) < new Date();
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function useLabels() {
  const { locale } = useLocale();
  const isPt = locale === "pt";
  return {
    locale,
    backToRoutes:  isPt ? "Voltar a rotas"       : "Back to routes",
    editRoute:     isPt ? "Editar"               : "Edit",
    deactivate:    isPt ? "Desativar"            : "Deactivate",
    deactivating:  isPt ? "A desativar..."       : "Deactivating...",
    confirmDeact:  isPt
      ? "Tem a certeza que quer desativar esta rota?"
      : "Are you sure you want to deactivate this route?",
    errorDeact:    isPt ? "Falha ao desativar rota." : "Failed to deactivate route.",
    summary:       isPt ? "Resumo"               : "Summary",
    stops:         isPt ? "Paragens"             : "Stops",
    template:      isPt ? "Modelo"               : "Template",
    active:        isPt ? "Ativa"                : "Active",
    expired:       isPt ? "Expirada"             : "Expired",
    editorial:     isPt ? "Editorial"            : "Editorial",
    sponsored:     isPt ? "Patrocinada"          : "Sponsored",
    city:          isPt ? "Cidade"               : "City",
    type:          isPt ? "Tipo"                 : "Type",
    status:        isPt ? "Estado"               : "Status",
    startsAt:      isPt ? "Início"               : "Starts",
    expiresAt:     isPt ? "Expira"               : "Expires",
    details:       isPt ? "Detalhes"             : "Details",
    editorialNote: isPt ? "Nota editorial"       : "Editorial note",
    noSummary:     isPt ? "Sem resumo."          : "No summary.",
    noStops:       isPt ? "Sem paragens."        : "No stops.",
  };
}

export default function RouteDetailClient({
  initialRoute,
  initialLocale,
  id,
  userRole,
}: {
  initialRoute: CuratedRouteDTO;
  initialLocale: "en" | "pt";
  id: string;
  userRole: DashboardRole;
}) {
  const router = useRouter();
  const labels = useLabels();
  const [route, setRoute] = useState<CuratedRouteDTO>(initialRoute);
  const expired = isExpired(route);
  const isSponsored = route.routeType === "sponsored";
  const canEdit = isAdmin(userRole) && !expired;
  const canDeact = !expired;

  const [deactivating, setDeactivating] = useState(false);
  const [deactivated, setDeactivated] = useState(!route.isActive);
  const [error, setError] = useState<string | null>(null);

  // If the user switches language after the server-rendered fetch, pull
  // fresh translations so the title/summary/stop text all re-localize
  // without a full page reload.
  useEffect(() => {
    if (labels.locale === initialLocale) return;
    let cancelled = false;
    fetchRouteById(id, labels.locale)
      .then((fresh) => {
        if (!cancelled) setRoute(fresh);
      })
      .catch((err) => {
        console.error("[RouteDetail] failed to re-fetch for locale", labels.locale, err);
      });
    return () => { cancelled = true; };
  }, [labels.locale, initialLocale, id]);

  const cityLabel =
    CITY_LABELS[route.citySlug]?.[labels.locale === "pt" ? "pt" : "en"] ?? route.citySlug;

  async function handleDeactivate() {
    if (!window.confirm(labels.confirmDeact)) return;
    setDeactivating(true);
    setError(null);
    try {
      await deactivateRoute(route.id);
      setDeactivated(true);
    } catch {
      setError(labels.errorDeact);
    } finally {
      setDeactivating(false);
    }
  }

  function handleEdit() {
    // Re-use the list page's edit modal rather than duplicating 200 lines of
    // form logic here. The list reads `?edit=<id>` and auto-opens the modal.
    router.push(`/routes?edit=${route.id}`);
  }

  const showDeactivate = canDeact && !deactivated;

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      <Link
        href="/routes"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text transition-colors w-fit"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        {labels.backToRoutes}
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#F5F1EB] text-text">
              {cityLabel}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                isSponsored ? "bg-[#B8964E] text-white" : "bg-blue-50 text-blue-700"
              }`}
            >
              {isSponsored ? labels.sponsored : labels.editorial}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                deactivated || expired ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {deactivated || expired ? labels.expired : labels.active}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-text">{route.title}</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <button
              onClick={handleEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-text text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              {labels.editRoute}
            </button>
          )}
          {showDeactivate && (
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {deactivating ? labels.deactivating : labels.deactivate}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white rounded-2xl border border-border p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetaItem label={labels.city} value={cityLabel} />
        <MetaItem
          label={labels.type}
          value={isSponsored ? labels.sponsored : labels.editorial}
        />
        <MetaItem label={labels.startsAt} value={formatDate(route.startsAt, labels.locale)} />
        <MetaItem label={labels.expiresAt} value={formatDate(route.expiresAt, labels.locale)} />
        {route.templateType && (
          <MetaItem label={labels.template} value={route.templateType} />
        )}
      </div>

      {/* Summary */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-text">{labels.summary}</h2>
        <p className="text-base text-muted whitespace-pre-wrap">
          {route.summary ?? labels.noSummary}
        </p>
      </section>

      {/* Stops */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-text">{labels.stops}</h2>
        {route.stops.length === 0 ? (
          <p className="text-sm text-muted">{labels.noStops}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {route.stops
              .slice()
              .sort((a, b) => a.stopOrder - b.stopOrder)
              .map((stop) => {
                const heroUrl = getStorageUrl(stop.heroImage?.bucket, stop.heroImage?.path);
                return (
                  <li
                    key={`${stop.placeId}-${stop.stopOrder}`}
                    className="bg-white rounded-xl border border-border p-4 flex gap-4"
                  >
                    <span className="w-8 h-8 rounded-full bg-gold/10 text-gold text-sm font-bold flex items-center justify-center shrink-0">
                      {stop.stopOrder}
                    </span>
                    {heroUrl ? (
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                        <Image
                          src={heroUrl}
                          alt={stop.placeName}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text truncate">{stop.placeName}</p>
                      {stop.shortDescription && (
                        <p className="text-sm text-muted line-clamp-2 mt-0.5">
                          {stop.shortDescription}
                        </p>
                      )}
                      {stop.editorialNote && (
                        <p className="text-sm text-text italic mt-2 border-l-2 border-gold/40 pl-3">
                          <span className="font-medium not-italic text-muted">
                            {labels.editorialNote}:
                          </span>{" "}
                          {stop.editorialNote}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
          </ol>
        )}
      </section>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-text truncate">{value}</span>
    </div>
  );
}
