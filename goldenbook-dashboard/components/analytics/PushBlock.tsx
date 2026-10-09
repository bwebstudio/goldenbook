// The daily 18:00 notification: who can receive it, and what happened to
// what was sent. Opens are acknowledged by the app (POST /me/push/opened),
// so a send from the last day or two may still turn into an open.
//
// The tables start empty: app 1.2.0 is the first build that registers
// devices, so "no data yet" is the expected state until people update.

import Card from "@/components/ui/Card";
import type { TranslationKeys } from "@/lib/i18n";
import type { PushAnalytics } from "@/lib/api/analytics-v2";
import { KpiCard, LegendDot, TopList } from "./atoms";
import { formatPct, keyLabel, shortDate } from "./format";

type Txt = TranslationKeys["behaviorV2"];

const PLATFORM_LABELS: Record<string, string> = { ios: "iOS", android: "Android" };

export default function PushBlock({ d, t }: { d: PushAnalytics; t: Txt }) {
  const empty = d.devices.active === 0 && d.devices.inactive === 0 && d.totals.sent === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-text">{t.pushTitle}</h3>
        <p className="text-xs text-muted mt-0.5 max-w-2xl">{t.pushSub}</p>
      </div>

      {empty ? (
        <Card className="!py-8 text-center">
          <p className="text-sm font-semibold text-text mb-1">{t.pushEmptyTitle}</p>
          <p className="text-xs text-muted max-w-md mx-auto">{t.pushEmptyBody}</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label={t.activeDevices}
              value={d.devices.active.toLocaleString()}
              hint={`${d.devices.inBackoff} ${t.inBackoff} · ${d.devices.inactive} ${t.turnedOff}`}
            />
            <KpiCard label={t.sent} value={d.totals.sent.toLocaleString()} />
            <KpiCard label={t.opened} value={d.totals.opened.toLocaleString()} />
            <KpiCard label={t.openRate} value={formatPct(d.totals.openRatePct, "-")} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {d.devices.byPlatform.length > 0 && (
              <TopList
                title={t.byPlatform}
                items={d.devices.byPlatform.map((r) => ({
                  key: r.platform ?? "unknown",
                  label: keyLabel(r.platform, PLATFORM_LABELS, t.unknown),
                  count: r.count,
                  muted: r.platform === null,
                }))}
              />
            )}
            {d.devices.byCity.length > 0 && (
              <TopList
                title={t.byCity}
                items={d.devices.byCity.map((r) => ({
                  key: r.city ?? "unknown",
                  label: keyLabel(r.city, {}, t.unknown),
                  count: r.count,
                  muted: r.city === null,
                }))}
              />
            )}
          </div>

          <SendsChart data={d.daily} t={t} />
        </>
      )}
    </div>
  );
}

function SendsChart({ data, t }: { data: PushAnalytics["daily"]; t: Txt }) {
  const max = Math.max(...data.map((r) => r.sent), 1);
  const BAR_H = 100;

  return (
    <Card>
      <p className="text-sm font-bold text-text mb-4">{t.sendsChart}</p>
      <div className="flex items-end gap-1" style={{ height: `${BAR_H + 20}px` }}>
        {data.map((r) => {
          const hSent = r.sent > 0 ? Math.max(4, Math.round((r.sent / max) * BAR_H)) : 0;
          const hOpened = r.sent > 0 ? Math.round(hSent * (r.opened / r.sent)) : 0;
          return (
            <div
              key={r.date}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${r.date}: ${t.sent} ${r.sent} · ${t.opened} ${r.opened}`}
            >
              {hSent > 0 ? (
                <div className="w-full rounded-t flex flex-col justify-end" style={{ height: `${hSent}px`, backgroundColor: "#EBDCC2" }}>
                  {hOpened > 0 && <div className="w-full rounded-t" style={{ height: `${hOpened}px`, backgroundColor: "#A5835A" }} />}
                </div>
              ) : (
                <div className="w-full rounded-t" style={{ height: "2px", backgroundColor: "#E8E1D5" }} />
              )}
              <span className="text-[8px] text-muted mt-1">{shortDate(r.date).slice(0, 2)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-muted">
        <LegendDot color="#EBDCC2" label={t.sent} />
        <LegendDot color="#A5835A" label={t.opened} />
      </div>
    </Card>
  );
}
