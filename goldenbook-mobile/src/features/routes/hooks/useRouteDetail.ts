import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { routesApi } from '../api';

export const ROUTE_DETAIL_QUERY_KEY = (slug: string, locale: string) => ['route', slug, locale] as const;

export function useRouteDetail(slug: string) {
  const locale = useSettingsStore((s) => s.locale);

  return useQuery({
    queryKey: ROUTE_DETAIL_QUERY_KEY(slug, locale),
    queryFn: () => routesApi.getRoute(slug, locale),
    staleTime: 1000 * 60 * 15,
    enabled: !!slug,
  });
}
