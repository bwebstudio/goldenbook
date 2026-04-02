import { apiGet } from "./client";

export interface Recommendation {
  rule: string;
  type: "performance" | "demand" | "timing" | "opportunity";
  section?: string;
  value?: number;
  extra?: string;
  action?: string;
}

export interface AdminInsights {
  topSections: { section: string; revenue: number; count: number }[];
  topCities: { city: string; revenue: number; count: number }[];
  demandSignals: { section: string; demandScore: number }[];
  bestTimeBucket: { timeBucket: string; pct: number } | null;
}

export async function fetchMyRecommendations(): Promise<Recommendation[]> {
  const data = await apiGet<{ recommendations: Recommendation[] }>("/api/v1/recommendations/me");
  return data.recommendations;
}

export async function fetchPlaceRecommendations(placeId: string): Promise<Recommendation[]> {
  const data = await apiGet<{ recommendations: Recommendation[] }>(`/api/v1/recommendations/${placeId}`);
  return data.recommendations;
}

export async function fetchAdminInsights(): Promise<AdminInsights> {
  return apiGet("/api/v1/admin/analytics/insights");
}
