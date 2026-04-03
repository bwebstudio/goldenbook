"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchAdminPricingConfig,
  updatePricingPlanAdmin,
  updateSeasonRuleAdmin,
  updateCityMultiplierAdmin,
  updatePromotionAdmin,
  previewPrice,
  type PricingPlan,
  type SeasonRule,
  type CityMultiplier,
  type Promotion,
  type PriceComputation,
} from "@/lib/api/pricing";

const CITIES = ["lisbon", "algarve", "madeira", "porto"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TYPE_LABELS: Record<string, string> = {
  golden_picks: "Golden Picks",
  now: "Now Recommendation",
  search_priority: "Search Priority",
  category_featured: "Category Featured",
  hidden_gems: "Hidden Gems Near You",
  concierge: "Concierge Recommendation",
  new_on_goldenbook: "New on Goldenbook",
  route_featured_stop: "Route Featured Stop",
  route_sponsor: "Route Sponsor",
  extra_images: "Extra Images (up to 10) · Monthly",
  extended_description: "Extended Description (up to 600 chars) · Monthly",
};

const SEASON_COLORS: Record<string, string> = {
  high: "bg-amber-50 text-amber-700 border-amber-200",
  mid: "bg-blue-50 text-blue-700 border-blue-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

type Tab = "plans" | "cities" | "seasons" | "promotions" | "preview";

export default function PricingClient({ readOnly = false }: { readOnly?: boolean }) {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [seasons, setSeasons] = useState<SeasonRule[]>([]);
  const [cities, setCities] = useState<CityMultiplier[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("plans");
  const [saving, setSaving] = useState<string | null>(null);

  // Preview state
  const [previewPlanId, setPreviewPlanId] = useState("");
  const [previewCity, setPreviewCity] = useState("lisbon");
  const [previewMonth, setPreviewMonth] = useState(new Date().getMonth() + 1);
  const [previewResult, setPreviewResult] = useState<PriceComputation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminPricingConfig();
      setPlans(data.plans);
      setSeasons(data.seasons);
      setCities(data.cities);
      setPromotions(data.promotions);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const savePlan = async (plan: PricingPlan, val: string) => {
    const price = parseFloat(val);
    if (isNaN(price) || price < 0) return;
    setSaving(plan.id);
    try {
      const u = await updatePricingPlanAdmin(plan.id, { basePrice: price });
      setPlans((p) => p.map((x) => (x.id === u.id ? u : x)));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const togglePlan = async (plan: PricingPlan) => {
    setSaving(plan.id);
    try {
      const u = await updatePricingPlanAdmin(plan.id, { isActive: !plan.is_active });
      setPlans((p) => p.map((x) => (x.id === u.id ? u : x)));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const saveSeason = async (rule: SeasonRule, val: string) => {
    const m = parseFloat(val);
    if (isNaN(m) || m < 0) return;
    setSaving(rule.id);
    try {
      const u = await updateSeasonRuleAdmin(rule.id, { multiplier: m });
      setSeasons((s) => s.map((x) => (x.id === u.id ? u : x)));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const toggleSeason = async (rule: SeasonRule) => {
    setSaving(rule.id);
    try {
      const u = await updateSeasonRuleAdmin(rule.id, { isActive: !rule.is_active });
      setSeasons((s) => s.map((x) => (x.id === u.id ? u : x)));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const saveCity = async (c: CityMultiplier, val: string) => {
    const m = parseFloat(val);
    if (isNaN(m) || m < 0) return;
    setSaving(c.id);
    try {
      const u = await updateCityMultiplierAdmin(c.id, { multiplier: m });
      setCities((cs) => cs.map((x) => (x.id === u.id ? u : x)));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const savePromo = async (p: Promotion, field: string, val: string | boolean) => {
    setSaving(p.id);
    try {
      const body: Record<string, unknown> = {};
      if (field === "discountPct") body.discountPct = parseFloat(val as string);
      if (field === "label") body.label = val;
      if (field === "validUntil") body.validUntil = val || null;
      if (field === "isActive") body.isActive = val;
      const u = await updatePromotionAdmin(p.id, body as Parameters<typeof updatePromotionAdmin>[1]);
      setPromotions((ps) => ps.map((x) => (x.id === u.id ? u : x)));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const handlePreview = async () => {
    if (!previewPlanId) return;
    try {
      const r = await previewPrice(previewPlanId, previewCity, previewMonth);
      setPreviewResult(r);
    } catch { setPreviewResult(null); }
  };

  // Group plans
  const grouped = plans.reduce<Record<string, PricingPlan[]>>((acc, p) => {
    const key = p.pricing_type === "membership" ? "membership" : (p.placement_type ?? "other");
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "plans", label: "Base Prices (Lisboa)" },
    { key: "cities", label: "City Multipliers" },
    { key: "seasons", label: "Season Rules" },
    { key: "promotions", label: "Promotions" },
    { key: "preview", label: "Price Preview" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">Pricing Management</h1>
        <p className="text-xs text-muted mt-0.5">Base prices, city index, season rules, and promotions</p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 border-b border-border -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              tab === t.key ? "text-gold border-b-2 border-gold" : "text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ PLANS TAB ═══ */}
      {tab === "plans" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">These are Lisboa base prices. Other cities are calculated using city multipliers.</p>
          {Object.entries(grouped).map(([key, items]) => (
            <div key={key} className="bg-white rounded-xl border border-border">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-bold text-text">
                  {key === "membership" ? "Annual Membership" : TYPE_LABELS[key] ?? key}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      {key === "golden_picks" && <th className="px-5 py-2.5">Position</th>}
                      <th className="px-5 py-2.5">Unit</th>
                      <th className="px-5 py-2.5">Base Price (Lisboa)</th>
                      <th className="px-5 py-2.5">Active</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((plan) => (
                      <PlanRow key={plan.id} plan={plan} showPosition={key === "golden_picks"} saving={saving === plan.id} onSave={savePlan} onToggle={togglePlan} readOnly={readOnly} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ CITIES TAB ═══ */}
      {tab === "cities" && (
        <div className="bg-white rounded-xl border border-border w-full sm:max-w-lg">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-text">City Index Multipliers</h3>
            <p className="text-xs text-muted mt-0.5">City price = Lisboa base &times; multiplier</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="px-5 py-2.5">City</th>
                  <th className="px-5 py-2.5">Multiplier</th>
                  <th className="px-5 py-2.5">Effect</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <CityRow key={c.id} city={c} saving={saving === c.id} onSave={saveCity} readOnly={readOnly} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ SEASONS TAB ═══ */}
      {tab === "seasons" && (
        <div className="flex flex-col gap-4">
          {CITIES.map((city) => {
            const rules = seasons.filter((s) => s.city === city);
            if (!rules.length) return null;
            return (
              <div key={city} className="bg-white rounded-xl border border-border">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="text-sm font-bold text-text">{city.charAt(0).toUpperCase() + city.slice(1)}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted border-b border-border">
                        <th className="px-5 py-2.5">Season</th>
                        <th className="px-5 py-2.5">Months</th>
                        <th className="px-5 py-2.5">Multiplier</th>
                        <th className="px-5 py-2.5">Effect</th>
                        <th className="px-5 py-2.5">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((r) => (
                        <SeasonRow key={r.id} rule={r} saving={saving === r.id} onSave={saveSeason} onToggle={toggleSeason} readOnly={readOnly} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ PROMOTIONS TAB ═══ */}
      {tab === "promotions" && (
        <div className="flex flex-col gap-4 w-full sm:max-w-2xl">
          {promotions.length === 0 && <p className="text-sm text-muted">No promotions configured.</p>}
          {promotions.map((p) => (
            <PromoCard key={p.id} promo={p} saving={saving === p.id} onSave={savePromo} readOnly={readOnly} />
          ))}
        </div>
      )}

      {/* ═══ PREVIEW TAB ═══ */}
      {tab === "preview" && (
        <div className="bg-white rounded-xl border border-border p-5 w-full sm:max-w-lg">
          <h3 className="text-sm font-bold text-text mb-4">Compute Final Price</h3>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted mb-1 block">Plan</label>
                <select value={previewPlanId} onChange={(e) => { setPreviewPlanId(e.target.value); setPreviewResult(null); }} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-gold">
                  <option value="">Select a plan...</option>
                  {plans.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pricing_type === "membership" ? "Membership" : `${TYPE_LABELS[p.placement_type ?? ""] ?? p.placement_type}${p.position ? ` #${p.position}` : ""}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">City</label>
                <select value={previewCity} onChange={(e) => { setPreviewCity(e.target.value); setPreviewResult(null); }} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-gold">
                  {CITIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Month</label>
                <select value={previewMonth} onChange={(e) => { setPreviewMonth(parseInt(e.target.value)); setPreviewResult(null); }} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-gold">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handlePreview} disabled={!previewPlanId} className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50">Compute</button>

            {previewResult && (
              <div className="mt-2 bg-gold/5 border border-gold/20 rounded-lg p-4">
                <div className="flex flex-col gap-2 text-sm sm:grid sm:grid-cols-2">
                  <span className="text-muted">Lisboa base:</span>
                  <span className="font-medium text-text">&euro;{previewResult.basePrice.toFixed(2)}</span>
                  <span className="text-muted">City &times;:</span>
                  <span className="font-medium text-text">&times;{previewResult.cityMultiplier.toFixed(2)}</span>
                  <span className="text-muted">Season:</span>
                  <span className="font-medium text-text">{previewResult.seasonName ?? "None"} (&times;{previewResult.seasonMultiplier.toFixed(2)})</span>
                  <span className="text-muted">Full price:</span>
                  <span className="font-medium text-text">&euro;{previewResult.fullPrice.toFixed(2)}</span>
                  {previewResult.promoDiscount > 0 && (
                    <>
                      <span className="text-muted">Promotion:</span>
                      <span className="font-medium text-emerald-600">-{previewResult.promoDiscount}%</span>
                    </>
                  )}
                  <span className="text-muted font-bold">Final price:</span>
                  <span className="font-bold text-gold text-lg">&euro;{previewResult.finalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InlineEdit({ value, onSave, type = "number", step = "0.01", width = "w-24", readOnly = false }: {
  value: string; onSave: (v: string) => void; type?: string; step?: string; width?: string; readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  const display = type === "number" ? (value.includes(".") ? parseFloat(value).toFixed(2) : value) : value;
  if (readOnly || !editing) {
    return readOnly ? (
      <span className="font-semibold text-text">{display}</span>
    ) : (
      <button onClick={() => { setV(value); setEditing(true); }} className="font-semibold text-text hover:text-gold transition-colors cursor-pointer">
        {display}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input type={type} step={step} value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onSave(v); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
        className={`${width} rounded border border-gold px-2 py-1 text-sm focus:outline-none`} autoFocus />
      <button onClick={() => { onSave(v); setEditing(false); }} className="text-gold text-xs font-bold cursor-pointer">Save</button>
      <button onClick={() => setEditing(false)} className="text-muted text-xs cursor-pointer">Cancel</button>
    </div>
  );
}

function Toggle({ active, onToggle, disabled, readOnly = false }: { active: boolean; onToggle: () => void; disabled?: boolean; readOnly?: boolean }) {
  return (
    <button onClick={onToggle} disabled={disabled || readOnly} className={`w-9 h-5 rounded-full transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${active ? "bg-emerald-400" : "bg-gray-300"}`}>
      <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function PlanRow({ plan, showPosition, saving, onSave, onToggle, readOnly = false }: {
  plan: PricingPlan; showPosition: boolean; saving: boolean;
  onSave: (p: PricingPlan, v: string) => void; onToggle: (p: PricingPlan) => void; readOnly?: boolean;
}) {
  return (
    <tr className={`border-b border-border/50 ${!plan.is_active ? "opacity-50" : ""}`}>
      {showPosition && <td className="px-5 py-3">#{plan.position}</td>}
      <td className="px-5 py-3 text-muted">{plan.unit_label}</td>
      <td className="px-5 py-3">
        <span className="mr-1">&euro;</span>
        <InlineEdit value={plan.base_price} onSave={(v) => onSave(plan, v)} readOnly={readOnly} />
      </td>
      <td className="px-5 py-3">
        {readOnly
          ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.is_active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>{plan.is_active ? "Active" : "Inactive"}</span>
          : <Toggle active={plan.is_active} onToggle={() => onToggle(plan)} disabled={saving} />}
      </td>
      <td className="px-5 py-3">{saving && <span className="text-[10px] text-gold">Saving...</span>}</td>
    </tr>
  );
}

function CityRow({ city, saving, onSave, readOnly = false }: {
  city: CityMultiplier; saving: boolean; onSave: (c: CityMultiplier, v: string) => void; readOnly?: boolean;
}) {
  const mult = parseFloat(city.multiplier);
  const pct = Math.round((mult - 1) * 100);
  return (
    <tr className="border-b border-border/50">
      <td className="px-5 py-3 font-medium">{city.city.charAt(0).toUpperCase() + city.city.slice(1)}</td>
      <td className="px-5 py-3">
        <span className="mr-1">&times;</span>
        <InlineEdit value={city.multiplier} onSave={(v) => onSave(city, v)} width="w-20" readOnly={readOnly} />
        {saving && <span className="text-[10px] text-gold ml-2">Saving...</span>}
      </td>
      <td className="px-5 py-3 text-muted text-xs">{pct === 0 ? "Base" : `${pct > 0 ? "+" : ""}${pct}%`}</td>
    </tr>
  );
}

function SeasonRow({ rule, saving, onSave, onToggle, readOnly = false }: {
  rule: SeasonRule; saving: boolean;
  onSave: (r: SeasonRule, v: string) => void; onToggle: (r: SeasonRule) => void; readOnly?: boolean;
}) {
  const mult = parseFloat(rule.multiplier);
  const pct = Math.round((mult - 1) * 100);
  const col = SEASON_COLORS[rule.season_name] ?? "bg-gray-50 text-gray-700";
  return (
    <tr className={`border-b border-border/50 ${!rule.is_active ? "opacity-50" : ""}`}>
      <td className="px-5 py-3"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${col}`}>{rule.season_name}</span></td>
      <td className="px-5 py-3 text-muted">{MONTHS[rule.month_from - 1]} \u2013 {MONTHS[rule.month_to - 1]}</td>
      <td className="px-5 py-3"><span className="mr-1">&times;</span><InlineEdit value={rule.multiplier} onSave={(v) => onSave(rule, v)} width="w-20" readOnly={readOnly} /></td>
      <td className="px-5 py-3 text-muted text-xs">{pct === 0 ? "Base" : `${pct > 0 ? "+" : ""}${pct}%`}</td>
      <td className="px-5 py-3">
        {readOnly
          ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rule.is_active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>{rule.is_active ? "Active" : "Inactive"}</span>
          : <Toggle active={rule.is_active} onToggle={() => onToggle(rule)} disabled={saving} />}
      </td>
    </tr>
  );
}

function PromoCard({ promo, saving, onSave, readOnly = false }: {
  promo: Promotion; saving: boolean;
  onSave: (p: Promotion, field: string, val: string | boolean) => void;
  readOnly?: boolean;
}) {
  const [editDiscount, setEditDiscount] = useState(false);
  const [editLabel, setEditLabel] = useState(false);
  const [editUntil, setEditUntil] = useState(false);
  const [dv, setDv] = useState(promo.discount_pct);
  const [lv, setLv] = useState(promo.label);
  const [uv, setUv] = useState(promo.valid_until?.slice(0, 10) ?? "");

  return (
    <div className={`bg-white rounded-xl border p-5 ${promo.is_active ? "border-emerald-200" : "border-border opacity-60"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-text">{promo.name}</h3>
        {readOnly
          ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${promo.is_active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>{promo.is_active ? "Active" : "Inactive"}</span>
          : <Toggle active={promo.is_active} onToggle={() => onSave(promo, "isActive", !promo.is_active)} disabled={saving} />}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-y-2.5 gap-x-3 text-sm">
        <span className="text-muted">Discount:</span>
        <div>
          {!readOnly && editDiscount ? (
            <div className="flex items-center gap-1.5">
              <input type="number" step="1" value={dv} onChange={(e) => setDv(e.target.value)} className="w-20 rounded border border-gold px-2 py-1 text-sm focus:outline-none" autoFocus />
              <span className="text-muted">%</span>
              <button onClick={() => { onSave(promo, "discountPct", dv); setEditDiscount(false); }} className="text-gold text-xs font-bold cursor-pointer">Save</button>
            </div>
          ) : readOnly ? (
            <span className="font-semibold text-text">{parseFloat(promo.discount_pct)}%</span>
          ) : (
            <button onClick={() => { setDv(promo.discount_pct); setEditDiscount(true); }} className="font-semibold text-text hover:text-gold cursor-pointer">{parseFloat(promo.discount_pct)}%</button>
          )}
        </div>

        <span className="text-muted">Label:</span>
        <div>
          {!readOnly && editLabel ? (
            <div className="flex items-center gap-1.5">
              <input type="text" value={lv} onChange={(e) => setLv(e.target.value)} className="w-full sm:w-64 rounded border border-gold px-2 py-1 text-sm focus:outline-none" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { onSave(promo, "label", lv); setEditLabel(false); } }} />
              <button onClick={() => { onSave(promo, "label", lv); setEditLabel(false); }} className="text-gold text-xs font-bold cursor-pointer">Save</button>
            </div>
          ) : readOnly ? (
            <span className="font-medium text-text">{promo.label}</span>
          ) : (
            <button onClick={() => { setLv(promo.label); setEditLabel(true); }} className="font-medium text-text hover:text-gold cursor-pointer">{promo.label}</button>
          )}
        </div>

        <span className="text-muted">Valid until:</span>
        <div>
          {!readOnly && editUntil ? (
            <div className="flex items-center gap-1.5">
              <input type="date" value={uv} onChange={(e) => setUv(e.target.value)} className="rounded border border-gold px-2 py-1 text-sm focus:outline-none" autoFocus />
              <button onClick={() => { onSave(promo, "validUntil", uv ? `${uv}T23:59:59Z` : ""); setEditUntil(false); }} className="text-gold text-xs font-bold cursor-pointer">Save</button>
            </div>
          ) : readOnly ? (
            <span className="font-medium text-text">
              {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No expiry"}
            </span>
          ) : (
            <button onClick={() => { setUv(promo.valid_until?.slice(0, 10) ?? ""); setEditUntil(true); }} className="font-medium text-text hover:text-gold cursor-pointer">
              {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No expiry"}
            </button>
          )}
        </div>

        <span className="text-muted">Applies to:</span>
        <span className="font-medium text-text">{promo.applies_to}</span>
      </div>
      {saving && <p className="text-[10px] text-gold mt-2">Saving...</p>}
    </div>
  );
}
