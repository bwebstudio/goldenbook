import { apiGet, apiPut, apiPost } from "./client";

export interface PlaceTranslation {
  locale: string;
  name: string;
  short_description: string | null;
  full_description: string | null;
  goldenbook_note: string | null;
  why_we_love_it: string | null;
  insider_tip: string | null;
  translation_override: boolean;
}

export async function fetchPlaceTranslations(placeId: string): Promise<Record<string, PlaceTranslation>> {
  return apiGet<Record<string, PlaceTranslation>>(`/api/v1/admin/places/${placeId}/translations`);
}

export async function updateEnTranslation(placeId: string, body: Record<string, unknown>): Promise<void> {
  await apiPut(`/api/v1/admin/places/${placeId}/translations/en`, body);
}

export async function regenerateTranslation(placeId: string): Promise<void> {
  await apiPost(`/api/v1/admin/places/${placeId}/translations/regenerate`, {});
}
