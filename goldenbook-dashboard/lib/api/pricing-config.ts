import { apiGet, apiPatch } from "./client";

export interface PricingConfig {
  id: string;
  city: string | null;
  product_type: "now_slot" | "concierge" | "featured" | "subscription";
  price: number;
  currency: string;
  duration_days: number;
  max_slots: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchActivePricingConfigs(): Promise<PricingConfig[]> {
  const data = await apiGet<{ items: PricingConfig[] }>("/api/v1/pricing-config");
  return data.items;
}

export async function fetchAllPricingConfigs(): Promise<PricingConfig[]> {
  const data = await apiGet<{ items: PricingConfig[] }>("/api/v1/pricing-config/all");
  return data.items;
}

export async function updatePricingConfigAdmin(
  id: string,
  body: { price?: number; duration_days?: number; max_slots?: number | null; is_active?: boolean }
): Promise<PricingConfig> {
  return apiPatch<PricingConfig>(`/api/v1/pricing-config/${id}`, body);
}
