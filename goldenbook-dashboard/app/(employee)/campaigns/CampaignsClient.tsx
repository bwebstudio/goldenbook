"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CampaignDTO } from "@/types/api/campaign";
import type { DashboardRole } from "@/types/auth";
import type { UnifiedPlacement } from "@/lib/api/campaigns";
import { updatePlacementStatus } from "@/lib/api/campaigns";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const STATUS_COLORS: Record<string, string> = {
  activated: "bg-emerald-50 text-emerald-700",
  active: "bg-emerald-50 text-emerald-700",
  paid: "bg-blue-50 text-blue-700",
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  expired: "bg-gray-100 text-gray-500",
  failed: "bg-red-50 text-red-600",
  refunded: "bg-red-50 text-red-600",
  rejected: "bg-red-50 text-red-600",
  draft: "bg-gray-100 text-gray-600",
  paused: "bg-amber-50 text-amber-700",
  ended: "bg-red-50 text-red-600",
};

const SOURCE_LABELS: Record<string, string> = {
  purchase: "Paid",
  request: "Request",
  editorial: "Editorial",
};

const SOURCE_COLORS: Record<string, string> = {
  purchase: "bg-gold/10 text-gold",
  request: "bg-blue-50 text-blue-600",
  editorial: "bg-purple-50 text-purple-600",
};

const SECTION_LABELS: Record<string, string> = {
  golden_picks: "Golden Picks",
  now: "Now",
  hidden_gems: "Hidden Gems",
  hidden_spots: "Hidden Gems",
  new_on_goldenbook: "New on Goldenbook",
  search_priority: "Search Priority",
  category_featured: "Category Featured",
  concierge: "Concierge",
  concierge_boost: "Concierge",
  now_recommendation: "Now",
  extra_images: "Extra Images",
  extended_description: "Extended Description",
  listing_premium_pack: "Premium Pack",
};

const PURCHASE_STATUSES = ["pending", "paid", "activated", "expired", "failed", "refunded"];
const REQUEST_STATUSES = ["pending", "approved", "active", "rejected", "expired"];

type Tab = "placements" | "inventory";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CampaignsClient({
  placements,
  campaigns,
  userRole,
}: {
  placements: UnifiedPlacement[];
  campaigns: CampaignDTO[];
  userRole: DashboardRole;
}) {
  const router = useRouter();
  const isSuperAdmin = userRole === "super_admin";
  const [tab, setTab] = useState<Tab>("placements");
  const [statusFilter, setStatusFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredPlacements = useMemo(() => {
    return placements.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (sectionFilter && p.section !== sectionFilter) return false;
      return true;
    });
  }, [placements, statusFilter, sectionFilter]);

  const placementSections = [...new Set(placements.map((p) => p.section))].sort();
  const placementStatuses = [...new Set(placements.map((p) => p.status))].sort();

  const activeCount = placements.filter((p) => p.status === "activated" || p.status === "active").length;
  const pendingCount = placements.filter((p) => p.status === "pending").length;
  const expiredCount = placements.filter((p) => p.status === "expired").length;

  async function handleStatusChange(placement: UnifiedPlacement, newStatus: string) {
    if (placement.source === "editorial") return;
    setSaving(true);
    try {
      await updatePlacementStatus(placement.id, placement.source as "purchase" | "request", newStatus);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  function getAvailableStatuses(p: UnifiedPlacement): string[] {
    if (p.source === "purchase") return PURCHASE_STATUSES;
    if (p.source === "request") return REQUEST_STATUSES;
    return [];
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-5">
          <p className="text-sm text-muted">Total</p>
          <p className="text-2xl font-bold text-text">{placements.length}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">Active</p>
          <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">Expired</p>
          <p className="text-2xl font-bold text-gray-400">{expiredCount}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 sm:gap-2 border-b border-border">
        <button
          onClick={() => setTab("placements")}
          className={`shrink-0 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            tab === "placements" ? "border-gold text-gold" : "border-transparent text-muted hover:text-text"
          }`}
        >
          All Placements ({placements.length})
        </button>
        <button
          onClick={() => setTab("inventory")}
          className={`shrink-0 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            tab === "inventory" ? "border-gold text-gold" : "border-transparent text-muted hover:text-text"
          }`}
        >
          Inventory Campaigns ({campaigns.length})
        </button>
      </div>

      {/* ═══ PLACEMENTS TAB ═══ */}
      {tab === "placements" && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:flex-wrap">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-auto rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text">
              <option value="">All Statuses</option>
              {placementStatuses.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="w-full sm:w-auto rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text">
              <option value="">All Sections</option>
              {placementSections.map((s) => <option key={s} value={s}>{SECTION_LABELS[s] ?? s}</option>)}
            </select>
            {(statusFilter || sectionFilter) && (
              <button onClick={() => { setStatusFilter(""); setSectionFilter(""); }} className="text-sm text-gold font-medium cursor-pointer">Clear</button>
            )}
          </div>

          {/* Mobile card layout */}
          <div className="flex flex-col gap-3 sm:hidden">
            {filteredPlacements.length === 0 && (
              <Card className="text-center !py-12">
                <p className="text-muted">No placements found.</p>
              </Card>
            )}
            {filteredPlacements.map((p) => {
              const key = `${p.source}-${p.id}`;
              const isEditing = editingId === key;
              const canEdit = isSuperAdmin && p.source !== "editorial";
              const statuses = getAvailableStatuses(p);

              return (
                <Card key={key} className="!p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-text">{p.place_name ?? "Unknown"}</p>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize shrink-0 ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${SOURCE_COLORS[p.source] ?? "bg-gray-100 text-gray-600"}`}>
                      {SOURCE_LABELS[p.source] ?? p.source}
                    </span>
                    <span className="text-xs text-muted">
                      {SECTION_LABELS[p.section] ?? p.section}
                      {p.position ? ` #${p.position}` : ""}
                    </span>
                    {p.city && <span className="text-xs text-muted capitalize">{p.city}</span>}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">{fmtDate(p.starts_at)} — {fmtDate(p.ends_at)}</span>
                    <span className="font-semibold text-text">{p.price ? `€${parseFloat(p.price).toFixed(0)}` : "—"}</span>
                  </div>
                  {isSuperAdmin && canEdit && (
                    <div className="flex flex-col gap-2">
                      {isEditing ? (
                        <>
                          <select
                            defaultValue={p.status}
                            onChange={(e) => handleStatusChange(p, e.target.value)}
                            disabled={saving}
                            className="w-full rounded-lg border border-gold bg-white px-3 py-2 text-xs font-semibold text-text focus:outline-none"
                          >
                            {statuses.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                          <button
                            onClick={() => setEditingId(null)}
                            className="w-full text-sm text-muted font-medium hover:text-text cursor-pointer py-2 rounded-lg border border-border"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingId(key)}
                          className="w-full text-sm text-gold font-medium hover:text-gold-dark cursor-pointer py-2 rounded-lg border border-gold/30"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Desktop table layout */}
          <Card className="overflow-hidden !p-0 hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-5 py-3 text-sm font-semibold text-muted">Place</th>
                    <th className="px-5 py-3 text-sm font-semibold text-muted">Section</th>
                    <th className="px-5 py-3 text-sm font-semibold text-muted">Source</th>
                    <th className="px-5 py-3 text-sm font-semibold text-muted">Status</th>
                    <th className="px-5 py-3 text-sm font-semibold text-muted">City</th>
                    <th className="px-5 py-3 text-sm font-semibold text-muted">Price</th>
                    <th className="px-5 py-3 text-sm font-semibold text-muted">Period</th>
                    {isSuperAdmin && <th className="px-5 py-3 text-sm font-semibold text-muted" />}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlacements.length === 0 && (
                    <tr><td colSpan={isSuperAdmin ? 8 : 7} className="px-5 py-12 text-center text-muted">No placements found.</td></tr>
                  )}
                  {filteredPlacements.map((p) => {
                    const key = `${p.source}-${p.id}`;
                    const isEditing = editingId === key;
                    const canEdit = isSuperAdmin && p.source !== "editorial";
                    const statuses = getAvailableStatuses(p);

                    return (
                      <tr key={key} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                        <td className="px-5 py-3.5 text-sm font-semibold text-text">{p.place_name ?? "Unknown"}</td>
                        <td className="px-5 py-3.5 text-sm">
                          {SECTION_LABELS[p.section] ?? p.section}
                          {p.position ? ` #${p.position}` : ""}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${SOURCE_COLORS[p.source] ?? "bg-gray-100 text-gray-600"}`}>
                            {SOURCE_LABELS[p.source] ?? p.source}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <select
                              defaultValue={p.status}
                              onChange={(e) => handleStatusChange(p, e.target.value)}
                              disabled={saving}
                              className="rounded-lg border border-gold bg-white px-2 py-1 text-xs font-semibold text-text focus:outline-none"
                            >
                              {statuses.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                          ) : (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {p.status}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted capitalize">{p.city ?? "—"}</td>
                        <td className="px-5 py-3.5 text-sm text-text">{p.price ? `€${parseFloat(p.price).toFixed(0)}` : "—"}</td>
                        <td className="px-5 py-3.5 text-sm text-muted whitespace-nowrap">{fmtDate(p.starts_at)} — {fmtDate(p.ends_at)}</td>
                        {isSuperAdmin && (
                          <td className="px-5 py-3.5">
                            {canEdit && !isEditing && (
                              <button
                                onClick={() => setEditingId(key)}
                                className="text-sm text-gold font-medium hover:text-gold-dark cursor-pointer"
                              >
                                Edit
                              </button>
                            )}
                            {isEditing && (
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-sm text-muted font-medium hover:text-text cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ═══ INVENTORY CAMPAIGNS TAB ═══ */}
      {tab === "inventory" && (
        <>
          {isSuperAdmin && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Link href="/campaigns/new" className="w-full sm:w-auto">
                <Button className="!px-5 !py-2.5 !text-sm w-full sm:w-auto">Create Campaign</Button>
              </Link>
            </div>
          )}

          {campaigns.length === 0 ? (
            <Card className="text-center !py-12">
              <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D2B68A" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              </div>
              <p className="text-base font-semibold text-text">No inventory campaigns yet</p>
              <p className="text-sm text-muted mt-1">Create a campaign to manage date-based inventory for premium placements.</p>
              {isSuperAdmin && (
                <Link href="/campaigns/new" className="inline-block mt-4 w-full sm:w-auto">
                  <Button className="!px-6 !py-2.5 !text-sm w-full sm:w-auto">Create your first campaign</Button>
                </Link>
              )}
            </Card>
          ) : (
            <>
            {/* Mobile card layout */}
            <div className="flex flex-col gap-3 sm:hidden">
              {campaigns.map((c) => (
                <Card key={c.id} className="!p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/campaigns/${c.id}`} className="font-semibold text-text hover:text-gold transition-colors text-sm">{c.name}</Link>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize shrink-0 ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{SECTION_LABELS[c.section] ?? c.section}</span>
                    <span>{c.city_name ?? "All"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">{fmtDate(c.start_date)} — {fmtDate(c.end_date)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text">{c.available_inventory}/{c.total_inventory}</span>
                      <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: c.total_inventory > 0 ? `${(c.sold_inventory / c.total_inventory) * 100}%` : "0%", backgroundColor: c.available_inventory === 0 ? "#EF4444" : "#10B981" }} />
                      </div>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <Link href={`/campaigns/${c.id}`} className="w-full text-center text-sm text-gold font-medium hover:text-gold-dark cursor-pointer py-2 rounded-lg border border-gold/30">
                      Manage
                    </Link>
                  )}
                </Card>
              ))}
            </div>

            {/* Desktop table layout */}
            <Card className="overflow-hidden !p-0 hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      <th className="px-5 py-3 text-sm font-semibold text-muted">Name</th>
                      <th className="px-5 py-3 text-sm font-semibold text-muted">Section</th>
                      <th className="px-5 py-3 text-sm font-semibold text-muted">City</th>
                      <th className="px-5 py-3 text-sm font-semibold text-muted">Status</th>
                      <th className="px-5 py-3 text-sm font-semibold text-muted text-center">Inventory</th>
                      <th className="px-5 py-3 text-sm font-semibold text-muted">Period</th>
                      {isSuperAdmin && <th className="px-5 py-3 text-sm font-semibold text-muted" />}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link href={`/campaigns/${c.id}`} className="font-semibold text-text hover:text-gold transition-colors">{c.name}</Link>
                        </td>
                        <td className="px-5 py-3.5 text-sm">{SECTION_LABELS[c.section] ?? c.section}</td>
                        <td className="px-5 py-3.5 text-sm text-muted">{c.city_name ?? "All"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-sm font-semibold text-text">{c.available_inventory}/{c.total_inventory}</span>
                          <div className="w-14 h-1.5 bg-gray-100 rounded-full mt-1 mx-auto overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: c.total_inventory > 0 ? `${(c.sold_inventory / c.total_inventory) * 100}%` : "0%", backgroundColor: c.available_inventory === 0 ? "#EF4444" : "#10B981" }} />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted whitespace-nowrap">{fmtDate(c.start_date)} — {fmtDate(c.end_date)}</td>
                        {isSuperAdmin && (
                          <td className="px-5 py-3.5">
                            <Link href={`/campaigns/${c.id}`} className="text-sm text-gold font-medium hover:text-gold-dark">Manage</Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
