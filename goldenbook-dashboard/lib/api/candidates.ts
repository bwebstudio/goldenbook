import { apiGet, apiPost, apiPutVoid, apiDelete } from "./client";

export interface BookingCandidateDTO {
  id: string;
  place_id: string;
  provider: string;
  candidate_url: string;
  candidate_type: string;
  is_valid: boolean | null;
  validation_status: string;
  validation_details: string | null;
  confidence: number;
  source: string;
  discovered_at: string;
  last_checked_at: string | null;
  notes: string | null;
  is_active: boolean;
  priority: number;
}

export async function fetchCandidatesForPlace(placeId: string): Promise<BookingCandidateDTO[]> {
  const data = await apiGet<{ items: BookingCandidateDTO[] }>(
    `/api/v1/admin/places/${encodeURIComponent(placeId)}/candidates`
  );
  return data.items;
}

export async function generateCandidatesForPlace(placeId: string): Promise<void> {
  await apiPost(`/api/v1/admin/places/${encodeURIComponent(placeId)}/candidates/generate`, {});
}

export async function activateCandidate(candidateId: string, placeId: string): Promise<void> {
  await apiPost(`/api/v1/admin/candidates/${encodeURIComponent(candidateId)}/activate`, { placeId });
}

export async function deactivateCandidate(candidateId: string): Promise<void> {
  await apiPost(`/api/v1/admin/candidates/${encodeURIComponent(candidateId)}/deactivate`, {});
}

export async function addManualCandidate(placeId: string, url: string): Promise<void> {
  await apiPost(`/api/v1/admin/places/${encodeURIComponent(placeId)}/candidates/add`, { url, setActive: true });
}

export async function updateCandidateUrl(candidateId: string, url: string): Promise<void> {
  await apiPutVoid(`/api/v1/admin/candidates/${encodeURIComponent(candidateId)}`, { url });
}

export async function deleteCandidateApi(candidateId: string): Promise<void> {
  await apiDelete(`/api/v1/admin/candidates/${encodeURIComponent(candidateId)}`);
}
