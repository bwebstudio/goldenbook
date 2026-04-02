import { apiGet, apiPost, apiPut } from "./client";

// ─── Image type ─────────────────────────────────────────────────────────────

export interface BusinessImageDTO {
  id: string;
  asset_id: string;
  image_role: string;
  sort_order: number;
  is_primary: boolean;
  caption: string | null;
  bucket: string;
  path: string;
  width: number | null;
  height: number | null;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BusinessPlaceSummary {
  id: string;
  name: string;
  slug: string;
  cityName: string | null;
  status: string;
  role: "owner" | "manager";
}

export interface BusinessMeResponse {
  client: {
    id: string;
    contactName: string | null;
    contactEmail: string | null;
  };
  place: {
    id: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    heroImage: { bucket: string | null; path: string | null };
    cityName: string | null;
    citySlug: string | null;
    status: string;
  } | null;
  places: BusinessPlaceSummary[];
}

export interface BusinessPlaceProfile {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  booking_url: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface BusinessOverview {
  stats: {
    total: number;
    pending: number;
    active: number;
    approved: number;
  };
  activeCampaigns: {
    id: string;
    placement_type: string;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
  }[];
}

export interface PlacementRequestDTO {
  id: string;
  place_id: string;
  client_id: string;
  placement_type: string;
  city_id: string | null;
  slot: string | null;
  scope_type: string | null;
  scope_id: string | null;
  route_id: string | null;
  duration_days: number;
  status: string;
  admin_notes: string | null;
  visibility_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlacementRequestWithPlace extends PlacementRequestDTO {
  place_name: string;
  place_slug: string;
  city_name: string | null;
  client_contact_name: string | null;
  client_contact_email: string | null;
}

// ─── Business Client API ────────────────────────────────────────────────────

export async function fetchBusinessMe(): Promise<BusinessMeResponse> {
  return apiGet<BusinessMeResponse>("/api/v1/business/me");
}

export interface ChangeRequestInfo {
  field_name: string;
  new_value: string;
  status: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface BusinessPlaceWithPending extends BusinessPlaceProfile {
  changeRequests?: ChangeRequestInfo[];
}

export async function fetchBusinessPlace(locale = "pt"): Promise<BusinessPlaceWithPending> {
  return apiGet<BusinessPlaceWithPending>("/api/v1/business/place", { locale });
}

export async function fetchBusinessImages(): Promise<BusinessImageDTO[]> {
  const data = await apiGet<{ items: BusinessImageDTO[] }>("/api/v1/business/images");
  return data.items;
}

export async function updateBusinessPlace(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiPut<Record<string, unknown>>("/api/v1/business/place", body);
}

export async function fetchBusinessOverview(): Promise<BusinessOverview> {
  return apiGet<BusinessOverview>("/api/v1/business/overview");
}

export async function fetchBusinessRequests(): Promise<PlacementRequestDTO[]> {
  const data = await apiGet<{ items: PlacementRequestDTO[] }>("/api/v1/business/requests");
  return data.items;
}

// ─── Purchases (paid campaigns) ────────────────────────────────────────────

export interface PurchaseDTO {
  id: string;
  placement_type: string | null;
  city: string | null;
  position: number | null;
  unit_days: number;
  final_price: string;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
}

export async function fetchBusinessPurchases(): Promise<PurchaseDTO[]> {
  const data = await apiGet<{ items: PurchaseDTO[] }>("/api/v1/business/purchases");
  return data.items;
}

// ─── Billing ───────────────────────────────────────────────────────────────

export interface BillingPurchase {
  id: string;
  placementType: string | null;
  city: string | null;
  unitDays: number;
  price: string;
  currency: string;
  status: string;
  receiptUrl: string | null;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
}

export interface BillingMembership {
  id: string;
  status: string;
  pricePaid: string;
  currency: string;
  stripeSubscriptionId: string | null;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface BillingData {
  purchases: BillingPurchase[];
  memberships: BillingMembership[];
}

export async function fetchBusinessBilling(): Promise<BillingData> {
  return apiGet("/api/v1/business/billing");
}

export interface AdminPurchaseDTO extends PurchaseDTO {
  business_client_id: string;
  place_id: string | null;
  place_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
}

export async function fetchAllPurchases(): Promise<AdminPurchaseDTO[]> {
  const data = await apiGet<{ items: AdminPurchaseDTO[] }>("/api/v1/admin/purchases");
  return data.items;
}

// ─── Placement Requests ────────────────────────────────────────────────────

export async function createPlacementRequest(body: {
  placementType: string;
  cityId?: string | null;
  slot?: string | null;
  scopeType?: string | null;
  scopeId?: string | null;
  routeId?: string | null;
  durationDays?: number;
}): Promise<PlacementRequestDTO> {
  return apiPost<PlacementRequestDTO>("/api/v1/business/requests", body);
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface BusinessAnalytics {
  period: string;
  views: number;
  websiteClicks: number;
  directions: number;
  reservations: number;
}

export async function fetchBusinessAnalytics(period: string = "30d"): Promise<BusinessAnalytics> {
  return apiGet<BusinessAnalytics>("/api/v1/business/analytics", { period });
}

// ─── Admin API ──────────────────────────────────────────────────────────────

export async function fetchAllPlacementRequests(status?: string): Promise<PlacementRequestWithPlace[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  const data = await apiGet<{ items: PlacementRequestWithPlace[] }>("/api/v1/admin/placement-requests", params);
  return data.items;
}

export async function approvePlacementRequest(id: string, adminNotes?: string | null): Promise<void> {
  await apiPost(`/api/v1/admin/placement-requests/${id}/approve`, { adminNotes: adminNotes ?? null });
}

export async function rejectPlacementRequest(id: string, adminNotes?: string | null): Promise<void> {
  await apiPost(`/api/v1/admin/placement-requests/${id}/reject`, { adminNotes: adminNotes ?? null });
}
