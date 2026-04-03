"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import {
  fetchBusinessMe,
  fetchBusinessOverview,
  fetchBusinessAnalytics,
  type BusinessMeResponse,
  type BusinessOverview,
  type BusinessAnalytics,
} from "@/lib/api/business-portal";
import { fetchMyRecommendations, type Recommendation } from "@/lib/api/recommendations";

export default function PortalOverview() {
  const t = useT();
  const [me, setMe] = useState<BusinessMeResponse | null>(null);
  const [overview, setOverview] = useState<BusinessOverview | null>(null);
  const [analytics, setAnalytics] = useState<BusinessAnalytics | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchBusinessMe(),
      fetchBusinessOverview(),
      fetchBusinessAnalytics("30d").catch(() => null),
      fetchMyRecommendations().catch(() => [] as Recommendation[]),
    ])
      .then(([m, o, a, r]) => { setMe(m); setOverview(o); setAnalytics(a); setRecommendations(r); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const products = t.promote.products as Record<string, { label: string }>;
  const ov = t.overview;
  const isPt = t.common.save === "Guardar alterações";

  return (
    <div className="flex flex-col gap-5">
      {/* ── 1. Compact hero ── */}
      <div className="bg-gradient-to-r from-[#222D52] to-[#2E3D6B] rounded-xl px-5 py-4 md:px-7 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-gold text-[9px] font-bold uppercase tracking-[0.15em] mb-0.5">{ov.yourPresence}</p>
          <h1 className="text-lg md:text-xl font-bold text-white leading-tight truncate">{me?.place?.name ?? ""}</h1>
          {me?.place?.cityName && <p className="text-white/35 text-xs mt-0.5">{me.place.cityName} · {ov.listingNote}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/portal/listing" className="px-3.5 py-1.5 rounded-lg bg-gold text-[#222D52] text-xs font-semibold hover:bg-[#DEC49A] transition-colors">
            {ov.editListing}
          </Link>
          <Link href="/portal/promote" className="px-3.5 py-1.5 rounded-lg border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition-colors">
            {ov.boostVisibility}
          </Link>
        </div>
      </div>

      {/* ── 2. Performance snapshot ── */}
      <div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] mb-2">{ov.performance}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <PerfCard icon={<EyeIcon />} value={analytics?.views} prevValue={(analytics as any)?.prevViews} label={t.metrics.views} trendLabel={t.common.thisWeek} />
          <PerfCard icon={<LinkIcon />} value={analytics?.websiteClicks} prevValue={(analytics as any)?.prevWebsiteClicks} label={t.metrics.websiteClicks} trendLabel={t.common.thisWeek} />
          <PerfCard icon={<MapIcon />} value={analytics?.directions} prevValue={(analytics as any)?.prevDirections} label={t.metrics.directions} trendLabel={t.common.thisWeek} />
          <PerfCard icon={<CalIcon />} value={analytics?.reservations} prevValue={(analytics as any)?.prevReservations} label={t.metrics.reservations} trendLabel={t.common.thisWeek} />
        </div>
      </div>

      {/* ── Recommendations ── */}
      {recommendations.length > 0 && (() => {
        const rc = t.recs as Record<string, string>;
        const sectionLabels: Record<string, string> = {
          golden_picks: products.golden_picks?.label ?? "Golden Picks",
          now: products.now?.label ?? "Recommended at the right moment",
          hidden_gems: products.hidden_gems?.label ?? "Hidden Gems",
          search_priority: products.search_priority?.label ?? "Search Priority",
          category_featured: products.category_featured?.label ?? "Category Spotlight",
          concierge: products.concierge?.label ?? "Concierge Recommendation",
          new_on_goldenbook: products.new_on_goldenbook?.label ?? "New on Goldenbook",
          extended_description: products.extended_description?.label ?? "Extended Description",
          extra_images: products.extra_images?.label ?? "Extra Images",
        };
        const bucketLabels: Record<string, string> = {
          morning: isPt ? "manhã" : "morning",
          lunch: isPt ? "almoço" : "lunch",
          afternoon: isPt ? "tarde" : "afternoon",
          evening: isPt ? "noite" : "evening",
          night: isPt ? "noite" : "night",
          all_day: isPt ? "dia inteiro" : "all day",
        };
        function fill(tpl: string, r: typeof recommendations[0]): string {
          return tpl
            .replace("{section}", sectionLabels[r.section ?? ""] ?? r.section ?? "")
            .replace("{value}", String(r.value ?? ""))
            .replace("{extra}", r.rule === "time_bucket" ? (bucketLabels[r.extra ?? ""] ?? r.extra ?? "") : (r.extra ?? ""));
        }
        return (
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] mb-2">{rc.title}</p>
            <div className="space-y-2">
              {recommendations.map((r, i) => (
                <div key={i} className="bg-white rounded-xl border border-border px-4 py-3 flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    r.type === "demand" ? "bg-red-50 text-red-500" :
                    r.type === "timing" ? "bg-amber-50 text-amber-500" :
                    r.type === "opportunity" ? "bg-emerald-50 text-emerald-500" :
                    "bg-gold/10 text-gold"
                  }`}>
                    {r.type === "demand" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    ) : r.type === "timing" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text">{fill(rc[`${r.rule}_title`] ?? r.rule, r)}</p>
                    <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{fill(rc[`${r.rule}_desc`] ?? "", r)}</p>
                  </div>
                  {r.action === "promote" && (
                    <Link href="/portal/promote" className="text-[10px] font-semibold text-gold hover:text-gold-dark shrink-0 mt-1">
                      {rc.view} →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── 3. Visibility status — dynamic from active campaigns ── */}
      <div className="bg-white rounded-xl border border-border p-4 md:p-5">
        <p className="text-xs font-bold text-text mb-3">{ov.whereYouAppear}</p>
        {(() => {
          const activeSurfaces = new Set(
            (overview?.activeCampaigns ?? [])
              .filter((c) => c.status === "active" || c.status === "activated" || c.status === "paid")
              .map((c) => c.placement_type)
          );
          const surfaces = [
            { key: "golden_picks", label: (products.golden_picks as { label: string }).label },
            { key: "now", label: (products.now as { label: string }).label },
            { key: "search_priority", label: (products.search_priority as { label: string }).label },
            { key: "category_featured", label: (products.category_featured as { label: string }).label },
            { key: "hidden_gems", label: (products.hidden_gems as { label: string }).label },
            { key: "concierge", label: (products.concierge as { label: string }).label },
          ];
          const activeSurfaceItems = surfaces.filter((s) => activeSurfaces.has(s.key));
          const inactiveSurfaceItems = surfaces.filter((s) => !activeSurfaces.has(s.key));

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-medium text-muted uppercase tracking-wider mb-1.5">{ov.activeIn}</p>
                <div className="space-y-1">
                  <VItem active label={ov.searchResults} />
                  <VItem active label={ov.categoryPage} />
                  <VItem active label={ov.editorialPage} />
                  {activeSurfaceItems.map((s) => <VItem key={s.key} active label={s.label} />)}
                </div>
              </div>
              {inactiveSurfaceItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted uppercase tracking-wider mb-1.5">{ov.notFeaturedIn}</p>
                  <div className="space-y-1">
                    {inactiveSurfaceItems.map((s) => (
                      <div key={s.key} className="flex items-center justify-between">
                        <VItem label={s.label} />
                        <Link href="/portal/promote" className="text-[9px] font-semibold text-gold hover:text-gold-dark">
                          {ov.boostVisibility} →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── 4. Visibility opportunities ── */}
      <div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] mb-2">{ov.opportunities}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <OpCard
            title={(products.golden_picks as { label: string }).label}
            desc={ov.opportunityPicks}
            cta={ov.boostVisibility}
          />
          <OpCard
            title={(products.now as { label: string }).label}
            desc={ov.opportunityNow}
            cta={ov.boostVisibility}
          />
          <OpCard
            title={(products.search_priority as { label: string }).label}
            desc={ov.opportunitySearch}
            cta={ov.boostVisibility}
          />
        </div>
      </div>

      {/* ── 5. Active promotions ── */}
      {overview && overview.activeCampaigns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-[0.1em]">{ov.activePromotions}</p>
            <Link href="/portal/campaigns" className="text-[11px] font-medium text-gold hover:underline">{t.common.viewAll}</Link>
          </div>
          <div className="space-y-1.5">
            {overview.activeCampaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-lg border border-border px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text">{products[c.placement_type]?.label ?? c.placement_type}</p>
                  <p className="text-[10px] text-muted">
                    {c.starts_at && new Date(c.starts_at).toLocaleDateString()}
                    {c.starts_at && c.ends_at && " — "}
                    {c.ends_at && new Date(c.ends_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">{t.status.active}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. Quick actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <QCard href="/portal/analytics" title={ov.quickActions.analytics} desc={ov.quickActions.analyticsDesc} accent />
        <QCard href="/portal/promote" title={ov.quickActions.boost} desc={ov.quickActions.boostDesc} />
        <QCard href="/portal/listing" title={ov.quickActions.update} desc={ov.quickActions.updateDesc} />
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function PerfCard({ icon, value, prevValue, label, trendLabel }: { icon: React.ReactNode; value?: number; prevValue?: number; label: string; trendLabel: string }) {
  const has = value !== undefined && value > 0;
  const hasTrend = has && prevValue !== undefined && prevValue > 0;
  const delta = hasTrend ? Math.round(((value! - prevValue!) / prevValue!) * 100) : null;
  return (
    <div className="bg-white rounded-lg border border-border px-3.5 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-muted">{icon}</span>
      </div>
      <p className={`text-xl font-bold tracking-tight ${has ? "text-text" : "text-muted/25"}`}>
        {has ? value!.toLocaleString() : "—"}
      </p>
      <p className="text-[9px] text-muted mt-0.5">{label}</p>
      {delta !== null && (
        <p className={`text-[9px] font-semibold mt-1 ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% {trendLabel}
        </p>
      )}
    </div>
  );
}

function VItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {active ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D2B68A" strokeWidth="2"><path d="M12 9v4m0 4h.01" /><circle cx="12" cy="12" r="10" strokeWidth="1.5" /></svg>
      )}
      <span className={`text-xs ${active ? "text-text" : "text-muted"}`}>{label}</span>
    </div>
  );
}

function OpCard({ title, desc, cta }: { title: string; desc: string; cta: string }) {
  return (
    <Link href="/portal/promote" className="group bg-white rounded-xl border border-border p-4 hover:border-gold/30 hover:shadow-sm transition-all">
      <p className="text-sm font-bold text-text group-hover:text-gold transition-colors">{title}</p>
      <p className="text-[10px] text-muted mt-1.5 leading-relaxed line-clamp-2">{desc}</p>
      <p className="text-[10px] font-semibold text-gold mt-2.5 flex items-center gap-1">
        {cta}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
      </p>
    </Link>
  );
}

function QCard({ href, title, desc, accent }: { href: string; title: string; desc: string; accent?: boolean }) {
  return (
    <Link href={href} className={`group rounded-lg border px-4 py-3 transition-all hover:shadow-sm ${accent ? "bg-gold/5 border-gold/15 hover:border-gold/30" : "bg-white border-border hover:border-gold/20"}`}>
      <p className="text-xs font-bold text-text group-hover:text-gold transition-colors">{title}</p>
      <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{desc}</p>
    </Link>
  );
}

/* ── Icons ── */
function EyeIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
function LinkIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>; }
function MapIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>; }
function CalIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
