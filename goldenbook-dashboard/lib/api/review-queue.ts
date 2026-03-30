import { apiGet, apiPost } from "./client";

export interface ChangeRequest {
  id: string;
  place_id: string;
  place_name: string;
  place_slug: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  reviewer_name: string | null;
}

export async function fetchReviewQueue(status = "pending"): Promise<ChangeRequest[]> {
  const data = await apiGet<{ items: ChangeRequest[] }>("/api/v1/admin/review-queue", { status });
  return data.items;
}

export async function fetchReviewCount(): Promise<number> {
  const data = await apiGet<{ count: number }>("/api/v1/admin/review-queue/count");
  return data.count;
}

export async function approveChange(id: string, reviewNote?: string | null): Promise<void> {
  await apiPost(`/api/v1/admin/review-queue/${id}/approve`, { reviewNote: reviewNote ?? null });
}

export async function rejectChange(id: string, reviewNote?: string | null): Promise<void> {
  await apiPost(`/api/v1/admin/review-queue/${id}/reject`, { reviewNote: reviewNote ?? null });
}
