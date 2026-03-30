import { apiGet } from "./client";

export interface FunnelRow {
  key: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface PlaceFunnelRow extends FunnelRow {
  placeId: string;
  placeName: string;
  placeSlug: string;
}

export interface AnalyticsSummary {
  totalImpressions: number;
  totalClicks: number;
  globalCtr: number;
  byProvider: FunnelRow[];
  byMode: FunnelRow[];
  byCity: FunnelRow[];
  topPlaces: PlaceFunnelRow[];
  byCategory: FunnelRow[];
}

export async function fetchBookingAnalytics(
  days = 30,
  filters?: { provider?: string; city?: string; bookingMode?: string },
): Promise<AnalyticsSummary> {
  const params: Record<string, string> = { days: String(days) };
  if (filters?.provider) params.provider = filters.provider;
  if (filters?.city) params.city = filters.city;
  if (filters?.bookingMode) params.bookingMode = filters.bookingMode;
  return apiGet<AnalyticsSummary>("/api/v1/admin/analytics/bookings", params);
}
