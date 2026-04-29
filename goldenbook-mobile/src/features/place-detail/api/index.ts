import { api } from '@/api/endpoints';
import type { PlaceDetailDTO } from '@/types/api';

// Default locale is PT — the canonical editorial row (see
// goldenbook-backend admin-places translation policy). Hooks pass the
// user's actual locale via useSettingsStore, so this default only kicks in
// for callers that omit the param entirely (tests, ad-hoc invocations).
export const placeDetailApi = {
  getPlace: (slug: string, locale = 'pt'): Promise<PlaceDetailDTO> =>
    api.placeBySlug(slug, locale),
};
