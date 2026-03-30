"use client";

import { useT } from "@/lib/i18n";
import type { AnalyticsSummary } from "@/lib/api/analytics";

export function AnalyticsError() {
  const t = useT();
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-text mb-2">{t.empAnalytics.title}</h1>
      <p className="text-sm text-muted mb-6">{t.empAnalytics.period}</p>
      <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center text-gold mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
        </div>
        <p className="text-lg font-semibold text-text mb-1">{t.empAnalytics.noDataAvailable}</p>
        <p className="text-sm text-muted max-w-md mx-auto">{t.empAnalytics.noData}</p>
      </div>
    </div>
  );
}

export default function AnalyticsContent({ data }: { data: AnalyticsSummary }) {
  const t = useT();

  const hasData = data.totalImpressions > 0 || data.totalClicks > 0;

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{t.empAnalytics.title}</h1>
        <p className="text-sm text-muted mt-1">{t.empAnalytics.period}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricTile label={t.empAnalytics.impressions} value={hasData ? data.totalImpressions : null} />
        <MetricTile label={t.empAnalytics.clicks} value={hasData ? data.totalClicks : null} />
        <MetricTile label={t.empAnalytics.ctr} value={hasData ? `${(data.globalCtr * 100).toFixed(1)}%` : null} accent />
      </div>

      {hasData ? (
        <>
          {/* Breakdown tables */}
          {data.byProvider.length > 0 && (
            <BreakdownCard title={t.empAnalytics.byProvider} rows={data.byProvider} t={t} />
          )}
          {data.byCity.length > 0 && (
            <BreakdownCard title={t.empAnalytics.byCity} rows={data.byCity} t={t} />
          )}
          {data.topPlaces.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-bold text-text mb-4">{t.empAnalytics.topPlaces}</h2>
              <div className="space-y-2">
                {data.topPlaces.map((row) => (
                  <div key={row.placeId} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-text">{row.placeName}</span>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span>{row.impressions} {t.empAnalytics.impressions.toLowerCase()}</span>
                      <span className="font-semibold text-text">{row.clicks} {t.empAnalytics.clicks.toLowerCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-border px-8 py-12 text-center">
          <p className="text-sm font-semibold text-text mb-1">{t.empAnalytics.noDataAvailable}</p>
          <p className="text-xs text-muted max-w-sm mx-auto">{t.empAnalytics.noData}</p>
        </div>
      )}
    </div>
  );
}

function MetricTile({ label, value, accent }: { label: string; value: number | string | null; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-border px-5 py-4">
      <p className={`text-2xl font-bold ${value !== null ? (accent ? "text-gold" : "text-text") : "text-muted/25"}`}>
        {value !== null ? value : "—"}
      </p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function BreakdownCard({ title, rows, t }: { title: string; rows: { key: string; impressions: number; clicks: number; ctr: number }[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h2 className="text-sm font-bold text-text mb-3">{title}</h2>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between py-1">
            <span className="text-sm text-text capitalize">{row.key}</span>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span>{row.impressions}</span>
              <span className="font-semibold text-text">{row.clicks}</span>
              <span className="w-12 text-right">{(row.ctr * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
