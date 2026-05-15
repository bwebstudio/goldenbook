"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBusinessMe, type BusinessSubscription } from "@/lib/api/business-portal";
import { useT } from "@/lib/i18n";

// Banner shown on every portal page when the subscription state needs the
// client's attention (trial running out, payment failed, listing lapsed).
// Quiet states (paid > 30 days remaining) render nothing — we don't want a
// permanent "everything's fine" stripe at the top of the dashboard.

type Tone = "info" | "warning" | "danger" | "success";

interface BannerCopy {
  tone: Tone;
  title: string;
  body?: string;
  cta?: string;
}

function daysBetween(targetIso: string | null): number | null {
  if (!targetIso) return null;
  const ms = new Date(targetIso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function pickBanner(sub: BusinessSubscription | null, t: ReturnType<typeof useT>): BannerCopy | null {
  if (!sub || !sub.status) return null;
  const sb = t.subscription;

  switch (sub.status) {
    case "trial": {
      const days = daysBetween(sub.trialEndsAt);
      if (days === null) return null;
      if (days < 0) {
        return { tone: "danger", title: sb.trialExpiredTitle, body: sb.trialExpiredBody, cta: sb.subscribeCta };
      }
      if (days <= 30) {
        return {
          tone: "warning",
          title: sb.trialEndingTitle.replace("{{days}}", String(days)),
          body: sb.trialEndingBody,
          cta: sb.subscribeCta,
        };
      }
      return {
        tone: "info",
        title: sb.trialActiveTitle.replace("{{days}}", String(days)),
        body: sb.trialActiveBody,
        cta: sb.subscribeCta,
      };
    }
    case "active": {
      const days = daysBetween(sub.paidUntil);
      if (days === null || days > 30) return null;
      if (days < 0) {
        return { tone: "danger", title: sb.expiredTitle, body: sb.expiredBody, cta: sb.renewCta };
      }
      // paid_first clients about to expire — let them know the 6-month retention
      // grace will kick in automatically, so the transition feels generous, not
      // punitive. trial_first clients only see the hard renewal reminder.
      const isPaidFirst = sub.lifecyclePath === "paid_first" && !sub.retentionGraceUsed;
      return {
        tone: "warning",
        title: sb.renewalSoonTitle.replace("{{days}}", String(days)),
        body: isPaidFirst ? sb.renewalSoonBodyWithGrace : sb.renewalSoonBody,
        cta: sb.renewCta,
      };
    }
    case "retention_grace": {
      const days = daysBetween(sub.retentionGraceEndsAt);
      if (days === null) return null;
      if (days < 0) {
        return { tone: "danger", title: sb.graceExpiredTitle, body: sb.graceExpiredBody, cta: sb.renewCta };
      }
      if (days <= 30) {
        return {
          tone: "danger",
          title: sb.graceEndingTitle.replace("{{days}}", String(days)),
          body: sb.graceEndingBody,
          cta: sb.renewCta,
        };
      }
      return {
        tone: "info",
        title: sb.graceActiveTitle.replace("{{days}}", String(days)),
        body: sb.graceActiveBody,
        cta: sb.renewCta,
      };
    }
    case "pending_payment":
      return { tone: "danger", title: sb.pendingPaymentTitle, body: sb.pendingPaymentBody, cta: sb.activateCta };
    case "past_due":
      return { tone: "danger", title: sb.pastDueTitle, body: sb.pastDueBody, cta: sb.updatePaymentCta };
    case "cancelled": {
      const days = daysBetween(sub.paidUntil);
      if (days !== null && days > 0) {
        return {
          tone: "warning",
          title: sb.cancelledActiveTitle.replace("{{days}}", String(days)),
          body: sb.cancelledActiveBody,
          cta: sb.resubscribeCta,
        };
      }
      return { tone: "danger", title: sb.lapsedTitle, body: sb.lapsedBody, cta: sb.resubscribeCta };
    }
    case "expired":
    case "lapsed":
      return { tone: "danger", title: sb.lapsedTitle, body: sb.lapsedBody, cta: sb.resubscribeCta };
    default:
      return null;
  }
}

const toneStyles: Record<Tone, string> = {
  info:    "bg-[#D2B68A]/8 border-[#D2B68A]/30 text-[#222D52]",
  warning: "bg-amber-50 border-amber-300 text-amber-900",
  danger:  "bg-red-50 border-red-300 text-red-900",
  success: "bg-emerald-50 border-emerald-300 text-emerald-900",
};

const toneCta: Record<Tone, string> = {
  info:    "bg-[#D2B68A] hover:bg-[#C0A37A] text-[#222D52]",
  warning: "bg-amber-600 hover:bg-amber-700 text-white",
  danger:  "bg-red-600 hover:bg-red-700 text-white",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white",
};

export default function SubscriptionBanner() {
  const t = useT();
  const [sub, setSub] = useState<BusinessSubscription | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchBusinessMe()
      .then((me) => setSub(me.subscription))
      .catch(() => { /* banner is non-critical — fail silent */ })
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  const copy = pickBanner(sub, t);
  if (!copy) return null;

  return (
    <div className={`border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${toneStyles[copy.tone]}`}>
      <div className="min-w-0">
        <p className="text-sm font-bold">{copy.title}</p>
        {copy.body && <p className="text-xs mt-0.5 opacity-80">{copy.body}</p>}
      </div>
      {copy.cta && (
        <Link
          href="/portal/billing"
          className={`shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${toneCta[copy.tone]}`}
        >
          {copy.cta}
        </Link>
      )}
    </div>
  );
}
