import { apiGet } from "./client";
import type { AnalyticsAudience } from "./analytics-v2";

export interface AnalyticsOverview {
  revenue: { total: number; purchases: number; period: number };
  daily: { date: string; revenue: number; count: number }[];
  activePlacements: number;
  conversion: { selected: number; started: number; completed: number; rate: number | null };
}

export interface CampaignPerformance {
  section: string;
  totalPurchases: number;
  totalRevenue: number;
  activeCount: number;
}

export interface EstablishmentPerformance {
  placeId: string;
  placeName: string;
  totalPurchases: number;
  totalRevenue: number;
  activeCount: number;
  // Same window as the purchases, from analytics_events.
  views: number;
  websiteClicks: number;
  bookingClicks: number;
  mapOpens: number;
}

export interface TimeBucketPerformance {
  timeBucket: string;
  total: number;
  sold: number;
  rate: number;
}

export interface DayOfWeekPerformance {
  day: string;
  revenue: number;
  count: number;
}

// `audience` filters only what the app recorded (conversion funnel, views,
// clicks); revenue is never filtered. See analytics-v2.ts.
export async function fetchAnalyticsOverview(period = "30", audience: AnalyticsAudience = "core"): Promise<AnalyticsOverview> {
  return apiGet("/api/v1/admin/analytics/overview", { period, audience });
}

export async function fetchCampaignPerformance(period = "30"): Promise<CampaignPerformance[]> {
  const data = await apiGet<{ campaigns: CampaignPerformance[] }>("/api/v1/admin/analytics/campaigns", { period });
  return data.campaigns;
}

export async function fetchEstablishmentPerformance(period = "30", audience: AnalyticsAudience = "core"): Promise<EstablishmentPerformance[]> {
  const data = await apiGet<{ establishments: EstablishmentPerformance[] }>("/api/v1/admin/analytics/establishments", { period, audience });
  return data.establishments;
}

export async function fetchTimePerformance(): Promise<{
  timeBuckets: TimeBucketPerformance[];
  dayOfWeek: DayOfWeekPerformance[];
}> {
  return apiGet("/api/v1/admin/analytics/time");
}
