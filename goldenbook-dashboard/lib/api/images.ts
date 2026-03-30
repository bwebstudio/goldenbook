import { apiGet, apiPost, apiDelete, apiPut } from "./client";

export interface PlaceImageDTO {
  id: string;
  asset_id: string;
  image_role: string;
  sort_order: number;
  is_primary: boolean;
  caption: string | null;
  bucket: string;
  path: string;
  width: number | null;
  height: number | null;
}

export async function fetchPlaceImages(placeId: string): Promise<PlaceImageDTO[]> {
  const data = await apiGet<{ items: PlaceImageDTO[] }>(`/api/v1/admin/places/${placeId}/images`);
  return data.items;
}

export async function setCoverImage(placeId: string, imageId: string): Promise<void> {
  await apiPost(`/api/v1/admin/places/${placeId}/images/set-cover`, { imageId });
}

export async function reorderGallery(placeId: string, imageIds: string[]): Promise<void> {
  await apiPost(`/api/v1/admin/places/${placeId}/images/reorder`, { imageIds });
}

export async function deleteImagePermanent(placeId: string, imageId: string): Promise<void> {
  await apiDelete(`/api/v1/admin/places/${placeId}/images/${imageId}/permanent`);
}

export async function addImage(placeId: string, data: {
  bucket: string; path: string; mimeType?: string | null;
  width?: number | null; height?: number | null; sizeBytes?: number | null;
}): Promise<PlaceImageDTO> {
  return apiPost<PlaceImageDTO>(`/api/v1/admin/places/${placeId}/images`, data);
}
