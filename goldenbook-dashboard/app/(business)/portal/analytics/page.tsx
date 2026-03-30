"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { fetchBusinessAnalytics, fetchBusinessPurchases, type BusinessAnalytics, type PurchaseDTO } from "@/lib/api/business-portal";

type Period = "7d" | "30d" | "90d";

const ico: Record<string, ReactNode> = {
  eye: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  heart: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  map: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>,
  link: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  cal: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
};

export default function PortalAnalytics() {
  const t = useT();
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<BusinessAnalytics | null>(null);
  const [purchases, setPurchases] = useState<PurchaseDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const result = await fetchBusinessAnalytics(p);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  useEffect(() => {
    fetchBusinessPurchases().then(setPurchases).catch(() => {});
  }, []);

  const handlePeriod = (p: Period) => { setPeriod(p); };

  const periods: [Period, string][] = [["7d", t.analytics.period7d], ["30d", t.analytics.period30d], ["90d", t.analytics.period90d]];

  const hasData = data && (data.views > 0 || data.websiteClicks > 0 || data.directions > 0 || data.reservations > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header + period */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">{t.analytics.title}</h1>
          <p className="text-xs text-muted mt-0.5">{t.analytics.subtitle}</p>
        </div>
        <div className="flex items-center gap-0.5 bg-white rounded-lg border border-border p-0.5">
          {periods.map(([key, label]) => (
            <button key={key} onClick={() => handlePeriod(key)} className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${period === key ? "bg-gold/10 text-gold" : "text-muted hover:text-text"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics row */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MCard icon="eye" label={t.metrics.views} value={data?.views} />
            <MCard icon="link" label={t.metrics.websiteClicks} value={data?.websiteClicks} />
            <MCard icon="map" label={t.metrics.directions} value={data?.directions} />
            <MCard icon="cal" label={t.metrics.reservations} value={data?.reservations} />
          </div>

          {/* Summary or empty state */}
          {hasData ? (
            <div className="bg-white rounded-xl border border-border p-5 md:p-6">
              <h2 className="text-sm font-bold text-text mb-4">{t.analytics.performanceOverview}</h2>
              <div className="space-y-3">
                <PRow label={t.analytics.profileViews} value={data!.views} dot="bg-gold" />
                <PRow label={t.metrics.websiteClicks} value={data!.websiteClicks} dot="bg-purple-500" />
                <PRow label={t.analytics.directionRequests} value={data!.directions} dot="bg-blue-500" />
                <PRow label={t.analytics.reservationTaps} value={data!.reservations} dot="bg-amber-500" />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border p-8 md:p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D2B68A" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
              </div>
              <p className="text-sm font-bold text-text">{t.analytics.detailedComingSoon}</p>
              <p className="text-xs text-muted mt-1.5 max-w-sm mx-auto leading-relaxed">{t.analytics.detailedComingSoonDesc}</p>
            </div>
          )}
        </>
      )}

      {/* Campaign spending */}
      {purchases.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="text-sm font-bold text-text mb-3">Your Placements</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-[10px] text-muted">Total Spent</p>
              <p className="text-lg font-bold text-text">
                &euro;{purchases.reduce((s, p) => s + (parseFloat(p.final_price) || 0), 0).toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted">Purchases</p>
              <p className="text-lg font-bold text-text">{purchases.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted">Active</p>
              <p className="text-lg font-bold text-emerald-600">
                {purchases.filter((p) => p.status === "activated" || p.status === "paid").length}
              </p>
            </div>
          </div>
          {/* Recommendation */}
          {(() => {
            const active = purchases.filter((p) => p.status === "activated" || p.status === "paid");
            const sections = new Set(active.map((p) => p.placement_type));
            if (active.length === 0) {
              return (
                <div className="bg-gold/5 border border-gold/15 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-gold">No active placements</p>
                  <p className="text-[10px] text-muted mt-0.5">Visit the Promote page to boost your visibility.</p>
                </div>
              );
            }
            if (!sections.has("golden_picks") && !sections.has("now")) {
              return (
                <div className="bg-gold/5 border border-gold/15 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-gold">Try Golden Picks or Now</p>
                  <p className="text-[10px] text-muted mt-0.5">These premium sections have the highest visibility and engagement.</p>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Insight */}
      <Link href="/portal/promote" className="group bg-gold/5 border border-gold/15 rounded-xl p-5 block hover:border-gold/30 transition-colors">
        <p className="text-[10px] font-bold text-gold uppercase tracking-[0.12em] mb-1.5">{t.analytics.tip}</p>
        <p className="text-sm font-bold text-text">{t.analytics.boostTip}</p>
        <p className="text-[11px] text-muted mt-1.5 leading-relaxed">{t.analytics.boostTipDesc}</p>
        <p className="text-[10px] font-semibold text-gold mt-2 flex items-center gap-1 group-hover:underline">
          {t.overview.promoteSpace}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </p>
      </Link>
    </div>
  );
}

function MCard({ icon, label, value }: { icon: string; label: string; value?: number }) {
  const hasValue = value !== undefined && value > 0;
  return (
    <div className="bg-white rounded-xl border border-border px-4 py-3.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted">{ico[icon]}</span>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${hasValue ? "text-text" : "text-muted/30"}`}>
        {hasValue ? value!.toLocaleString() : "—"}
      </p>
      <p className="text-[10px] text-muted mt-0.5">{label}</p>
    </div>
  );
}

function PRow({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-sm text-text">{label}</span>
      </div>
      <span className="text-sm font-bold text-text tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}
