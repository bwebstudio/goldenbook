import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { mapApi } from '../api';

export const MAP_PLACES_QUERY_KEY = (city: string, locale: string) =>
  ['map', 'places', city, locale] as const;

export function useMapPlaces() {
  const city = useAppStore((s) => s.selectedCity);
  const locale = useSettingsStore((s) => s.locale);

  return useQuery({
    queryKey: MAP_PLACES_QUERY_KEY(city, locale),
    queryFn: () => mapApi.getPlaces(city, locale),
    enabled: !!city,
    staleTime: 1000 * 60 * 10,
    // Intentionally NOT persisted to AsyncStorage. Map payloads are large
    // (≈250B × 150 places × 4 cities × 3 locales ≈ 450 KB — about 25% of
    // the on-disk cache budget) and the offline value is low: a static
    // snapshot of pin coordinates without the live region/zoom state is
    // not what a user trying to navigate offline actually needs. Falls
    // back to a normal online fetch on every visit, which is fast enough
    // (single small JSON, image bytes are still cached by expo-image).
  });
}
