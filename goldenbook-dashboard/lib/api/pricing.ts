import { apiGet, apiPost, apiPut, apiDelete } from "./client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PricingPlan {
  id: string;
  pricing_type: "membership" | "placement" | "upgrade";
  placement_type: string | null;
  city: string | null;
  position: number | null;
  slot: string | null;
  unit_label: string;
  unit_days: number;
  base_price: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeasonRule {
  id: string;
  city: string;
  season_name: string;
  month_from: number;
  month_to: number;
  multiplier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CityMultiplier {
  id: string;
  city: string;
  multiplier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: string;
  name: string;
  discount_pct: string;
  label: string;
  applies_to: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PriceComputation {
  basePrice: number;
  cityMultiplier: number;
  seasonMultiplier: number;
  seasonName: string | null;
  fullPrice: number;
  promoDiscount: number;
  promoLabel: string | null;
  promoValidUntil: string | null;
  finalPrice: number;
}

export interface ActivePromoInfo {
  discount_pct: string;
  label: string;
  valid_until: string | null;
}

export interface BusinessCity {
  slug: string;
  name: string;
  placeId: string;
}

// ─── Admin API ──────────────────────────────────────────────────────────────

export async function fetchAdminPricingConfig(): Promise<{
  plans: PricingPlan[];
  seasons: SeasonRule[];
  cities: CityMultiplier[];
  promotions: Promotion[];
}> {
  return apiGet("/api/v1/admin/pricing/config");
}

export async function fetchPricingPlans(): Promise<PricingPlan[]> {
  const data = await apiGet<{ items: PricingPlan[] }>("/api/v1/admin/pricing/plans");
  return data.items;
}

export async function updatePricingPlanAdmin(
  id: string,
  body: { basePrice?: number; unitLabel?: string; unitDays?: number; isActive?: boolean }
): Promise<PricingPlan> {
  return apiPut<PricingPlan>(`/api/v1/admin/pricing/plans/${id}`, body);
}

export async function createPricingPlanAdmin(body: {
  pricingType: string;
  placementType?: string | null;
  city?: string | null;
  position?: number | null;
  slot?: string | null;
  unitLabel: string;
  unitDays: number;
  basePrice: number;
}): Promise<PricingPlan> {
  return apiPost<PricingPlan>("/api/v1/admin/pricing/plans", body);
}

export async function deletePricingPlanAdmin(id: string): Promise<void> {
  return apiDelete(`/api/v1/admin/pricing/plans/${id}`);
}

export async function fetchSeasonRules(): Promise<SeasonRule[]> {
  const data = await apiGet<{ items: SeasonRule[] }>("/api/v1/admin/pricing/seasons");
  return data.items;
}

export async function updateSeasonRuleAdmin(
  id: string,
  body: { multiplier?: number; monthFrom?: number; monthTo?: number; seasonName?: string; isActive?: boolean }
): Promise<SeasonRule> {
  return apiPut<SeasonRule>(`/api/v1/admin/pricing/seasons/${id}`, body);
}

export async function createSeasonRuleAdmin(body: {
  city: string; seasonName: string; monthFrom: number; monthTo: number; multiplier: number;
}): Promise<SeasonRule> {
  return apiPost<SeasonRule>("/api/v1/admin/pricing/seasons", body);
}

export async function deleteSeasonRuleAdmin(id: string): Promise<void> {
  return apiDelete(`/api/v1/admin/pricing/seasons/${id}`);
}

export async function updateCityMultiplierAdmin(
  id: string,
  body: { multiplier?: number; isActive?: boolean }
): Promise<CityMultiplier> {
  return apiPut<CityMultiplier>(`/api/v1/admin/pricing/cities/${id}`, body);
}

export async function updatePromotionAdmin(
  id: string,
  body: { discountPct?: number; label?: string; validUntil?: string | null; isActive?: boolean }
): Promise<Promotion> {
  return apiPut<Promotion>(`/api/v1/admin/pricing/promotions/${id}`, body);
}

export async function createPromotionAdmin(body: {
  name: string; discountPct: number; label: string; appliesTo?: string; validFrom: string; validUntil: string | null;
}): Promise<Promotion> {
  return apiPost<Promotion>("/api/v1/admin/pricing/promotions", body);
}

export async function previewPrice(planId: string, city?: string, month?: number): Promise<PriceComputation> {
  const params: Record<string, string> = { planId };
  if (city) params.city = city;
  if (month) params.month = month.toString();
  return apiGet<PriceComputation>("/api/v1/admin/pricing/preview", params);
}

// ─── Business API ───────────────────────────────────────────────────────────

export async function fetchBusinessPricing(): Promise<{
  plans: PricingPlan[];
  seasons: SeasonRule[];
  cities: CityMultiplier[];
  promotion: ActivePromoInfo | null;
  businessCities: BusinessCity[];
}> {
  return apiGet("/api/v1/pricing/plans");
}

export async function computeBusinessPrice(planId: string, city?: string, month?: number): Promise<PriceComputation> {
  const params: Record<string, string> = { planId };
  if (city) params.city = city;
  if (month) params.month = month.toString();
  return apiGet<PriceComputation>("/api/v1/pricing/compute", params);
}

export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
  holdExpiresAt?: string;
  holdMinutes?: number;
}

export async function createCheckoutSession(
  planId: string,
  city?: string,
  month?: number,
  startDate?: string,
): Promise<CheckoutResult> {
  return apiPost<CheckoutResult>("/api/v1/pricing/checkout", { planId, city, month, startDate });
}

export interface SectionAvailability {
  available: boolean;
  reason: string | null;
  group: string;
}

export async function fetchPricingAvailability(): Promise<{ sections: Record<string, SectionAvailability> }> {
  return apiGet("/api/v1/pricing/availability");
}

export interface BlockedRange {
  starts_at: string;
  ends_at: string;
  place_name?: string | null;
  position?: number | null;
}

export async function fetchPricingCalendar(section: string): Promise<{
  blocked: BlockedRange[];
  pending: BlockedRange[];
}> {
  return apiGet("/api/v1/pricing/calendar", { section });
}
