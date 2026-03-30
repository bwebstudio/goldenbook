"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import {
  fetchVisibilities,
  createVisibilityApi,
  updateVisibilityApi,
  deleteVisibilityApi,
  type VisibilityDTO,
} from "@/lib/api/visibility";

const SURFACE_KEYS = [
  "golden_picks",
  "hidden_spots",
  "now",
  "search_priority",
  "category_featured",
  "concierge",
  "route_featured",
  "route_sponsor",
  "new_on_goldenbook",
] as const;

interface Props {
  placeId: string;
}

export default function PlaceVisibility({ placeId }: Props) {
  const router = useRouter();
  const t = useT();
  const [items, setItems] = useState<VisibilityDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Build labels and options dynamically from translations
  const SURFACE_LABELS: Record<string, string> = {
    golden_picks: t.surfaces.golden_picks,
    hidden_spots: t.surfaces.hidden_spots,
    now: t.surfaces.now,
    search_priority: t.surfaces.search_priority,
    category_featured: t.surfaces.category_featured,
    concierge: t.surfaces.concierge,
    route_featured: t.surfaces.route_featured,
    route_sponsor: t.surfaces.route_sponsor,
    new_on_goldenbook: t.surfaces.new_on_goldenbook,
    // Legacy
    category_feature: t.surfaces.category_featured,
    now_recommendation: t.surfaces.now,
    concierge_boost: t.surfaces.concierge,
  };

  const SURFACE_OPTIONS = SURFACE_KEYS.map((key) => ({
    value: key,
    label: t.surfaces[key],
  }));

  const TYPE_OPTIONS = [
    { value: "editorial", label: t.empPlacements.editorial },
    { value: "sponsored", label: t.empPlacements.sponsored },
  ];

  // Add form state
  const [newSurface, setNewSurface] = useState("golden_picks");
  const [newType, setNewType] = useState("editorial");
  const [newPriority, setNewPriority] = useState(0);
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newSource, setNewSource] = useState("system");
  const [newSlot, setNewSlot] = useState("");
  const [newScopeType, setNewScopeType] = useState("");
  const [newScopeId, setNewScopeId] = useState("");

  const load = useCallback(async () => {
    try { setItems(await fetchVisibilities(placeId)); } catch { setItems([]); }
    finally { setLoading(false); }
  }, [placeId]);

  useEffect(() => { load(); }, [load]);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); router.refresh(); } finally { setBusy(false); }
  };

  const handleAdd = async () => {
    await withBusy(async () => {
      await createVisibilityApi(placeId, {
        surface: newSurface,
        visibilityType: newType,
        priority: newPriority,
        startsAt: newStartsAt || null,
        endsAt: newEndsAt || null,
        notes: newNotes || null,
        source: newSource,
        placementSlot: newSlot || null,
        scopeType: newScopeType || null,
        scopeId: newScopeId || null,
      });
    });
    setShowAdd(false);
    setNewSurface("golden_picks");
    setNewType("editorial");
    setNewPriority(0);
    setNewStartsAt("");
    setNewEndsAt("");
    setNewNotes("");
    setNewSource("system");
    setNewSlot("");
    setNewScopeType("");
    setNewScopeId("");
  };

  const handleToggleActive = async (item: VisibilityDTO) => {
    await withBusy(async () => {
      await updateVisibilityApi(item.id, { isActive: !item.is_active });
    });
  };

  const handleDelete = async (item: VisibilityDTO) => {
    await withBusy(async () => { await deleteVisibilityApi(item.id); });
  };

  if (loading) return <p className="text-sm text-muted py-3">{t.empVisibility.loading}</p>;

  const isExpired = (item: VisibilityDTO) => item.ends_at && new Date(item.ends_at) < new Date();
  const isScheduled = (item: VisibilityDTO) => item.starts_at && new Date(item.starts_at) > new Date();

  return (
    <div className="flex flex-col gap-5">
      {/* Existing assignments */}
      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-4 ${
                !item.is_active || isExpired(item)
                  ? "border-border bg-surface opacity-60"
                  : item.visibility_type === "sponsored"
                    ? "border-gold/30 bg-gold/5"
                    : "border-green-200 bg-green-50/50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text">{SURFACE_LABELS[item.surface] ?? item.surface}</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                    item.visibility_type === "sponsored" ? "bg-gold/20 text-gold-dark" : "bg-blue-50 text-blue-600"
                  }`}>
                    {item.visibility_type}
                  </span>
                  {isExpired(item) && <span className="text-[10px] font-medium text-red-500 uppercase">{t.empVisibility.expired}</span>}
                  {isScheduled(item) && <span className="text-[10px] font-medium text-amber-600 uppercase">{t.empVisibility.scheduled}</span>}
                  {!item.is_active && <span className="text-[10px] font-medium text-muted uppercase">{t.empVisibility.inactive}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                  <span>{t.empVisibility.priorityLabel.split(" (")[0]}: {item.priority}</span>
                  {item.starts_at && <span>{t.empVisibility.startDate.split(" (")[0]}: {new Date(item.starts_at).toLocaleDateString()}</span>}
                  {item.ends_at && <span>{t.empVisibility.endDate.split(" (")[0]}: {new Date(item.ends_at).toLocaleDateString()}</span>}
                </div>
                {item.notes && <p className="text-xs text-muted mt-1 italic">{item.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggleActive(item)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-text transition-colors bg-white cursor-pointer disabled:opacity-50"
                >
                  {item.is_active ? t.empVisibility.deactivate : t.empVisibility.activate}
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-red-600 hover:border-red-200 transition-colors bg-white cursor-pointer disabled:opacity-50"
                >
                  {t.empVisibility.remove}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{t.empVisibility.noAssignments}</p>
      )}

      {/* Add new */}
      {showAdd ? (
        <div className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold text-text">{t.empVisibility.addToSection}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.section}</label>
              <select value={newSurface} onChange={e => setNewSurface(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold">
                {SURFACE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.type}</label>
              <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold">
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.priorityLabel}</label>
              <input type="number" value={newPriority} onChange={e => setNewPriority(parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.sourceLabel}</label>
              <select value={newSource} onChange={e => setNewSource(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold">
                <option value="system">{t.empVisibility.sourceSystem}</option>
                <option value="sponsored">{t.empVisibility.sourceSponsored}</option>
                <option value="superadmin">{t.empVisibility.sourceSuperadmin}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.notes}</label>
              <input type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder={t.empVisibility.notesPlaceholder} className="w-full rounded-lg border border-border px-3 py-2 text-sm placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold" />
            </div>
            {newSurface === "now" && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.timeSlot}</label>
                <select value={newSlot} onChange={e => setNewSlot(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold">
                  <option value="">{t.empVisibility.anyTime}</option>
                  <option value="morning">{t.empVisibility.morning}</option>
                  <option value="afternoon">{t.empVisibility.afternoon}</option>
                  <option value="dinner">{t.empVisibility.dinner}</option>
                  <option value="night">{t.empVisibility.night}</option>
                </select>
              </div>
            )}
            {(newSurface === "category_featured" || newSurface === "search_priority") && (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.scopeType}</label>
                  <select value={newScopeType} onChange={e => setNewScopeType(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold">
                    <option value="">{t.empVisibility.scopeNone}</option>
                    <option value="main_category">{t.empVisibility.scopeMainCategory}</option>
                    {newSurface === "search_priority" && <option value="search_vertical">{t.empVisibility.scopeSearchVertical}</option>}
                  </select>
                </div>
                {newScopeType && (
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.scopeId}</label>
                    <input type="text" value={newScopeId} onChange={e => setNewScopeId(e.target.value)} placeholder={t.empVisibility.scopeIdPlaceholder} className="w-full rounded-lg border border-border px-3 py-2 text-sm placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold" />
                  </div>
                )}
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.startDate}</label>
              <input type="date" value={newStartsAt} onChange={e => setNewStartsAt(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t.empVisibility.endDate}</label>
              <input type="date" value={newEndsAt} onChange={e => setNewEndsAt(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleAdd} disabled={busy} className="px-5 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50">{t.empVisibility.add}</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted hover:text-text transition-colors cursor-pointer">{t.common.cancel}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          disabled={busy}
          className="self-start px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted hover:text-text hover:border-gold/50 transition-colors bg-white cursor-pointer disabled:opacity-50"
        >
          {t.empVisibility.addToSection}
        </button>
      )}
    </div>
  );
}
