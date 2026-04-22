"use client";

/**
 * UserBehaviorV2Client
 *
 * Consumes the 4 admin analytics V2 endpoints in parallel and renders a
 * stacked view: Users → Content → Features → Search. A single period
 * selector (7/30/90 d) at the top re-fetches everything.
 *
 * Shows a clear empty state when the pipeline has no data yet — this is the
 * normal state just after the mobile OTA update reaches users but before
 * enough sessions land in analytics_events.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import Card from "@/components/ui/Card";
import {
  fetchUsersAnalytics,
  fetchContentAnalytics,
  fetchFeaturesAnalytics,
  fetchSearchAnalytics,
  type AnalyticsPeriod,
  type UsersAnalytics,
  type ContentAnalytics,
  type FeaturesAnalytics,
  type SearchAnalytics,
} from "@/lib/api/analytics-v2";

type Bundle = {
  users: UsersAnalytics | null;
  content: ContentAnalytics | null;
  features: FeaturesAnalytics | null;
  search: SearchAnalytics | null;
};

export default function UserBehaviorV2Client() {
  const t = useT();
  const a = t.behaviorV2;
  const [period, setPeriod] = useState<AnalyticsPeriod>("30");
  const [reloadKey, setReloadKey] = useState(0);
  // `fetchState` is keyed on (period, reloadKey) so a fresh fetch starts in
  // the "loading" phase without a separate setState + cascading render.
  const [fetchState, setFetchState] = useState<
    | { phase: "loading"; key: string }
    | { phase: "error"; key: string }
    | { phase: "data"; key: string; data: Bundle }
  >(() => ({ phase: "loading", key: `${period}:${reloadKey}` }));

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const key = `${period}:${reloadKey}`;
    let cancelled = false;
    Promise.allSettled([
      fetchUsersAnalytics(period),
      fetchContentAnalytics(period),
      fetchFeaturesAnalytics(period),
      fetchSearchAnalytics(period),
    ]).then((results) => {
      if (cancelled) return;
      const [u, c, f, s] = results;
      if (results.every((r) => r.status === "rejected")) {
        // Log each rejection so the underlying cause (auth, 500, CORS, etc.)
        // is visible in the browser console — previously all four errors were
        // swallowed and the user only saw "Could not load" with no signal.
        const names = ["users", "content", "features", "search"];
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error(`[UserBehaviorV2] ${names[i]} analytics failed:`, r.reason);
          }
        });
        setFetchState({ phase: "error", key });
        return;
      }
      setFetchState({
        phase: "data",
        key,
        data: {
          users:    u.status === "fulfilled" ? u.value : null,
          content:  c.status === "fulfilled" ? c.value : null,
          features: f.status === "fulfilled" ? f.value : null,
          search:   s.status === "fulfilled" ? s.value : null,
        },
      });
    });
    return () => { cancelled = true; };
  }, [period, reloadKey]);

  // Reset to "loading" whenever the request key changes (period or retry).
  const currentKey = `${period}:${reloadKey}`;
  const loading = fetchState.phase === "loading" || fetchState.key !== currentKey;
  const error = !loading && fetchState.phase === "error";
  const data = !loading && fetchState.phase === "data" ? fetchState.data : null;

  const hasAnyData = useMemo(() => {
    if (!data) return false;
    return (
      (data.users?.kpis.mau ?? 0) > 0 ||
      (data.users?.dau.some((d) => d.dau > 0) ?? false) ||
      (data.content?.mostViewed.length ?? 0) > 0 ||
      (data.features && (data.features.now.count + data.features.concierge.count + data.features.search.count + data.features.routes.starts) > 0) ||
      (data.search?.totals.count ?? 0) > 0
    );
  }, [data]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">{a.title}</h2>
          <p className="text-sm text-muted mt-0.5">{a.subtitle}</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} labels={a.period} />
      </header>

      {loading && <Card className="!py-8 text-center"><p className="text-sm text-muted">{t.common.loading}</p></Card>}

      {!loading && error && (
        <Card className="!py-8 text-center flex flex-col items-center gap-3">
          <p className="text-sm text-muted">{a.loadError}</p>
          <button
            onClick={retry}
            className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-text hover:border-gold/50 hover:text-gold transition-colors cursor-pointer"
          >
            {a.retry}
          </button>
        </Card>
      )}

      {!loading && !error && data && !hasAnyData && (
        <Card className="!py-10 text-center">
          <p className="text-sm font-semibold text-text mb-1">{a.emptyTitle}</p>
          <p className="text-xs text-muted max-w-md mx-auto">{a.emptyBody}</p>
        </Card>
      )}

      {!loading && !error && data && hasAnyData && (
        <>
          {data.users    && <UsersBlock    d={data.users}    t={a} />}
          {data.content  && <ContentBlock  d={data.content}  t={a} />}
          {data.features && <FeaturesBlock d={data.features} t={a} />}
          {data.search   && <SearchBlock   d={data.search}   t={a} />}
        </>
      )}
    </section>
  );
}

// ─── Period selector ────────────────────────────────────────────────────────

function PeriodSelector({
  value, onChange, labels,
}: {
  value: AnalyticsPeriod;
  onChange: (v: AnalyticsPeriod) => void;
  labels: { d7: string; d30: string; d90: string };
}) {
  const opts: { v: AnalyticsPeriod; label: string }[] = [
    { v: "7", label: labels.d7 },
    { v: "30", label: labels.d30 },
    { v: "90", label: labels.d90 },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-white overflow-hidden shrink-0">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.v ? "bg-gold text-white" : "text-muted hover:bg-surface"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Users block ────────────────────────────────────────────────────────────

function UsersBlock({ d, t: a }: { d: UsersAnalytics; t: BehaviorTxt }) {
  const hasData = d.kpis.mau > 0 || d.dau.some((x) => x.dau > 0);
  if (!hasData) return null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-text">{a.usersTitle}</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={a.dauToday} value={d.kpis.dauToday.toLocaleString()} />
        <KpiCard label={a.wau}      value={d.kpis.wau.toLocaleString()} />
        <KpiCard label={a.mau}      value={d.kpis.mau.toLocaleString()} />
        <KpiCard label={a.sessionsPerUser} value={d.kpis.sessionsPerUser.toFixed(1)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={a.avgSession} value={formatSec(d.kpis.avgSessionSec)} />
        <KpiCard label="P50" value={formatSec(d.kpis.sessionP50Sec)} />
        <KpiCard label="P75" value={formatSec(d.kpis.sessionP75Sec)} />
        <KpiCard label="P95" value={formatSec(d.kpis.sessionP95Sec)} />
      </div>

      {d.dau.length > 0 && <DauChart data={d.dau.slice(-30)} label={a.dauChart} />}
      {d.sessions.length > 0 && <SessionsChart data={d.sessions.slice(-30)} labels={{ title: a.sessionsChart, ios: "iOS", android: "Android", web: "Web" }} />}
    </div>
  );
}

function DauChart({ data, label }: { data: { date: string; dau: number }[]; label: string }) {
  const max = Math.max(...data.map((r) => r.dau), 1);
  const BAR_H = 120;
  return (
    <Card>
      <p className="text-sm font-bold text-text mb-4">{label}</p>
      <div className="flex items-end gap-1" style={{ height: `${BAR_H + 20}px` }}>
        {data.map((d) => {
          const h = d.dau > 0 ? Math.max(4, Math.round((d.dau / max) * BAR_H)) : 0;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ${d.dau}`}>
              {h > 0 ? <div className="w-full rounded-t" style={{ height: `${h}px`, backgroundColor: "#A5835A" }} />
                     : <div className="w-full rounded-t" style={{ height: "2px", backgroundColor: "#F0ECE6" }} />}
              <span className="text-[8px] text-muted mt-1">{d.date.slice(8)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SessionsChart({
  data, labels,
}: {
  data: { date: string; ios: number; android: number; web: number; total: number }[];
  labels: { title: string; ios: string; android: string; web: string };
}) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const BAR_H = 120;
  return (
    <Card>
      <p className="text-sm font-bold text-text mb-4">{labels.title}</p>
      <div className="flex items-end gap-1" style={{ height: `${BAR_H + 20}px` }}>
        {data.map((d) => {
          const hTotal = d.total > 0 ? Math.max(4, Math.round((d.total / max) * BAR_H)) : 0;
          const hIos = hTotal * (d.ios / Math.max(d.total, 1));
          const hAndroid = hTotal * (d.android / Math.max(d.total, 1));
          const hWeb = hTotal * (d.web / Math.max(d.total, 1));
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: iOS ${d.ios} · Android ${d.android} · Web ${d.web}`}>
              <div className="w-full flex flex-col items-stretch">
                {hIos > 0 && <div style={{ height: `${hIos}px`, backgroundColor: "#A5835A" }} />}
                {hAndroid > 0 && <div style={{ height: `${hAndroid}px`, backgroundColor: "#D2B68A" }} />}
                {hWeb > 0 && <div style={{ height: `${hWeb}px`, backgroundColor: "#EBDCC2" }} />}
                {hTotal === 0 && <div style={{ height: "2px", backgroundColor: "#F0ECE6" }} />}
              </div>
              <span className="text-[8px] text-muted mt-1">{d.date.slice(8)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-muted">
        <LegendDot color="#A5835A" label={labels.ios} />
        <LegendDot color="#D2B68A" label={labels.android} />
        <LegendDot color="#EBDCC2" label={labels.web} />
      </div>
    </Card>
  );
}

// ─── Content block ──────────────────────────────────────────────────────────

function ContentBlock({ d, t: a }: { d: ContentAnalytics; t: BehaviorTxt }) {
  const hasData = d.mostViewed.length + d.mostSaved.length + d.mostBooked.length > 0;
  if (!hasData) return null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-text">{a.contentTitle}</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {d.mostViewed.length  > 0 && <TopList title={a.mostViewed}  items={d.mostViewed.map((r) => ({ label: r.name, count: r.count }))} />}
        {d.mostSaved.length   > 0 && <TopList title={a.mostSaved}   items={d.mostSaved.map((r) => ({ label: r.name, count: r.count }))} />}
        {d.mostBooked.length  > 0 && <TopList title={a.mostBooked}  items={d.mostBooked.map((r) => ({ label: r.name, count: r.count }))} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {d.topCategories.length > 0 && <TopList title={a.topCategories} items={d.topCategories.map((r) => ({ label: r.slug, count: r.count }))} />}
        {d.topCities.length     > 0 && <TopList title={a.topCities}     items={d.topCities.map((r) => ({ label: r.slug, count: r.count }))} />}
      </div>

      {d.topBookingCtr.length > 0 && (
        <Card>
          <p className="text-sm font-bold text-text mb-3">{a.topBookingCtr}</p>
          <p className="text-xs text-muted mb-3">{a.topBookingCtrSub}</p>
          <div className="divide-y divide-border/50">
            {d.topBookingCtr.map((r) => (
              <div key={r.placeId} className="py-2 flex items-center justify-between">
                <span className="text-sm text-text truncate">{r.name}</span>
                <div className="flex items-center gap-4 text-xs text-muted shrink-0">
                  <span>{r.views} {a.views}</span>
                  <span>{r.clicks} {a.clicks}</span>
                  <span className="w-14 text-right font-semibold text-text">{r.ctrPct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Features block ─────────────────────────────────────────────────────────

function FeaturesBlock({ d, t: a }: { d: FeaturesAnalytics; t: BehaviorTxt }) {
  const total = d.now.count + d.concierge.count + d.search.count + d.routes.starts;
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-text">{a.featuresTitle}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FeatureTile label={a.now}       count={d.now.count}       users={d.now.uniqueUsers} />
        <FeatureTile label={a.concierge} count={d.concierge.count} users={d.concierge.uniqueUsers} />
        <FeatureTile label={a.searches}  count={d.search.count}    users={d.search.uniqueUsers} />
        <Card className="!p-5">
          <p className="text-sm text-muted">{a.routes}</p>
          <p className="text-2xl font-bold text-text mt-1">{d.routes.starts.toLocaleString()}</p>
          <p className="text-xs text-muted mt-1">
            {d.routes.completes} {a.completes} · {d.routes.completionRate.toFixed(1)}% {a.completion}
          </p>
        </Card>
      </div>
    </div>
  );
}

function FeatureTile({ label, count, users }: { label: string; count: number; users: number }) {
  return (
    <Card className="!p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold text-text mt-1">{count.toLocaleString()}</p>
      <p className="text-xs text-muted mt-1">{users.toLocaleString()} users</p>
    </Card>
  );
}

// ─── Search block ───────────────────────────────────────────────────────────

function SearchBlock({ d, t: a }: { d: SearchAnalytics; t: BehaviorTxt }) {
  if (d.totals.count === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-text">{a.searchTitle}</h3>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label={a.totalQueries} value={d.totals.count.toLocaleString()} />
        <KpiCard label={a.avgResults} value={d.totals.avgResults.toFixed(1)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {d.topQueries.length > 0 && (
          <Card className="!p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface">
              <p className="text-xs font-bold text-text">{a.topQueries}</p>
            </div>
            <div className="divide-y divide-border/50">
              {d.topQueries.slice(0, 10).map((r, i) => (
                <div key={r.query} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted w-4 shrink-0">{i + 1}.</span>
                    <span className="text-sm text-text truncate">{r.query}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted shrink-0">
                    <span>{r.count}×</span>
                    <span className="w-10 text-right">{r.avgResults.toFixed(0)} {a.results}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {d.zeroResultQueries.length > 0 && (
          <Card className="!p-0 overflow-hidden border-l-4 !border-l-red-500">
            <div className="px-4 py-3 border-b border-border bg-red-50/50">
              <p className="text-xs font-bold text-text">{a.zeroResultQueries}</p>
              <p className="text-[10px] text-muted mt-0.5">{a.zeroResultQueriesSub}</p>
            </div>
            <div className="divide-y divide-border/50">
              {d.zeroResultQueries.slice(0, 10).map((r, i) => (
                <div key={r.query} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted w-4 shrink-0">{i + 1}.</span>
                    <span className="text-sm text-text truncate">{r.query}</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600 shrink-0 ml-2">{r.count}×</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Shared atoms ───────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold text-text mt-1">{value}</p>
    </Card>
  );
}

function TopList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface">
        <p className="text-xs font-bold text-text">{title}</p>
      </div>
      <div className="divide-y divide-border/50">
        {items.slice(0, 5).map((item, i) => (
          <div key={item.label} className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-muted w-4 shrink-0">{i + 1}.</span>
              <span className="text-sm text-text truncate">{item.label}</span>
            </div>
            <span className="text-sm font-semibold text-text shrink-0 ml-2">{item.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function formatSec(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "—";
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

type BehaviorTxt = {
  title: string;
  subtitle: string;
  usersTitle: string;
  contentTitle: string;
  featuresTitle: string;
  searchTitle: string;
  dauToday: string;
  wau: string;
  mau: string;
  sessionsPerUser: string;
  avgSession: string;
  dauChart: string;
  sessionsChart: string;
  mostViewed: string;
  mostSaved: string;
  mostBooked: string;
  topCategories: string;
  topCities: string;
  topBookingCtr: string;
  topBookingCtrSub: string;
  now: string;
  concierge: string;
  searches: string;
  routes: string;
  completes: string;
  completion: string;
  totalQueries: string;
  avgResults: string;
  topQueries: string;
  zeroResultQueries: string;
  zeroResultQueriesSub: string;
  results: string;
  views: string;
  clicks: string;
  loadError: string;
  retry: string;
  emptyTitle: string;
  emptyBody: string;
  period: { d7: string; d30: string; d90: string };
};
