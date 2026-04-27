import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { categoriesApi } from '../api';

export const CATEGORY_QUERY_KEY = (slug: string, city: string, locale: string) =>
  ['category', slug, city, locale] as const;

export function useCategory(slug: string) {
  const city   = useAppStore((s) => s.selectedCity);
  const locale = useSettingsStore((s) => s.locale);

  return useQuery({
    queryKey: CATEGORY_QUERY_KEY(slug, city, locale),
    queryFn: () => categoriesApi.getCategory(slug, city, locale),
    enabled: !!slug && !!city,
    staleTime: 1000 * 60 * 10,
    meta: { cacheable: true },
  });
}