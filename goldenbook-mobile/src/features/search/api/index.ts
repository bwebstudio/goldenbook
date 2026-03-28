import { api } from '@/api/endpoints';
import type { SearchResults } from '@/types/api';

export const searchApi = {
  search: (query: string, city: string, locale = 'en'): Promise<SearchResults> =>
    api.search(query, city, locale),
};