import { apiGet, apiPost, apiPut } from "./client";

export interface CuratedRouteDTO {
  id: string;
  citySlug: string;
  routeType: "editorial" | "sponsored";
  templateType: string | null;
  sponsorPlaceId: string | null;
  title: string;
  summary: string | null;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  stops: Array<{
    placeId: string;
    stopOrder: number;
    editorialNote: string | null;
    placeName: string;
    placeSlug: string;
    placeType: string;
    heroImage: { bucket: string | null; path: string | null };
    shortDescription: string | null;
  }>;
}

export interface RouteAvailability {
  total: number;
  editorial: number;
  sponsored: number;
  availableSponsored: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdminRow(row: any): CuratedRouteDTO {
  return {
    id: row.id,
    citySlug: row.city_slug ?? row.citySlug,
    routeType: row.route_type ?? row.routeType,
    templateType: row.template_type ?? row.templateType ?? null,
    sponsorPlaceId: row.sponsor_place_id ?? row.sponsorPlaceId ?? null,
    title: row.title,
    summary: row.summary ?? null,
    startsAt: row.starts_at ?? row.startsAt,
    expiresAt: row.expires_at ?? row.expiresAt,
    isActive: row.is_active ?? row.isActive ?? false,
    stops: row.stops ?? [],
  };
}

export async function fetchCuratedRoutes(filters?: {
  city?: string;
  type?: string;
  active?: boolean;
}): Promise<CuratedRouteDTO[]> {
  const params: Record<string, string> = {};
  if (filters?.city) params.city = filters.city;
  if (filters?.type) params.routeType = filters.type;
  if (filters?.active !== undefined) params.isActive = String(filters.active);
  const data = await apiGet<{ items: unknown[] }>("/api/v1/admin/curated-routes", params);
  return data.items.map(mapAdminRow);
}

export async function fetchRouteAvailability(city: string): Promise<RouteAvailability> {
  return apiGet<RouteAvailability>("/api/v1/admin/curated-routes/availability", { city });
}

export async function generateEditorialRoute(city: string): Promise<CuratedRouteDTO> {
  return apiPost<CuratedRouteDTO>("/api/v1/admin/curated-routes/generate", { city });
}

export async function deactivateRoute(id: string): Promise<void> {
  await apiPost(`/api/v1/admin/curated-routes/${id}/deactivate`, {});
}

export async function fetchRouteById(id: string, locale: string = "en"): Promise<CuratedRouteDTO> {
  return apiGet<CuratedRouteDTO>(`/api/v1/admin/curated-routes/${id}`, { locale });
}

export async function createRouteFromScratch(data: {
  citySlug: string;
  routeType: "editorial" | "sponsored";
  sponsorPlaceId?: string | null;
  title: string;
  summary?: string | null;
  stops: Array<{ placeId: string; stopOrder: number; editorialNote?: string | null }>;
}): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/api/v1/admin/curated-routes", data);
}

export async function updateRoute(id: string, data: {
  title?: string;
  summary?: string | null;
  stops?: Array<{ placeId: string; stopOrder: number; editorialNote?: string | null }>;
}): Promise<void> {
  await apiPut(`/api/v1/admin/curated-routes/${id}`, data);
}
