import { apiGet, apiPut, apiPost } from "./client";

export type TranslationLocale = "en" | "es" | "pt";
export type AutoLocale = "en" | "es";

export interface PlaceTranslation {
  locale: string;
  name: string;
  short_description: string | null;
  full_description: string | null;
  goldenbook_note: string | null;
  insider_tip: string | null;
  translation_override: boolean;
  translated_from?: string | null;
  updated_at?: string | null;
}

export interface TranslationFields {
  name?: string;
  shortDescription?: string | null;
  fullDescription?: string | null;
  goldenbookNote?: string | null;
  insiderTip?: string | null;
}

export interface RegenerateTranslationResponse {
  regenerated: boolean;
  source: TranslationLocale;
  succeeded: AutoLocale[];
  failed: AutoLocale[];
  /**
   * Locales that were requested but left untouched because their
   * `translation_override` flag is `true`. The dashboard surfaces these
   * back to the editor so they understand why a target they asked for was
   * not regenerated.
   */
  skippedOverridden?: AutoLocale[];
  persisted: boolean;
  results: Partial<Record<AutoLocale, Required<TranslationFields>>>;
}

export async function fetchPlaceTranslations(placeId: string): Promise<Record<string, PlaceTranslation>> {
  return apiGet<Record<string, PlaceTranslation>>(`/api/v1/admin/places/${placeId}/translations`);
}

// Persist a manual translation override for EN or ES.
export async function updateTranslationOverride(
  placeId: string,
  locale: AutoLocale,
  body: TranslationFields,
): Promise<void> {
  await apiPut(`/api/v1/admin/places/${placeId}/translations/${locale}`, body);
}

// Backwards-compatible helper used in the legacy single-locale UI.
export async function updateEnTranslation(placeId: string, body: TranslationFields): Promise<void> {
  await updateTranslationOverride(placeId, "en", body);
}

// Regenerate auto-translations from a source locale.
//
// Pass `text` to use in-form values as the source (the dashboard does this so
// editors don't have to save before regenerating). Pass `persist: false` to
// preview without writing. `targets` defaults to the two locales other than
// the source.
export async function regenerateTranslation(
  placeId: string,
  options: {
    source?: TranslationLocale;
    text?: TranslationFields;
    targets?: AutoLocale[];
    persist?: boolean;
  } = {},
): Promise<RegenerateTranslationResponse> {
  return apiPost<RegenerateTranslationResponse>(
    `/api/v1/admin/places/${placeId}/translations/regenerate`,
    options,
  );
}
