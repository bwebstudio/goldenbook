import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { placeDetailApi } from '../api';

export const PLACE_DETAIL_QUERY_KEY = (slug: string, locale: string) => ['place', slug, locale] as const;

export function usePlaceDetail(slug: string) {
  const locale = useSettingsStore((s) => s.locale);

  return useQuery({
    queryKey: PLACE_DETAIL_QUERY_KEY(slug, locale),
    queryFn: () => placeDetailApi.getPlace(slug, locale),
    staleTime: 1000 * 60 * 15,
    enabled: !!slug,
    // Place detail pages have to work fully offline once the user has
    // visited them — that's the core "premium guide" promise.
    meta: { cacheable: true },
  });
}
