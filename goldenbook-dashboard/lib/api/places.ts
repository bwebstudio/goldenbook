import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type {
  MapPlacesResponseDTO,
  MapPlaceDTO,
  PlaceDetailDTO,
  AdminPlacePayload,
  AdminPlaceResponseDTO,
  AdminCategoriesResponseDTO,
  AdminCategoryDTO,
  AdminPlaceListResponseDTO,
  AdminPlaceListItem,
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
// Default locale is 'pt' because Portuguese is the source of truth for editorial.
export async function fetchPlaceBySlug(slug: string, locale = "pt"): Promise<PlaceDetailDTO> {
  return apiGet<PlaceDetailDTO>(`/api/v1/places/${encodeURIComponent(slug)}`, { locale });
}

// GET /api/v1/admin/categories
// Returns all active categories and subcategories. Used to populate the category dropdown.
export async function fetchAdminCategories(locale = 'en'): Promise<AdminCategoryDTO[]> {
  const lang = locale.split('-')[0];
  const data = await apiGet<AdminCategoriesResponseDTO>(`/api/v1/admin/categories?locale=${lang}`);
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

// GET /api/v1/admin/places
// Lightweight list with booking + suggestion metadata for filtering.
export async function fetchAdminPlacesList(): Promise<AdminPlaceListItem[]> {
  const data = await apiGet<AdminPlaceListResponseDTO>("/api/v1/admin/places");
  return data.items;
}

// DELETE /api/v1/admin/places/:id
export async function deletePlaceById(id: string): Promise<void> {
  await apiDelete(`/api/v1/admin/places/${encodeURIComponent(id)}`);
}

// ── NOW Visibility ──────────────────────────────────────────────────────────

export interface NowContextTag {
  slug: string;
  name: string;
  description: string | null;
}

export interface NowPlaceConfig {
  nowEnabled: boolean;
  nowPriority: number;
  nowFeatured: boolean;
  nowStartAt: string | null;
  nowEndAt: string | null;
  nowTagSlugs: string[];
  nowTimeWindows: string[];
}

// GET /api/v1/admin/now/tags — all available context tags
// GET /api/v1/admin/places/search-google?q=...
// Google Places autocomplete for the new place flow.
export async function searchGooglePlaces(query: string): Promise<{ placeId: string; name: string; address: string }[]> {
  const data = await apiGet<{ results: { placeId: string; name: string; address: string }[] }>(
    "/api/v1/admin/places/search-google", { q: query }
  );
  return data.results;
}

// POST /api/v1/admin/places/generate
// Creates a fully auto-filled place from a Google Place ID.
export async function generatePlace(googlePlaceId: string, citySlug: string): Promise<AdminPlaceResponseDTO> {
  return apiPost<AdminPlaceResponseDTO>("/api/v1/admin/places/generate", { googlePlaceId, citySlug });
}

export async function fetchNowContextTags(): Promise<NowContextTag[]> {
  const data = await apiGet<{ items: NowContextTag[] }>("/api/v1/admin/now/tags");
  return data.items;
}

// GET /api/v1/admin/places/:id/now — current NOW config for a place
export async function fetchPlaceNowConfig(placeId: string): Promise<NowPlaceConfig> {
  return apiGet<NowPlaceConfig>(`/api/v1/admin/places/${encodeURIComponent(placeId)}/now`);
}
