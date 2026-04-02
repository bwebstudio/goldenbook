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
  });
}
