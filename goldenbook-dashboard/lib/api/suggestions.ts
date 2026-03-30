import { apiPost } from "./client";

// POST /api/v1/admin/suggestions/:id/apply
export async function applySuggestion(placeId: string): Promise<void> {
  await apiPost(`/api/v1/admin/suggestions/${encodeURIComponent(placeId)}/apply`, {});
}

// POST /api/v1/admin/suggestions/:id/dismiss
export async function dismissSuggestion(placeId: string): Promise<void> {
  await apiPost(`/api/v1/admin/suggestions/${encodeURIComponent(placeId)}/dismiss`, {});
}

// POST /api/v1/admin/suggestions/generate (single place)
export async function generateSuggestionForPlace(placeId: string): Promise<void> {
  await apiPost("/api/v1/admin/suggestions/generate", { placeId });
}

// POST /api/v1/admin/suggestions/bulk-apply
export async function bulkApplySuggestions(filter: {
  placeIds?: string[];
  minConfidence?: number;
}): Promise<{ applied: number }> {
  return apiPost("/api/v1/admin/suggestions/bulk-apply", filter);
}
