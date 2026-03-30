"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { AdminCampaignDetailResponse, InventoryItemDTO } from "@/types/api/campaign";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BulkInventoryForm from "@/components/campaigns/BulkInventoryForm";
import { updateAdminCampaign } from "@/lib/api/campaigns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  ended: "bg-red-50 text-red-600",
};

const SECTION_LABELS: Record<string, string> = {
  golden_picks: "Golden Picks",
  now: "Now",
  hidden_gems: "Hidden Gems",
  new_on_goldenbook: "New on Goldenbook",
  search_priority: "Search Priority",
  category_featured: "Category Featured",
  concierge: "Concierge",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CampaignDetailClient({ data }: { data: AdminCampaignDetailResponse }) {
  const router = useRouter();
  const { campaign, slots, inventory } = data;

  // UI state
  const [timeBucketFilter, setTimeBucketFilter] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [editName, setEditName] = useState(campaign.name);
  const [editSlotLimit, setEditSlotLimit] = useState(campaign.slot_limit.toString());
  const [editPriority, setEditPriority] = useState(campaign.priority.toString());

  // ── Grid data ─────────────────────────────────────────────────────────────
  const { dates, positions, gridMap } = useMemo(() => {
    const filtered = timeBucketFilter
      ? inventory.filter((i) => i.time_bucket === timeBucketFilter)
      : inventory;

    const dateSet = new Set<string>();
    const posSet = new Set<number>();
    const map = new Map<string, InventoryItemDTO>();

    for (const item of filtered) {
      dateSet.add(item.date);
      posSet.add(item.position);
      map.set(`${item.date}:${item.position}`, item);
    }

    return {
      dates: [...dateSet].sort(),
      positions: [...posSet].sort((a, b) => a - b),
      gridMap: map,
    };
  }, [inventory, timeBucketFilter]);

  const timeBuckets = [...new Set(inventory.map((i) => i.time_bucket))].sort();

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleStatusChange(newStatus: string) {
    try {
      await updateAdminCampaign(campaign.id, { status: newStatus });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await updateAdminCampaign(campaign.id, {
        name: editName,
        slot_limit: parseInt(editSlotLimit) || campaign.slot_limit,
        priority: parseInt(editPriority) || 0,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header + Status Controls ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-text">{campaign.name}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[campaign.status] ?? ""}`}>
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            {SECTION_LABELS[campaign.section] ?? campaign.section} · {campaign.section_group} · {campaign.city_name ?? "All cities"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit button — always visible */}
          {!editing && (
            <Button
              variant="outline"
              onClick={() => setEditing(true)}
              className="!px-5 !py-2.5 !text-sm"
            >
              Edit
            </Button>
          )}

          {/* Status controls */}
          {campaign.status === "draft" && (
            <Button variant="primary" onClick={() => handleStatusChange("active")} className="!px-5 !py-2.5 !text-sm">
              Activate
            </Button>
          )}
          {campaign.status === "active" && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange("paused")} className="!px-5 !py-2.5 !text-sm">
                Pause
              </Button>
              <Button variant="outline" onClick={() => handleStatusChange("ended")} className="!px-5 !py-2.5 !text-sm !text-red-600 !border-red-200 hover:!bg-red-50">
                End
              </Button>
            </>
          )}
          {campaign.status === "paused" && (
            <>
              <Button variant="primary" onClick={() => handleStatusChange("active")} className="!px-5 !py-2.5 !text-sm">
                Resume
              </Button>
              <Button variant="outline" onClick={() => handleStatusChange("ended")} className="!px-5 !py-2.5 !text-sm !text-red-600 !border-red-200 hover:!bg-red-50">
                End
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Inline Edit Form ─────────────────────────────────────────────── */}
      {editing && (
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-semibold text-text mb-1.5 block">Campaign name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-text focus:outline-none focus:ring-2 focus:border-gold focus:ring-gold/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-text mb-1.5 block">Slot limit</label>
                <input
                  type="number"
                  value={editSlotLimit}
                  onChange={(e) => setEditSlotLimit(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-text focus:outline-none focus:ring-2 focus:border-gold focus:ring-gold/20"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-text mb-1.5 block">Priority</label>
                <input
                  type="number"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-text focus:outline-none focus:ring-2 focus:border-gold focus:ring-gold/20"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSaveEdit} disabled={saving} className="!px-6 !py-2.5 !text-sm">
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => { setEditing(false); setEditName(campaign.name); setEditSlotLimit(campaign.slot_limit.toString()); setEditPriority(campaign.priority.toString()); }} className="!px-5 !py-2.5 !text-sm">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Inventory", value: campaign.total_inventory },
          { label: "Sold", value: campaign.sold_inventory },
          { label: "Available", value: campaign.available_inventory },
          { label: "Active Slots", value: slots.filter((s) => s.status === "active").length },
        ].map((stat) => (
          <Card key={stat.label} className="!p-5">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="text-2xl font-bold text-text mt-1">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Period */}
      <Card className="!p-5">
        <p className="text-sm text-muted">Period</p>
        <p className="text-base font-semibold text-text mt-1">
          {fmtDate(campaign.start_date)} — {fmtDate(campaign.end_date)}
        </p>
      </Card>

      {/* ── Inventory Management ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-text">Inventory</h3>
        <Button variant="outline" onClick={() => setShowBulk(!showBulk)} className="!px-5 !py-2.5 !text-sm">
          {showBulk ? "Hide" : "Add Inventory"}
        </Button>
      </div>

      {showBulk && (
        <BulkInventoryForm campaignId={campaign.id} onCreated={() => { setShowBulk(false); router.refresh(); }} />
      )}

      {/* Time bucket filter */}
      {timeBuckets.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted font-medium">Filter:</span>
          <button
            onClick={() => setTimeBucketFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${!timeBucketFilter ? "bg-gold text-white" : "bg-surface text-muted hover:bg-gray-100"}`}
          >
            All
          </button>
          {timeBuckets.map((tb) => (
            <button
              key={tb}
              onClick={() => setTimeBucketFilter(tb)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors ${timeBucketFilter === tb ? "bg-gold text-white" : "bg-surface text-muted hover:bg-gray-100"}`}
            >
              {tb.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {/* ── Inventory Grid ───────────────────────────────────────────────── */}
      {dates.length === 0 ? (
        <Card className="text-center !py-12">
          <p className="text-muted">No inventory yet. Add inventory to start selling.</p>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface px-4 py-3 text-sm font-semibold text-muted border-b border-r border-border min-w-[80px]">
                    Pos.
                  </th>
                  {dates.map((d) => (
                    <th key={d} className="px-3 py-3 text-xs font-semibold text-muted border-b border-border whitespace-nowrap min-w-[72px] text-center">
                      {new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos}>
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm font-semibold text-text border-r border-border">
                      #{pos}
                    </td>
                    {dates.map((d) => {
                      const item = gridMap.get(`${d}:${pos}`);
                      const isSold = item?.status === "sold";
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          <div
                            className={`w-full h-10 rounded-lg flex items-center justify-center text-xs font-medium ${
                              isSold
                                ? "bg-red-100 text-red-700"
                                : item
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-50 text-gray-300"
                            }`}
                            title={
                              isSold
                                ? `Sold — Place: ${item?.place_id?.slice(0, 8) ?? "?"}`
                                : item
                                  ? "Available"
                                  : "No inventory"
                            }
                          >
                            {isSold ? "SOLD" : item ? "OK" : "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Slots ────────────────────────────────────────────────────────── */}
      {slots.length > 0 && (
        <>
          <h3 className="text-lg font-bold text-text">Active Slots</h3>
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-6 py-3 text-sm font-semibold text-muted">Place</th>
                  <th className="px-6 py-3 text-sm font-semibold text-muted">Status</th>
                  <th className="px-6 py-3 text-sm font-semibold text-muted">Period</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-3 text-sm font-medium text-text">{slot.place_name ?? slot.place_id.slice(0, 8)}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${STATUS_COLORS[slot.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {slot.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-muted">
                      {fmtDate(slot.starts_at)} — {fmtDate(slot.ends_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
