"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import {
  fetchAllPlacementRequests,
  approvePlacementRequest,
  rejectPlacementRequest,
  fetchAllPurchases,
  type PlacementRequestWithPlace,
  type AdminPurchaseDTO,
} from "@/lib/api/business-portal";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  activated: "bg-green-100 text-green-700",
  paid: "bg-green-100 text-green-700",
  approved: "bg-blue-100 text-blue-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-600",
  failed: "bg-red-100 text-red-600",
  expired: "bg-gray-100 text-gray-500",
};

// Unified row type for both requests and purchases
interface UnifiedRow {
  id: string;
  source: "request" | "purchase";
  placeName: string;
  placeSlug: string | null;
  placementType: string;
  status: string;
  clientName: string | null;
  clientEmail: string | null;
  cityName: string | null;
  slot: string | null;
  scopeId: string | null;
  durationDays: number;
  price: string | null;
  adminNotes: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function fmtPrice(v: string) {
  const n = parseFloat(v);
  const s = n.toFixed(2);
  return s.endsWith(".00") ? n.toFixed(0) : s;
}

export default function PlacementRequestsClient() {
  const t = useT();
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [notesModal, setNotesModal] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const [reqs, purch] = await Promise.all([
        fetchAllPlacementRequests().catch(() => [] as PlacementRequestWithPlace[]),
        fetchAllPurchases().catch(() => [] as AdminPurchaseDTO[]),
      ]);

      const unified: UnifiedRow[] = [];

      for (const r of reqs) {
        unified.push({
          id: r.id,
          source: "request",
          placeName: r.place_name,
          placeSlug: r.place_slug,
          placementType: r.placement_type,
          status: r.status,
          clientName: r.client_contact_name,
          clientEmail: r.client_contact_email,
          cityName: r.city_name,
          slot: r.slot,
          scopeId: r.scope_id,
          durationDays: r.duration_days,
          price: null,
          adminNotes: r.admin_notes,
          activatedAt: null,
          expiresAt: null,
          createdAt: r.created_at,
        });
      }

      for (const p of purch) {
        unified.push({
          id: p.id,
          source: "purchase",
          placeName: p.place_name ?? "Unknown",
          placeSlug: null,
          placementType: p.placement_type ?? "unknown",
          status: p.status,
          clientName: p.contact_name,
          clientEmail: p.contact_email,
          cityName: p.city ? p.city.charAt(0).toUpperCase() + p.city.slice(1) : null,
          slot: null,
          scopeId: null,
          durationDays: p.unit_days,
          price: p.final_price,
          adminNotes: null,
          activatedAt: p.activated_at,
          expiresAt: p.expires_at,
          createdAt: p.created_at,
        });
      }

      unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRows(unified);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: "approve" | "reject", notes: string) => {
    setBusy(true);
    try {
      if (action === "approve") {
        await approvePlacementRequest(id, notes || null);
      } else {
        await rejectPlacementRequest(id, notes || null);
      }
      await load();
    } finally {
      setBusy(false);
      setNotesModal(null);
      setAdminNotes("");
    }
  };

  // Normalize status for filtering
  function normalizeStatus(s: string): string {
    if (s === "activated" || s === "paid") return "active";
    if (s === "failed") return "rejected";
    return s;
  }

  const filtered = filter === "all"
    ? rows
    : rows.filter((r) => normalizeStatus(r.status) === filter);

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const activeCount = rows.filter((r) => normalizeStatus(r.status) === "active").length;

  const filterLabels: Record<string, string> = {
    all: t.common.viewAll,
    pending: t.status.pending,
    active: t.status.active,
    approved: t.status.approved,
    rejected: t.status.rejected,
    expired: t.status.expired,
  };

  const placementLabels: Record<string, string> = {
    golden_picks: t.placementTypes.golden_picks,
    now: t.placementTypes.now,
    hidden_gems: t.placementTypes.hidden_gems,
    category_featured: t.placementTypes.category_featured,
    search_priority: t.placementTypes.search_priority,
    new_on_goldenbook: t.placementTypes.new_on_goldenbook,
    routes: t.placementTypes.routes,
    concierge: t.placementTypes.concierge,
    extended_description: "Extended Description",
    extra_images: "Extra Images",
    listing_premium_pack: "Listing Premium Pack",
  };

  const statusLabels: Record<string, string> = {
    active: t.status.active,
    activated: t.status.active,
    paid: t.status.active,
    approved: t.status.approved,
    pending: t.status.pending,
    rejected: t.status.rejected,
    failed: t.status.rejected,
    expired: t.status.expired,
  };

  if (loading) {
    return <p className="text-muted py-10">{t.common.loading}</p>;
  }

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <h1 className="text-2xl font-bold text-text">{t.empRequests.title}</h1>
        <p className="text-sm text-muted">
          {t.empRequests.subtitle}
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
              {pendingCount} {t.empRequests.pending}
            </span>
          )}
          {activeCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
              {activeCount} {t.status.active}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-x-visible sm:pb-0 sm:mx-0 sm:px-0">
        {["all", "pending", "active", "approved", "rejected", "expired"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              filter === f
                ? "bg-gold/10 text-gold-dark border border-gold/30"
                : "bg-white border border-border text-muted hover:text-text"
            }`}
          >
            {filterLabels[f] ?? f}
          </button>
        ))}
      </div>

      {/* Unified list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-16 text-center">
          <p className="text-lg font-semibold text-text mb-1">{t.empRequests.noRequests}</p>
          <p className="text-sm text-muted">{t.empRequests.noRequestsDesc}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border/50">
            {filtered.map((row) => (
              <div key={`${row.source}-${row.id}`} className="px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {row.placeSlug ? (
                      <Link href={`/places/${row.placeSlug}`} className="text-sm font-semibold text-text hover:text-gold transition-colors">
                        {row.placeName}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-text">{row.placeName}</span>
                    )}
                    <span className="text-xs text-muted">{placementLabels[row.placementType] ?? row.placementType}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[row.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {statusLabels[row.status] ?? row.status}
                    </span>
                    {row.source === "purchase" && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold bg-gold/10 text-gold">Stripe</span>
                    )}
                  </div>
                  {row.price && (
                    <p className="text-sm font-semibold text-text mt-1.5 sm:hidden">&euro;{fmtPrice(row.price)}</p>
                  )}
                  <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted flex-wrap">
                    {row.clientName && <span>{t.empRequests.client}: {row.clientName}</span>}
                    {row.clientEmail && <span className="break-all">{row.clientEmail}</span>}
                    {row.cityName && <span>{t.empRequests.city}: {row.cityName}</span>}
                    {row.slot && <span>{t.empRequests.slot}: {row.slot}</span>}
                    {row.scopeId && <span>{t.empRequests.scope}: {row.scopeId}</span>}
                    {row.price && <span className="hidden sm:inline">&euro;{fmtPrice(row.price)}</span>}
                    <span>{row.durationDays} {t.empRequests.days}</span>
                    {row.activatedAt && <span>Started {new Date(row.activatedAt).toLocaleDateString()}</span>}
                    {row.expiresAt && <span>Until {new Date(row.expiresAt).toLocaleDateString()}</span>}
                    <span>{t.empRequests.requested} {new Date(row.createdAt).toLocaleDateString()}</span>
                  </div>
                  {row.adminNotes && (
                    <p className="text-xs text-muted mt-1 italic wrap-break-word">{t.empRequests.admin}: {row.adminNotes}</p>
                  )}
                </div>

                {/* Actions for pending requests only */}
                {row.source === "request" && row.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => { setNotesModal({ id: row.id, action: "approve" }); setAdminNotes(""); }}
                      disabled={busy}
                      className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {t.empRequests.approve}
                    </button>
                    <button
                      onClick={() => { setNotesModal({ id: row.id, action: "reject" }); setAdminNotes(""); }}
                      disabled={busy}
                      className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {t.empRequests.reject}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white sm:rounded-2xl rounded-t-2xl border border-border shadow-xl p-6 sm:p-8 w-full sm:max-w-md h-full sm:h-auto flex flex-col">
            <p className="text-sm font-bold text-text mb-4">
              {notesModal.action === "approve" ? t.empRequests.approveRequest : t.empRequests.rejectRequest}
            </p>
            <div className="mb-4 flex-1 sm:flex-initial">
              <label className="block text-xs font-medium text-muted mb-1.5">
                {t.empRequests.adminNotes}
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
                placeholder={notesModal.action === "approve" ? t.empRequests.notesPlaceholderApprove : t.empRequests.notesPlaceholderReject}
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => handleAction(notesModal.id, notesModal.action, adminNotes)}
                disabled={busy}
                className={`px-5 py-2.5 sm:py-2 rounded-lg text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                  notesModal.action === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {busy ? t.empRequests.processing : notesModal.action === "approve" ? t.empRequests.confirmApproval : t.empRequests.confirmRejection}
              </button>
              <button
                onClick={() => setNotesModal(null)}
                className="px-4 py-2.5 sm:py-2 rounded-lg border border-border text-sm font-semibold text-muted hover:text-text transition-colors cursor-pointer"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
