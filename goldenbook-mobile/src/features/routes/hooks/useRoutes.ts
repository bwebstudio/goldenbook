import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { routesApi } from '../api';

export const ROUTES_QUERY_KEY = (city: string, locale: string) => ['routes', city, locale] as const;

export function useRoutes() {
  const city   = useAppStore((s) => s.selectedCity);
  const locale = useSettingsStore((s) => s.locale);

  return useQuery({
    queryKey: ROUTES_QUERY_KEY(city, locale),
    queryFn: () => routesApi.getRoutes(city, locale),
    staleTime: 1000 * 60 * 10,
    meta: { cacheable: true },
  });
}
