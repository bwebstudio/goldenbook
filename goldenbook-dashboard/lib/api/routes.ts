// API functions for the admin routes endpoints.

import { apiDelete, apiGet, apiPost, apiPut, apiPutVoid } from "./client";
import type {
  AdminRoutesResponseDTO,
  AdminRouteResponseDTO,
  AdminRoutePlacesResponseDTO,
  CreateRoutePayload,
  UpdateRoutePayload,
  SetRoutePlacesPayload,
} from "@/types/api/route";

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function fetchAdminRoutes(): Promise<AdminRouteResponseDTO[]> {
  const data = await apiGet<AdminRoutesResponseDTO>("/api/v1/admin/routes");
  return data.items;
}

export async function fetchAdminRouteById(id: string): Promise<AdminRouteResponseDTO> {
  return apiGet<AdminRouteResponseDTO>(`/api/v1/admin/routes/${encodeURIComponent(id)}`);
}

export async function fetchAdminRoutePlaces(routeId: string): Promise<AdminRoutePlacesResponseDTO> {
  return apiGet<AdminRoutePlacesResponseDTO>(`/api/v1/admin/routes/${encodeURIComponent(routeId)}/places`);
}

// ─── Write ─────────────────────────────────────────────────────────────────────

export async function createRoute(payload: CreateRoutePayload): Promise<AdminRouteResponseDTO> {
  return apiPost<AdminRouteResponseDTO>("/api/v1/admin/routes", payload);
}

export async function updateRoute(
  id: string,
  payload: UpdateRoutePayload,
): Promise<AdminRouteResponseDTO> {
  return apiPut<AdminRouteResponseDTO>(`/api/v1/admin/routes/${encodeURIComponent(id)}`, payload);
}

export async function setRoutePlaces(
  routeId: string,
  payload: SetRoutePlacesPayload,
): Promise<void> {
  return apiPutVoid(`/api/v1/admin/routes/${encodeURIComponent(routeId)}/places`, payload);
}

export async function archiveRoute(id: string): Promise<void> {
  return apiDelete(`/api/v1/admin/routes/${encodeURIComponent(id)}`);
}
