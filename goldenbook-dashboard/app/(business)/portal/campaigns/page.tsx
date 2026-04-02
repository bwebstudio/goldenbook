"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import {
  fetchBusinessRequests,
  fetchBusinessPurchases,
  type PlacementRequestDTO,
  type PurchaseDTO,
} from "@/lib/api/business-portal";

type Filter = "all" | "active" | "pending" | "past";

// Unified campaign item for display
interface CampaignItem {
  id: string;
  type: "request" | "purchase";
  placementType: string;
  status: string;
  city: string | null;
  duration: number;
  price: string | null;
  slot: string | null;
  scopeId: string | null;
  adminNotes: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function fmtPrice(n: number) {
  const s = n.toFixed(2);
  return s.endsWith(".00") ? n.toFixed(0) : s;
}

export default function PortalCampaigns() {
  const t = useT();
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    Promise.all([
      fetchBusinessRequests().catch(() => [] as PlacementRequestDTO[]),
      fetchBusinessPurchases().catch(() => [] as PurchaseDTO[]),
    ]).then(([requests, purchases]) => {
      const mapped: CampaignItem[] = [];

      // Map placement requests
      for (const r of requests) {
        mapped.push({
          id: r.id,
          type: "request",
          placementType: r.placement_type,
          status: r.status,
          city: r.city_id,
          duration: r.duration_days,
          price: null,
          slot: r.slot,
          scopeId: r.scope_id,
          adminNotes: r.admin_notes,
          activatedAt: null,
          expiresAt: null,
          createdAt: r.created_at,
        });
      }

      // Map purchases — avoid duplicates if a request was also created
      const requestSessionIds = new Set<string>();
      for (const p of purchases) {
        mapped.push({
          id: p.id,
          type: "purchase",
          placementType: p.placement_type ?? "unknown",
          status: p.status === "activated" ? "active" : p.status === "paid" ? "active" : p.status,
          city: p.city,
          duration: p.unit_days,
          price: p.final_price,
          slot: null,
          scopeId: null,
          adminNotes: null,
          activatedAt: p.activated_at,
          expiresAt: p.expires_at,
          createdAt: p.created_at,
        });
      }

      // Sort by creation date descending
      mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(mapped);
    }).finally(() => setLoading(false));
  }, []);

  const products = t.promote.products as Record<string, { label: string }>;

  const filtered = filter === "all" ? items
    : filter === "past" ? items.filter((r) => r.status === "expired" || r.status === "rejected" || r.status === "failed")
    : filter === "active" ? items.filter((r) => r.status === "active" || r.status === "activated" || r.status === "paid")
    : items.filter((r) => r.status === "pending");

  const filters: [Filter, string][] = [
    ["all", t.campaigns.filterAll],
    ["active", t.campaigns.filterActive],
    ["pending", t.campaigns.filterPending],
    ["past", t.campaigns.filterPast],
  ];

  const statusCfg: Record<string, { label: string; cls: string }> = {
    active:    { label: t.status.active,   cls: "bg-emerald-50 text-emerald-700" },
    activated: { label: t.status.active,   cls: "bg-emerald-50 text-emerald-700" },
    paid:      { label: "Paid",            cls: "bg-emerald-50 text-emerald-700" },
    approved:  { label: t.status.approved, cls: "bg-blue-50 text-blue-700" },
    pending:   { label: t.status.pending,  cls: "bg-amber-50 text-amber-700" },
    rejected:  { label: t.status.rejected, cls: "bg-red-50 text-red-600" },
    failed:    { label: "Failed",          cls: "bg-red-50 text-red-600" },
    expired:   { label: t.status.expired,  cls: "bg-gray-50 text-gray-500" },
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">{t.campaigns.title}</h1>
          <p className="text-xs text-muted mt-0.5">{t.campaigns.subtitle}</p>
        </div>
        <Link href="/portal/promote" className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors">
          {t.campaigns.newPlacement}
        </Link>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
        {filters.map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${filter === key ? "bg-gold/10 text-gold border border-gold/30" : "bg-white border border-border text-muted hover:text-text"}`}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-border py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D2B68A" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          </div>
          <p className="text-sm font-bold text-text mb-1">{items.length === 0 ? t.campaigns.noCampaigns : t.campaigns.noMatch}</p>
          <p className="text-xs text-muted max-w-xs mx-auto">{items.length === 0 ? t.campaigns.noCampaignsDesc : t.campaigns.noMatchDesc}</p>
          {items.length === 0 && (
            <Link href="/portal/promote" className="inline-flex mt-4 w-full sm:w-auto justify-center px-5 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors">
              {t.common.getStarted}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const st = statusCfg[item.status] ?? statusCfg.expired;
            const cityLabel = item.city ? item.city.charAt(0).toUpperCase() + item.city.slice(1) : null;
            return (
              <div key={`${item.type}-${item.id}`} className="bg-white rounded-xl border border-border px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-text">{products[item.placementType]?.label ?? item.placementType}</p>
                      {item.type === "purchase" && (
                        <span className="text-[9px] font-semibold text-gold bg-gold/10 rounded px-1.5 py-0.5">Paid</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] text-muted">
                      {cityLabel && <span>{cityLabel}</span>}
                      <span>{item.duration} {t.common.days}</span>
                      {item.price && <span>&euro;{fmtPrice(parseFloat(item.price))}</span>}
                      {item.activatedAt && <span>Started {new Date(item.activatedAt).toLocaleDateString()}</span>}
                      {item.expiresAt && <span>Until {new Date(item.expiresAt).toLocaleDateString()}</span>}
                      {!item.activatedAt && <span>{t.common.requested} {new Date(item.createdAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
                {item.adminNotes && (
                  <div className="mt-2.5 bg-surface rounded-lg px-3 py-2">
                    <p className="text-[11px] text-muted"><span className="font-semibold">{t.campaigns.goldenbook}:</span> {item.adminNotes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
