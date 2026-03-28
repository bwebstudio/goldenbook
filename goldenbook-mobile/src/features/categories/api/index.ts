import { api } from '@/api/endpoints';
import type { CategoryDetailDTO } from '@/types/api';

export const categoriesApi = {
  getCategory: (slug: string, city: string, locale = 'en'): Promise<CategoryDetailDTO> =>
    api.categoryBySlug(slug, city, locale),
};