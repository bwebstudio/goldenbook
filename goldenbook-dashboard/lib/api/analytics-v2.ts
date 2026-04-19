// Admin analytics V2 — fetchers for the unified analytics_events +
// user_sessions + search_queries pipeline.
//
// Backend routes (see admin-analytics-v2.route.ts):
//   GET /api/v1/admin/analytics/users?period=7|30|90
//   GET /api/v1/admin/analytics/content?period=7|30|90
//   GET /api/v1/admin/analytics/features?period=7|30|90
//   GET /api/v1/admin/analytics/search?period=7|30|90
//
// All callers must be authenticated as a dashboard admin. Period values are
// the string union "7" | "30" | "90"; defaults to "30" to match the server.

import { apiGet } from "./client";

export type AnalyticsPeriod = "7" | "30" | "90";

// ── Users ────────────────────────────────────────────────────────────────────
export interface UsersAnalytics {
  period: number;
  kpis: {
    dauToday: number;
    wau: number;
    mau: number;
    sessionsPerUser: number;
    avgSessionSec: number;
    sessionP50Sec: number;
    sessionP75Sec: number;
    sessionP95Sec: number;
  };
  dau: { date: string; dau: number }[];
  sessions: { date: string; ios: number; android: number; web: number; total: number }[];
}

export async function fetchUsersAnalytics(period: AnalyticsPeriod = "30"): Promise<UsersAnalytics> {
  return apiGet<UsersAnalytics>("/api/v1/admin/analytics/users", { period });
}

// ── Content ──────────────────────────────────────────────────────────────────
export interface ContentAnalytics {
  period: number;
  mostViewed:    { placeId: string; name: string; count: number }[];
  mostSaved:     { placeId: string; name: string; count: number }[];
  mostBooked:    { placeId: string; name: string; count: number }[];
  topCategories: { slug: string; count: number }[];
  topCities:     { slug: string; count: number }[];
  topBookingCtr: { placeId: string; name: string; views: number; clicks: number; ctrPct: number }[];
}

export async function fetchContentAnalytics(period: AnalyticsPeriod = "30"): Promise<ContentAnalytics> {
  return apiGet<ContentAnalytics>("/api/v1/admin/analytics/content", { period });
}

// ── Features ─────────────────────────────────────────────────────────────────
export interface FeaturesAnalytics {
  period: number;
  now:       { count: number; uniqueUsers: number };
  concierge: { count: number; uniqueUsers: number };
  search:    { count: number; uniqueUsers: number };
  routes:    { starts: number; completes: number; completionRate: number };
}

export async function fetchFeaturesAnalytics(period: AnalyticsPeriod = "30"): Promise<FeaturesAnalytics> {
  return apiGet<FeaturesAnalytics>("/api/v1/admin/analytics/features", { period });
}

// ── Search ───────────────────────────────────────────────────────────────────
export interface SearchAnalytics {
  period: number;
  totals: { count: number; avgResults: number };
  topQueries:        { query: string; count: number; avgResults: number }[];
  zeroResultQueries: { query: string; count: number }[];
}

export async function fetchSearchAnalytics(period: AnalyticsPeriod = "30"): Promise<SearchAnalytics> {
  return apiGet<SearchAnalytics>("/api/v1/admin/analytics/search", { period });
}
