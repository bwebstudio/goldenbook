"use client";

import { useEffect, useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { fetchBusinessPlace, fetchBusinessRequests, type ChangeRequestInfo, type PlacementRequestDTO } from "@/lib/api/business-portal";

interface Notification {
  id: string;
  type: "change" | "promotion";
  status: "pending" | "approved" | "rejected";
  title: string;
  description: string;
  reason?: string | null;
  date: string;
}

export default function PortalNotifications() {
  const t = useT();
  const { locale } = useLocale();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const nt = t.notifications;
  const products = t.promote.products as Record<string, { label: string }>;
  const fieldLabels: Record<string, string> = {
    name: t.pendingChanges.fieldName,
    short_description: t.pendingChanges.fieldShortDescription,
    full_description: t.pendingChanges.fieldFullDescription,
  };

  useEffect(() => {
    async function load() {
      try {
        const [placeData, promotions] = await Promise.all([
          fetchBusinessPlace(locale).catch(() => null),
          fetchBusinessRequests().catch(() => []),
        ]);

        const items: Notification[] = [];

        // Change requests → notifications
        const changeRequests: ChangeRequestInfo[] = placeData?.changeRequests ?? [];
        for (const cr of changeRequests) {
          const statusLabel = cr.status === 'pending' ? nt.changeSubmitted
            : cr.status === 'approved' ? nt.changeApproved
            : nt.changeRejected;
          items.push({
            id: `cr-${cr.field_name}-${cr.created_at}`,
            type: "change",
            status: cr.status as "pending" | "approved" | "rejected",
            title: statusLabel,
            description: fieldLabels[cr.field_name] ?? cr.field_name,
            reason: cr.review_note,
            date: cr.created_at,
          });
        }

        // Promotion requests → notifications
        for (const pr of promotions) {
          const statusLabel = pr.status === 'pending' ? nt.promotionSubmitted
            : pr.status === 'active' || pr.status === 'approved' ? nt.promotionApproved
            : pr.status === 'rejected' ? nt.promotionRejected
            : nt.promotionSubmitted;
          items.push({
            id: `pr-${pr.id}`,
            type: "promotion",
            status: pr.status === 'active' || pr.status === 'approved' ? 'approved' : pr.status === 'rejected' ? 'rejected' : 'pending',
            title: statusLabel,
            description: products[pr.placement_type]?.label ?? pr.placement_type,
            reason: pr.admin_notes,
            date: pr.created_at,
          });
        }

        // Sort newest first
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setNotifications(items);
      } finally { setLoading(false); }
    }
    load();
  }, [locale, nt, products, fieldLabels]);

  const statusStyles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    pending: {
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-700",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>,
    },
    approved: {
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-700",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    },
    rejected: {
      bg: "bg-red-50 border-red-200",
      text: "text-red-600",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
    },
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">{nt.title}</h1>
        <p className="text-xs text-muted mt-0.5">{nt.subtitle}</p>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-border py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D2B68A" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          </div>
          <p className="text-sm font-bold text-text">{nt.empty}</p>
          <p className="text-xs text-muted mt-1 max-w-xs mx-auto">{nt.emptyDesc}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const st = statusStyles[n.status] ?? statusStyles.pending;
            return (
              <div key={n.id} className={`rounded-xl border px-4 py-3.5 ${st.bg}`}>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5">{st.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${st.text}`}>{n.title}</p>
                    <p className="text-xs text-text mt-0.5">{n.description}</p>
                    {n.reason && (
                      <p className="text-xs text-muted mt-1.5">
                        <span className="font-medium">{nt.reason}:</span> {n.reason}
                      </p>
                    )}
                    <p className="text-[10px] text-muted mt-1.5">{new Date(n.date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
