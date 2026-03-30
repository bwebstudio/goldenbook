// ─── Backend API response types for campaigns ──────────────────────────────

export interface CampaignDTO {
  id: string;
  name: string;
  section: string;
  section_group: string;
  city_id: string | null;
  city_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  slot_limit: number;
  priority: number;
  total_inventory: number;
  sold_inventory: number;
  available_inventory: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemDTO {
  id: string;
  campaign_id: string;
  position: number;
  date: string;
  time_bucket: string;
  status: string;
  purchase_id: string | null;
  place_id: string | null;
  created_at: string;
}

export interface CampaignSlotDTO {
  id: string;
  campaign_id: string;
  place_id: string;
  purchase_id: string | null;
  inventory_id: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  place_name: string | null;
}

export interface NextAvailableDTO {
  date: string;
  position: number;
  time_bucket: string;
}

export interface PlaceEligibilityDTO {
  id: string;
  eligible: boolean;
  reason: string | null;
}

export interface AlternativeDTO {
  section: string;
  available: boolean;
}

// ─── Availability endpoint response ─────────────────────────────────────────

export interface AvailabilityInventoryItem {
  position: number;
  date: string;
  time_bucket: string;
  available: boolean;
}

export interface CampaignAvailabilityResponse {
  campaign: CampaignDTO;
  inventory: AvailabilityInventoryItem[];
  place: PlaceEligibilityDTO;
  alternatives: AlternativeDTO[];
  next_available: NextAvailableDTO | null;
}

// ─── Campaign detail (admin) ────────────────────────────────────────────────

export interface AdminCampaignDetailResponse {
  campaign: CampaignDTO;
  slots: CampaignSlotDTO[];
  inventory: InventoryItemDTO[];
}

// ─── Campaign info (client) ─────────────────────────────────────────────────

export interface ClientCampaignResponse {
  campaign: CampaignDTO;
  place: PlaceEligibilityDTO;
  next_available: NextAvailableDTO | null;
  alternatives: AlternativeDTO[];
}
