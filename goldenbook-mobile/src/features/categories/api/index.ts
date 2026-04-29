import { api } from '@/api/endpoints';
import type { CategoryDetailDTO } from '@/types/api';

// Default locale is PT — see place-detail/api for rationale.
export const categoriesApi = {
  getCategory: (slug: string, city: string, locale = 'pt'): Promise<CategoryDetailDTO> =>
    api.categoryBySlug(slug, city, locale),
};
