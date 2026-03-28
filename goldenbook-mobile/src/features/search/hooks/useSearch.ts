import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { searchApi } from '../api';

export const SEARCH_QUERY_KEY = (query: string, city: string, locale: string) =>
  ['search', query, city, locale] as const;

export function useSearch(query: string, city: string) {
  const locale = useSettingsStore((s) => s.locale);

  return useQuery({
    queryKey: SEARCH_QUERY_KEY(query, city, locale),
    queryFn: () => searchApi.search(query, city, locale),
    staleTime: 1000 * 60 * 5,
    enabled: query.length >= 2,
  });
}