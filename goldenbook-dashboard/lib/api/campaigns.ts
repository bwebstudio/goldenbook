import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type {
  CampaignDTO,
  AdminCampaignDetailResponse,
  CampaignAvailabilityResponse,
  ClientCampaignResponse,
  InventoryItemDTO,
} from "@/types/api/campaign";

// ─── Admin API ──────────────────────────────────────────────────────────────

export async function fetchAdminCampaigns(params?: Record<string, string>): Promise<CampaignDTO[]> {
  const data = await apiGet<{ campaigns: CampaignDTO[] }>("/api/v1/admin/campaigns", params);
  return data.campaigns;
}

export interface UnifiedPlacement {
  id: string;
  source: "purchase" | "request" | "editorial";
  section: string;
  city: string | null;
  position: number | null;
  duration_days: number | null;
  price: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  place_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
}

export async function fetchUnifiedPlacements(params?: Record<string, string>): Promise<UnifiedPlacement[]> {
  const data = await apiGet<{ items: UnifiedPlacement[] }>("/api/v1/admin/campaigns/placements", params);
  return data.items;
}

export async function updatePlacementStatus(
  id: string,
  source: "purchase" | "request",
  status: string,
): Promise<void> {
  await apiPatch<{ success: boolean }>(`/api/v1/admin/campaigns/placements/${id}`, { source, status });
}

export async function fetchAdminCampaignDetail(id: string): Promise<AdminCampaignDetailResponse> {
  return apiGet<AdminCampaignDetailResponse>(`/api/v1/admin/campaigns/${id}`);
}

export async function createAdminCampaign(body: {
  name: string;
  section: string;
  city_id?: string | null;
  start_date: string;
  end_date: string;
  status?: string;
  slot_limit: number;
  priority?: number;
}): Promise<{ campaign: CampaignDTO }> {
  return apiPost<{ campaign: CampaignDTO }>("/api/v1/admin/campaigns", body);
}

export async function updateAdminCampaign(
  id: string,
  body: Partial<{
    name: string;
    section: string;
    city_id: string | null;
    start_date: string;
    end_date: string;
    status: string;
    slot_limit: number;
    priority: number;
  }>
): Promise<{ campaign: CampaignDTO }> {
  return apiPatch<{ campaign: CampaignDTO }>(`/api/v1/admin/campaigns/${id}`, body);
}

export async function deleteAdminCampaign(id: string): Promise<void> {
  return apiDelete(`/api/v1/admin/campaigns/${id}`);
}

export async function fetchAdminCampaignInventory(
  campaignId: string,
  params?: Record<string, string>
): Promise<{ campaign: CampaignDTO; inventory: InventoryItemDTO[] }> {
  return apiGet(`/api/v1/admin/campaigns/${campaignId}/inventory`, params);
}

export async function createInventoryItem(
  campaignId: string,
  body: { position: number; date: string; time_bucket?: string }
): Promise<{ item: InventoryItemDTO }> {
  return apiPost(`/api/v1/admin/campaigns/${campaignId}/inventory`, body);
}

export async function bulkCreateInventory(
  campaignId: string,
  body: {
    positions: number[];
    date_from: string;
    date_to: string;
    time_buckets?: string[] | null;
  }
): Promise<{ created: number }> {
  return apiPost(`/api/v1/admin/campaigns/${campaignId}/inventory/bulk`, body);
}

// ─── Business Client API ────────────────────────────────────────────────────

export async function fetchClientCampaign(id: string): Promise<ClientCampaignResponse> {
  return apiGet<ClientCampaignResponse>(`/api/v1/campaigns/${id}`);
}

export async function fetchCampaignAvailability(
  id: string,
  placeId: string,
  params?: { date_from?: string; date_to?: string }
): Promise<CampaignAvailabilityResponse> {
  return apiGet<CampaignAvailabilityResponse>(`/api/v1/campaigns/${id}/availability`, {
    place_id: placeId,
    ...params,
  });
}

export async function createCampaignCheckout(body: {
  planId: string;
  campaignId: string;
  city?: string;
  date: string;
  position?: number;
  time_bucket?: string;
  month?: number;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  return apiPost("/api/v1/pricing/checkout", body);
}

// ─── Tracking ───────────────────────────────────────────────────────────────

export function trackCampaignEvent(event: "slot_selected" | "checkout_started" | "checkout_completed", payload: {
  campaign_id: string;
  place_id: string;
  position?: number;
  date?: string;
  time_bucket?: string;
}): void {
  // Fire-and-forget — never block UI
  apiPost("/api/v1/campaigns/track", { event, ...payload }).catch(() => {});
}
