import { apiGet, apiPost, apiPutVoid, apiDelete } from "./client";

export interface VisibilityDTO {
  id: string;
  place_id: string;
  surface: string;
  visibility_type: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  notes: string | null;
  source: string;
  placement_slot: string | null;
  scope_type: string | null;
  scope_id: string | null;
}

export interface VisibilityGlobalDTO extends VisibilityDTO {
  place_name: string;
  place_slug: string;
  city_name: string;
  city_slug: string;
}

export async function fetchAllVisibilities(): Promise<VisibilityGlobalDTO[]> {
  const data = await apiGet<{ items: VisibilityGlobalDTO[] }>("/api/v1/admin/visibility");
  return data.items;
}

export async function fetchVisibilities(placeId: string): Promise<VisibilityDTO[]> {
  const data = await apiGet<{ items: VisibilityDTO[] }>(`/api/v1/admin/places/${placeId}/visibility`);
  return data.items;
}

export async function createVisibilityApi(placeId: string, body: {
  surface: string; visibilityType?: string; priority?: number;
  startsAt?: string | null; endsAt?: string | null; notes?: string | null;
  source?: string; placementSlot?: string | null;
  scopeType?: string | null; scopeId?: string | null;
}): Promise<void> {
  await apiPost(`/api/v1/admin/places/${placeId}/visibility`, body);
}

export async function updateVisibilityApi(visId: string, body: Record<string, unknown>): Promise<void> {
  await apiPutVoid(`/api/v1/admin/visibility/${visId}`, body);
}

export async function deleteVisibilityApi(visId: string): Promise<void> {
  await apiDelete(`/api/v1/admin/visibility/${visId}`);
}
