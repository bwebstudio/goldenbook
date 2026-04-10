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
export async function searchGooglePlaces(query: string): Promise<{ placeId: string; name: string; address: string; lat?: number; lng?: number }[]> {
  const data = await apiGet<{ results: { placeId: string; name: string; address: string; lat?: number; lng?: number }[] }>(
    "/api/v1/admin/places/search-google", { q: query }
  );
  return data.results;
}

// POST /api/v1/admin/places/preview-from-google
// Returns all fields pre-filled WITHOUT creating the place.
export async function previewPlaceFromGoogle(googlePlaceId: string): Promise<PlacePreview> {
  return apiPost<PlacePreview>("/api/v1/admin/places/preview-from-google", { googlePlaceId });
}

export interface PlacePreview {
  name: string;
  slug: string;
  citySlug: string;
  placeType: string;
  categorySlug: string;
  subcategorySlug: string;
  addressLine: string | null;
  phone: string | null;
  websiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string;
  googleRating: number | null;
  googleRatingCount: number | null;
  googleMapsUrl: string | null;
  priceTier: number | null;
  cuisineTypes: string[];
  reservable: boolean;
  shortDescription: string;
  fullDescription: string;
  goldenbookNote: string;
  insiderTip: string;
  openingHours: Array<{ dayOfWeek: number; opensAt: string; closesAt: string }>;
  photoUrls: string[];
  photoNames: string[];
}

// POST /api/v1/admin/places/:id/ingest-google-photos
// Downloads Google photos and uploads them to Supabase storage.
export async function ingestGooglePhotos(placeId: string, photoNames: string[]): Promise<{ ingested: number; failed: number }> {
  return apiPost<{ ingested: number; failed: number }>(
    `/api/v1/admin/places/${encodeURIComponent(placeId)}/ingest-google-photos`,
    { photoNames }
  );
}

export async function fetchNowContextTags(): Promise<NowContextTag[]> {
  const data = await apiGet<{ items: NowContextTag[] }>("/api/v1/admin/now/tags");
  return data.items;
}

// GET /api/v1/admin/places/:id/now — current NOW config for a place
export async function fetchPlaceNowConfig(placeId: string): Promise<NowPlaceConfig> {
  return apiGet<NowPlaceConfig>(`/api/v1/admin/places/${encodeURIComponent(placeId)}/now`);
}
