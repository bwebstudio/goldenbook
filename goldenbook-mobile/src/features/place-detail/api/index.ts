import { api } from '@/api/endpoints';
import type { PlaceDetailDTO } from '@/types/api';

export const placeDetailApi = {
  getPlace: (slug: string, locale = 'en'): Promise<PlaceDetailDTO> =>
    api.placeBySlug(slug, locale),
};
