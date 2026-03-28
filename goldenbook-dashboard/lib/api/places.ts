import { apiGet, apiPost, apiPut } from "./client";
import type {
  MapPlacesResponseDTO,
  MapPlaceDTO,
  PlaceDetailDTO,
  AdminPlacePayload,
  AdminPlaceResponseDTO,
  AdminCategoriesResponseDTO,
  AdminCategoryDTO,
} from "@/types/api/place";

// GET /api/v1/map/places?city={citySlug}
// Returns all places for a city with hero images and category slugs.
// This is the best available "list places" endpoint — the backend has no generic list endpoint.
export async function fetchPlacesForCity(citySlug: string): Promise<MapPlaceDTO[]> {
  const data = await apiGet<MapPlacesResponseDTO>("/api/v1/map/places", { city: citySlug });
  return data.items;
}

// GET /api/v1/places/:slug
// Returns full place detail. Used for the edit/detail page.
export async function fetchPlaceBySlug(slug: string): Promise<PlaceDetailDTO> {
  return apiGet<PlaceDetailDTO>(`/api/v1/places/${encodeURIComponent(slug)}`);
}

// GET /api/v1/admin/categories
// Returns all active categories and subcategories. Used to populate the category dropdown.
export async function fetchAdminCategories(): Promise<AdminCategoryDTO[]> {
  const data = await apiGet<AdminCategoriesResponseDTO>("/api/v1/admin/categories");
  return data.items;
}

// POST /api/v1/admin/places
// Creates a new place. Requires name, slug, citySlug, categorySlug, status.
export async function createPlace(payload: AdminPlacePayload): Promise<AdminPlaceResponseDTO> {
  return apiPost<AdminPlaceResponseDTO>("/api/v1/admin/places", payload);
}

// PUT /api/v1/admin/places/:id
// Updates an existing place by internal UUID. Only sends changed fields.
export async function updatePlace(id: string, payload: AdminPlacePayload): Promise<AdminPlaceResponseDTO> {
  return apiPut<AdminPlaceResponseDTO>(`/api/v1/admin/places/${encodeURIComponent(id)}`, payload);
}
