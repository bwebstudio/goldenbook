import { apiGet } from "./client";

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

export async function fetchAnalyticsOverview(period = "30"): Promise<AnalyticsOverview> {
  return apiGet("/api/v1/admin/analytics/overview", { period });
}

export async function fetchCampaignPerformance(period = "30"): Promise<CampaignPerformance[]> {
  const data = await apiGet<{ campaigns: CampaignPerformance[] }>("/api/v1/admin/analytics/campaigns", { period });
  return data.campaigns;
}

export async function fetchEstablishmentPerformance(period = "30"): Promise<EstablishmentPerformance[]> {
  const data = await apiGet<{ establishments: EstablishmentPerformance[] }>("/api/v1/admin/analytics/establishments", { period });
  return data.establishments;
}

export async function fetchTimePerformance(): Promise<{
  timeBuckets: TimeBucketPerformance[];
  dayOfWeek: DayOfWeekPerformance[];
}> {
  return apiGet("/api/v1/admin/analytics/time");
}
