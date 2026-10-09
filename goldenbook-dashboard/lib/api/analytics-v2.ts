// Admin analytics V2 — fetchers for the unified analytics_events +
// user_sessions + search_queries pipeline.
//
// Backend routes (see admin-analytics-v2.route.ts):
//   GET /api/v1/admin/analytics/users?period=7|30|90
//   GET /api/v1/admin/analytics/content?period=7|30|90
//   GET /api/v1/admin/analytics/features?period=7|30|90
//   GET /api/v1/admin/analytics/search?period=7|30|90
//
// And the KPIs beside them (see admin-analytics-kpis.route.ts):
//   GET /api/v1/admin/analytics/retention
//   GET /api/v1/admin/analytics/push?period=7|30|90
//   GET /api/v1/admin/analytics/attribution?period=7|30|90
//   GET /api/v1/admin/analytics/place-counts
//
// Every reader excludes internal and QA traffic server-side. All but
// place-counts also take `audience`: "core" leaves out task-app users (they
// searched "day" or only digits in their first seconds), "all" keeps them.
// The server defaults to "all"; the dashboard defaults to "core".
//
// All callers must be authenticated as a dashboard admin. Period values are
// the string union "7" | "30" | "90"; defaults to "30" to match the server.

import { apiGet } from "./client";

export type AnalyticsPeriod = "7" | "30" | "90";
export type AnalyticsAudience = "core" | "all";

// ── Users ────────────────────────────────────────────────────────────────────
export interface UsersAnalytics {
  period: number;
  kpis: {
    dauToday: number;
    wau: number;
    mau: number;
    sessionsPerUser: number;
    // Session length. No mean: background time inflates it. Only sessions
    // from `durationSince` on, when ended_at started being recorded right.
    sessionP50Sec: number;
    sessionP75Sec: number;
    sessionP90Sec: number;
    sessionsMeasured: number;
    durationSince: string;
  };
  dau: { date: string; dau: number }[];
  sessions: { date: string; ios: number; android: number; web: number; total: number }[];
}

export async function fetchUsersAnalytics(period: AnalyticsPeriod = "30", audience: AnalyticsAudience = "core"): Promise<UsersAnalytics> {
  return apiGet<UsersAnalytics>("/api/v1/admin/analytics/users", { period, audience });
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

export async function fetchContentAnalytics(period: AnalyticsPeriod = "30", audience: AnalyticsAudience = "core"): Promise<ContentAnalytics> {
  return apiGet<ContentAnalytics>("/api/v1/admin/analytics/content", { period, audience });
}

// ── Features ─────────────────────────────────────────────────────────────────
export interface FeaturesAnalytics {
  period: number;
  now:       { count: number; uniqueUsers: number };
  concierge: { count: number; uniqueUsers: number };
  search:    { count: number; uniqueUsers: number };
  routes:    { starts: number; completes: number; completionRate: number };
}

export async function fetchFeaturesAnalytics(period: AnalyticsPeriod = "30", audience: AnalyticsAudience = "core"): Promise<FeaturesAnalytics> {
  return apiGet<FeaturesAnalytics>("/api/v1/admin/analytics/features", { period, audience });
}

// ── Search ───────────────────────────────────────────────────────────────────
export interface SearchAnalytics {
  period: number;
  totals: {
    count: number;
    avgResults: number;
    zeroResults: number;
    /** null when there were no searches in the period. */
    zeroResultRatePct: number | null;
  };
  /** Fixed 12-week window, whatever the period. */
  zeroResultTrend: { week: string; total: number; zero: number; ratePct: number | null }[];
  topQueries:        { query: string; count: number; avgResults: number }[];
  zeroResultQueries: { query: string; count: number }[];
}

export async function fetchSearchAnalytics(period: AnalyticsPeriod = "30", audience: AnalyticsAudience = "core"): Promise<SearchAnalytics> {
  return apiGet<SearchAnalytics>("/api/v1/admin/analytics/search", { period, audience });
}

// ── Retention ────────────────────────────────────────────────────────────────
// Weekly cohorts by first activity. A share is null until its window has
// fully passed for every member of the cohort.
export interface RetentionCohort {
  week: string;
  users: number;
  d1Pct: number | null;
  d1to7Pct: number | null;
  d8to30Pct: number | null;
}

export interface RetentionAnalytics {
  weeks: number;
  cohorts: RetentionCohort[];
}

export async function fetchRetentionAnalytics(audience: AnalyticsAudience = "core"): Promise<RetentionAnalytics> {
  return apiGet<RetentionAnalytics>("/api/v1/admin/analytics/retention", { audience });
}

// ── Push ritual ──────────────────────────────────────────────────────────────
// null platform/city = the app did not report it.
export interface PushAnalytics {
  period: number;
  devices: {
    active: number;
    inactive: number;
    inBackoff: number;
    byPlatform: { platform: string | null; count: number }[];
    byCity: { city: string | null; count: number }[];
  };
  totals: { sent: number; opened: number; openRatePct: number | null };
  daily: { date: string; sent: number; opened: number }[];
}

export async function fetchPushAnalytics(period: AnalyticsPeriod = "30", audience: AnalyticsAudience = "core"): Promise<PushAnalytics> {
  return apiGet<PushAnalytics>("/api/v1/admin/analytics/push", { period, audience });
}

// ── Attribution ──────────────────────────────────────────────────────────────
// null source/category = sent by an app older than 1.2.0.
export interface AttributionAnalytics {
  period: number;
  totalOpens: number;
  attributedOpens: number;
  opensBySource: { source: string | null; count: number }[];
  topCategories: { category: string | null; opens: number; saves: number }[];
}

export async function fetchAttributionAnalytics(period: AnalyticsPeriod = "30", audience: AnalyticsAudience = "core"): Promise<AttributionAnalytics> {
  return apiGet<AttributionAnalytics>("/api/v1/admin/analytics/attribution", { period, audience });
}

// ── Place counts (dashboard home) ────────────────────────────────────────────
export interface PlaceStatusCounts {
  published: number;
  draft: number;
  archived: number;
  total: number;
}

export interface PlaceCounts {
  totals: PlaceStatusCounts;
  cities: (PlaceStatusCounts & { slug: string; name: string })[];
}

export async function fetchPlaceCounts(): Promise<PlaceCounts> {
  return apiGet<PlaceCounts>("/api/v1/admin/analytics/place-counts");
}
