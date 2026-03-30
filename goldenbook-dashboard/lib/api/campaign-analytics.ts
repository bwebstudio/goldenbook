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
  views: number;
  clicks: number;
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

export async function fetchCampaignPerformance(): Promise<CampaignPerformance[]> {
  const data = await apiGet<{ campaigns: CampaignPerformance[] }>("/api/v1/admin/analytics/campaigns");
  return data.campaigns;
}

export async function fetchEstablishmentPerformance(): Promise<EstablishmentPerformance[]> {
  const data = await apiGet<{ establishments: EstablishmentPerformance[] }>("/api/v1/admin/analytics/establishments");
  return data.establishments;
}

export async function fetchTimePerformance(): Promise<{
  timeBuckets: TimeBucketPerformance[];
  dayOfWeek: DayOfWeekPerformance[];
}> {
  return apiGet("/api/v1/admin/analytics/time");
}

// ─── Booking / TheFork Analytics ────────────────────────────────────────────

export interface BookingProvider {
  provider: string;
  total: number;
  active: number;
  valid: number;
}

export interface DailyClicks {
  date: string;
  count: number;
}

export interface TopBookingPlace {
  placeName: string;
  clicks: number;
  views: number;
}

export async function fetchBookingProviderAnalytics(): Promise<{
  providers: BookingProvider[];
  dailyClicks: DailyClicks[];
  topPlaces: TopBookingPlace[];
}> {
  return apiGet("/api/v1/admin/analytics/booking");
}
