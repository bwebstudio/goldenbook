"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useT } from "@/lib/i18n";
import {
  fetchBusinessPricing,
  computeBusinessPrice,
  createCheckoutSession,
  fetchPricingAvailability,
  fetchPricingCalendar,
  type PricingPlan,
  type ActivePromoInfo,
  type BusinessCity,
  type PriceComputation,
  type SectionAvailability,
  type BlockedRange,
} from "@/lib/api/pricing";

// ── Product groups ──────────────────────────────────────────────────────────

const PRODUCT_GROUPS = [
  { key: "discover", products: ["golden_picks", "now", "hidden_gems", "new_on_goldenbook"] },
  { key: "intent", products: ["search_priority", "category_featured"] },
  { key: "dynamic", products: ["concierge"] },
  { key: "listing", products: ["extra_images", "extended_description"] },
] as const;

const GROUP_LABELS: Record<string, Record<string, string>> = {
  en: { discover: "Discover (Exclusive)", intent: "Search & Categories", dynamic: "Concierge", listing: "Listing Upgrades" },
  pt: { discover: "Descobrir (Exclusivo)", intent: "Pesquisa & Categorias", dynamic: "Concierge", listing: "Melhorias do Espaço" },
};

const SCOPE_PRODUCTS = new Set(["search_priority", "category_featured"]);

function fmtValidUntil(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Calendar helpers ────────────────────────────────────────────────────────

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function isDateBlocked(dateStr: string, ranges: BlockedRange[]): boolean {
  for (const r of ranges) {
    if (dateStr >= r.starts_at && dateStr < r.ends_at) return true;
  }
  return false;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ═════════════════════════════════════════════════════════════════════════════

export default function PortalPromote() {
  const t = useT();

  // State
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [scopeId, setScopeId] = useState("");
  const [city, setCity] = useState("");
  const [position, setPosition] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);

  // Data
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [promotion, setPromotion] = useState<ActivePromoInfo | null>(null);
  const [businessCities, setBusinessCities] = useState<BusinessCity[]>([]);
  const [availability, setAvailability] = useState<Record<string, SectionAvailability>>({});
  const [inventory, setInventory] = useState<Record<string, { max: number; active: number; remaining: number }>>({});
  const [inventoryCity, setInventoryCity] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [computed, setComputed] = useState<PriceComputation | null>(null);
  const [computing, setComputing] = useState(false);

  // Calendar
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });

  const products = t.promote.products as Record<string, { label: string; tagline: string; description: string; where: string; why: string; context?: string }>;
  const categories = t.promote.categories as Record<string, string>;
  const lang = (t.common.save === "Guardar alterações") ? "pt" : "en";
  const groupLabels = GROUP_LABELS[lang] ?? GROUP_LABELS.en;
  const dateLocale = lang === "pt" ? "pt-PT" : "en-GB";
  const citySuffix = (cityLabel: string) => cityLabel ? `${lang === "pt" ? " em " : " in "}${cityLabel}` : "";
  const promoDiscount = promotion ? parseFloat(promotion.discount_pct) : 0;
  const isMultiCity = businessCities.length > 1;
  const cityName = businessCities.find((c) => c.slug === city)?.name ?? city;

  // ── Load pricing + availability (once on mount) ────────────────────────────

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchBusinessPricing().catch(() => null),
      fetchPricingAvailability().catch(() => ({ sections: {}, inventory: {}, city: '' })),
    ]).then(([pricing, avail]) => {
      if (cancelled) return;
      if (pricing) {
        setPlans(pricing.plans);
        setPromotion(pricing.promotion);
        const bc = pricing.businessCities ?? [];
        setBusinessCities(bc);
        if (bc.length > 0) setCity(bc[0].slug);
      }
      setAvailability(avail.sections);
      setInventory((avail as any).inventory ?? {});
      setInventoryCity((avail as any).city ?? '');
      setLoaded(true);
    });

    return () => { cancelled = true; };
  }, []);

  // ── Load calendar when section selected ───────────────────────────────────

  useEffect(() => {
    if (!selected) { setBlockedRanges([]); return; }
    let cancelled = false;
    const surfaceMap: Record<string, string> = { hidden_gems: "hidden_spots" };
    const surface = surfaceMap[selected] ?? selected;
    setCalendarLoading(true);
    fetchPricingCalendar(surface)
      .then((data) => { if (!cancelled) setBlockedRanges([...data.blocked, ...data.pending]); })
      .catch(() => { if (!cancelled) setBlockedRanges([]); })
      .finally(() => { if (!cancelled) setCalendarLoading(false); });

    return () => { cancelled = true; };
  }, [selected]);

  // ── Find plan + compute price ─────────────────────────────────────────────

  const durationOptions = useMemo(() => {
    if (!selected) return [] as number[];
    return Array.from(
      new Set(
        plans
          .filter((p) => {
            if (!p.is_active || p.placement_type !== selected) return false;
            if (selected === "golden_picks" && p.position !== position) return false;
            return true;
          })
          .map((p) => p.unit_days)
      )
    ).sort((a, b) => a - b);
  }, [selected, position, plans]);

  const visibleDurationOptions = useMemo(() => {
    if (selected !== "now") return durationOptions;
    const allowed = durationOptions.filter((d) => d === 7 || d === 14 || d === 30);
    return allowed.length > 0 ? allowed : durationOptions;
  }, [selected, durationOptions]);

  useEffect(() => {
    if (!selected || visibleDurationOptions.length === 0) {
      setSelectedDuration(null);
      return;
    }
    if (selectedDuration !== null && visibleDurationOptions.includes(selectedDuration)) return;
    const preferred = [7, 14, 30].find((d) => visibleDurationOptions.includes(d)) ?? visibleDurationOptions[0];
    setSelectedDuration(preferred);
  }, [selected, selectedDuration, visibleDurationOptions]);

  const findPlan = useCallback((): PricingPlan | null => {
    if (!selected) return null;
    const matching = plans
      .filter((p) => {
        if (!p.is_active || p.placement_type !== selected) return false;
        if (selected === "golden_picks" && p.position !== position) return false;
        return true;
      })
      .sort((a, b) => a.unit_days - b.unit_days || parseFloat(a.base_price) - parseFloat(b.base_price));
    if (matching.length === 0) return null;
    if (selectedDuration !== null) {
      const exact = matching.find((p) => p.unit_days === selectedDuration);
      if (exact) return exact;
    }
    return matching[0];
  }, [selected, selectedDuration, position, plans]);

  const selectedPlan = findPlan();
  const duration = selectedPlan?.unit_days ?? selectedDuration ?? 7;
  const endDate = startDate ? addDays(startDate, duration) : null;

  // Derive planId as a stable primitive to avoid re-fetching when the
  // findPlan callback reference changes but returns the same plan.
  const computePlanId = selectedPlan?.id ?? null;

  useEffect(() => {
    if (!computePlanId || !city) { setComputed(null); return; }
    let cancelled = false;
    setComputing(true);
    computeBusinessPrice(computePlanId, city)
      .then((r) => { if (!cancelled) setComputed(r); })
      .catch(() => { if (!cancelled) setComputed(null); })
      .finally(() => { if (!cancelled) setComputing(false); });

    return () => { cancelled = true; };
  }, [computePlanId, city]);

  // ── Calendar data ─────────────────────────────────────────────────────────

  const today = toDateStr(new Date());
  const monthDays = useMemo(() => getMonthDays(calMonth.year, calMonth.month), [calMonth]);
  const firstDayOfWeek = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7; // Monday=0

  const fmtPrice = (n: number) => {
    const s = n.toFixed(2);
    return s.endsWith(".00") ? n.toFixed(0) : s;
  };

  const getCardPlan = (productKey: string): PricingPlan | null => {
    const matching = plans
      .filter((pl) => pl.placement_type === productKey && pl.is_active)
      .sort((a, b) => a.unit_days - b.unit_days || parseFloat(a.base_price) - parseFloat(b.base_price));
    return matching[0] ?? null;
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  function selectProduct(pk: string) {
    setSelected(pk); setSelectedDuration(null); setScopeId(""); setPosition(1); setComputed(null); setStartDate(null);
    setCalMonth({ year: new Date().getFullYear(), month: new Date().getMonth() });
  }

  function selectDate(dateStr: string) {
    // Check if the full range (dateStr → dateStr + duration) is free
    for (let i = 0; i < duration; i++) {
      if (isDateBlocked(addDays(dateStr, i), blockedRanges)) return;
    }
    setStartDate(dateStr);
  }

  function prevMonth() {
    setCalMonth((prev) => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 });
  }

  function nextMonth() {
    setCalMonth((prev) => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 });
  }

  const [holdExpires, setHoldExpires] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!holdExpires) { setCountdown(null); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(holdExpires).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) { setHoldExpires(null); }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [holdExpires]);

  async function handleCheckout() {
    const plan = findPlan();
    if (!plan || !startDate) return;
    setSubmitting(true);
    try {
      const result = await createCheckoutSession(plan.id, city, undefined, startDate);
      if (result.holdExpiresAt) setHoldExpires(result.holdExpiresAt);
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
    } catch { /* user can retry */ } finally { setSubmitting(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!loaded) {
    return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  }

  const canCheckout = selected && startDate && computed && !submitting
    && (!SCOPE_PRODUCTS.has(selected) || scopeId);

  const monthLabel = new Date(calMonth.year, calMonth.month).toLocaleDateString(dateLocale, { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">{t.promote.title}</h1>
        <p className="text-xs text-muted mt-0.5">{t.promote.subtitle}</p>
      </div>

      {/* Promo banner */}
      {promotion && promoDiscount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">{promotion.label}</p>
            {promotion.valid_until && (
              <p className="text-[11px] text-emerald-600 mt-0.5">
                {t.promote.validUntil.replace("{date}", fmtValidUntil(promotion.valid_until))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══ STEP 1: Select product ═══ */}
      {PRODUCT_GROUPS.map(({ key: groupKey, products: productKeys }) => (
        <div key={groupKey}>
          <h2 className="text-xs font-bold text-muted uppercase tracking-[0.1em] mb-3">{groupLabels[groupKey]}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {productKeys.map((pk) => {
              const p = products[pk];
              if (!p) return null;
              const avail = availability[pk];
              const isAvailable = avail?.available !== false;
              const reason = avail?.reason;
              const isSelected = selected === pk;
              const cardPlan = getCardPlan(pk);
              const basePrice = cardPlan ? parseFloat(cardPlan.base_price) : null;
              const unit = cardPlan?.unit_label ?? null;

              return (
                <button key={pk} onClick={() => isAvailable && selectProduct(pk)} disabled={!isAvailable}
                  className={`text-left rounded-xl border p-4 transition-all relative ${
                    !isAvailable ? "border-border bg-gray-50 opacity-60 cursor-not-allowed"
                    : isSelected ? "border-gold bg-gold/5 ring-1 ring-gold/20 shadow-md cursor-pointer"
                    : "border-border bg-white hover:border-gold/30 hover:shadow-sm cursor-pointer"
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-text">{p.label}</p>
                      <p className="text-[10px] text-gold font-medium mt-0.5">{p.tagline}</p>
                    </div>
                    {!isAvailable && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 whitespace-nowrap shrink-0">
                        {reason === "ALREADY_ACTIVE"
                          ? t.promote.unavailableActive
                          : reason === "DISCOVER_CONFLICT"
                            ? t.promote.unavailableDiscoverMax
                            : reason === "INVENTORY_FULL"
                              ? t.promote.unavailableSoldOut
                              : t.promote.unavailableGeneric}
                      </span>
                    )}
                  </div>
                  {basePrice !== null && unit && (
                    <div className="mt-2">
                      {promoDiscount > 0 ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-muted line-through">&euro;{fmtPrice(basePrice)}</span>
                          <span className="text-sm font-bold text-emerald-700">&euro;{fmtPrice(basePrice * (1 - promoDiscount / 100))}</span>
                          <span className="text-[10px] text-muted font-normal">/ {unit}</span>
                        </div>
                      ) : (
                        <p className="text-xs font-semibold text-text">&euro;{fmtPrice(basePrice)} <span className="text-muted font-normal">/ {unit}</span></p>
                      )}
                    </div>
                  )}
                  <div className="mt-2 space-y-0.5">
                    {[p.where, p.why, p.context].filter(Boolean).map((line, idx) => (
                      <CheckLine key={`${pk}-${idx}`} text={line as string} />
                    ))}
                  </div>
                  {/* Scarcity indicator */}
                  {pk === "now" ? (
                    <p className="mt-2 text-[9px] font-semibold text-amber-600">
                      {lang === "pt" ? "Prioridade limitada por cidade" : "Limited priority per city"}
                    </p>
                  ) : inventory[pk] && (() => {
                    const inv = inventory[pk];
                    const cityLabel = inventoryCity ? inventoryCity.charAt(0).toUpperCase() + inventoryCity.slice(1) : '';
                    if (inv.remaining <= 0) {
                      return <p className="mt-2 text-[9px] font-bold text-red-500">{t.promote.soldOutLabel}</p>;
                    }
                    if (inv.remaining <= 2) {
                      const lowSlots = t.promote.lowSlotsLabel
                        .replace("{remaining}", String(inv.remaining))
                        .replace("{max}", String(inv.max));
                      return <p className="mt-2 text-[9px] font-bold text-red-500">{lowSlots}{citySuffix(cityLabel)}</p>;
                    }
                    const availableSlots = t.promote.availableSlotsLabel
                      .replace("{remaining}", String(inv.remaining))
                      .replace("{max}", String(inv.max));
                    return <p className="mt-2 text-[9px] font-semibold text-amber-600">{availableSlots}{citySuffix(cityLabel)}</p>;
                  })()}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* ═══ STEP 2: Configure + Calendar ═══ */}
      {selected && products[selected] && (
        <div className="bg-white rounded-xl border border-gold/30 shadow-md p-5 md:p-6">
          <p className="text-sm font-bold text-text mb-0.5">{products[selected].label}</p>
          <p className="text-[11px] text-muted mb-5">{products[selected].tagline} · {duration} {t.common.days}</p>

          <div className="flex flex-col gap-5">
            {/* City */}
            {isMultiCity && (
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">{t.promote.cityLabel}</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {businessCities.map((c) => (
                    <button key={c.slug} onClick={() => setCity(c.slug)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${city === c.slug ? "bg-gold/10 text-gold border border-gold/30" : "bg-white border border-border text-muted hover:border-gold/30"}`}>{c.name}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Golden Picks position */}
            {selected === "golden_picks" && (
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">{t.promote.positionLabel}</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((pos) => (
                    <button key={pos} onClick={() => setPosition(pos)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${position === pos ? "bg-gold/10 text-gold border border-gold/30" : "bg-white border border-border text-muted hover:border-gold/30"}`}>#{pos}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Duration */}
            {selected === "now" && visibleDurationOptions.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">{t.promote.duration}</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {visibleDurationOptions.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSelectedDuration(days)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${duration === days ? "bg-gold/10 text-gold border border-gold/30" : "bg-white border border-border text-muted hover:border-gold/30"}`}
                    >
                      {days} {t.common.days}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* How it works */}
            {selected === "now" && (
              <div className="bg-surface rounded-lg border border-border px-4 py-3">
                <p className="text-xs font-semibold text-text">{t.promote.howItWorksTitle}</p>
                <p className="text-[11px] text-muted mt-1.5 leading-relaxed">{t.promote.howItWorksText}</p>
              </div>
            )}

            {SCOPE_PRODUCTS.has(selected) && (
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">{t.promote.selectCategory}</label>
                <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="w-full md:w-72 rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-gold">
                  <option value="">{t.promote.selectCategory}</option>
                  {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}

            {/* ═══ CALENDAR ═══ */}
            <div>
              <label className="text-xs font-medium text-muted mb-2 block">{t.promote.startDateLabel}</label>
              {calendarLoading ? (
                <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="bg-surface rounded-xl border border-border p-4 max-w-sm">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={prevMonth} className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center cursor-pointer text-muted hover:text-text transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span className="text-sm font-semibold text-text">{monthLabel}</span>
                    <button onClick={nextMonth} className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center cursor-pointer text-muted hover:text-text transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="text-center text-[10px] font-semibold text-muted py-1">{d}</div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for offset */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}

                    {monthDays.map((day) => {
                      const ds = toDateStr(day);
                      const isPast = ds < today;
                      const blocked = isDateBlocked(ds, blockedRanges);
                      // Check if the full duration range is free
                      let rangeBlocked = false;
                      if (!isPast && !blocked) {
                        for (let i = 1; i < duration; i++) {
                          if (isDateBlocked(addDays(ds, i), blockedRanges)) { rangeBlocked = true; break; }
                        }
                      }
                      const disabled = isPast || blocked || rangeBlocked;
                      const isStart = startDate === ds;
                      const isInRange = startDate && endDate && ds >= startDate && ds < endDate;

                      return (
                        <button
                          key={ds}
                          type="button"
                          disabled={disabled}
                          onClick={() => !disabled && selectDate(ds)}
                          className={`h-9 rounded-lg text-xs font-medium transition-all ${
                            isStart
                              ? "bg-gold text-white font-bold"
                              : isInRange
                                ? "bg-gold/20 text-gold font-semibold"
                                : disabled
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-text hover:bg-gold/10 cursor-pointer"
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                    <span className="flex items-center gap-1.5 text-[10px] text-muted"><span className="w-2.5 h-2.5 rounded bg-gold" /> {t.promote.legendStart}</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted"><span className="w-2.5 h-2.5 rounded bg-gold/20" /> {t.promote.legendDuration}</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted"><span className="w-2.5 h-2.5 rounded bg-gray-200" /> {t.promote.legendUnavailable}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ═══ SUMMARY + PRICE ═══ */}
            {startDate && (
              <div className="bg-gold/5 border border-gold/15 rounded-lg px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-text">
                    {new Date(startDate + "T00:00:00").toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" })}
                    {" → "}
                    {endDate && new Date(endDate + "T00:00:00").toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  <span className="text-[10px] text-muted">{duration} {t.common.days}</span>
                </div>
                {computing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted">{t.promote.calculating}</span>
                  </div>
                ) : computed ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted">{cityName}</p>
                    {computed.promoDiscount > 0 ? (
                      <div className="flex items-baseline gap-3">
                        <span className="text-lg text-muted line-through">&euro;{fmtPrice(computed.fullPrice)}</span>
                        <span className="text-2xl font-bold text-text">&euro;{fmtPrice(computed.finalPrice)}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">-{computed.promoDiscount}%</span>
                      </div>
                    ) : (
                      <span className="text-2xl font-bold text-text">&euro;{fmtPrice(computed.finalPrice)}</span>
                    )}
                    <p className="text-[10px] text-muted">{t.promote.priceFootnote}</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Hold countdown */}
            {countdown !== null && countdown > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <div>
                  <p className="text-xs font-semibold text-amber-800">
                    {t.promote.holdReservation.replace("{time}", `${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, "0")}`)}
                  </p>
                  <p className="text-[10px] text-amber-700">{t.promote.holdCompletePayment}</p>
                </div>
              </div>
            )}
            {countdown === 0 && holdExpires && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-red-700">{t.promote.holdExpired}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCheckout}
                disabled={!canCheckout || (countdown === 0 && !!holdExpires)}
                className="px-6 py-2.5 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {submitting ? t.promote.processing : selected === "now" ? t.promote.activateRecommendation : t.promote.purchasePlacement}
              </button>
              <button onClick={() => { setSelected(null); setHoldExpires(null); }} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted hover:text-text transition-colors cursor-pointer">
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D2B68A" strokeWidth="2.5" className="mt-0.5 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
      <span className="text-[10px] text-muted leading-snug">{text}</span>
    </div>
  );
}
