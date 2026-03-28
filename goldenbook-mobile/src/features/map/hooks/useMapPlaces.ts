import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import { mapApi } from '../api';

export const MAP_PLACES_QUERY_KEY = (city: string) =>
  ['map', 'places', city] as const;

export function useMapPlaces() {
  const city = useAppStore((s) => s.selectedCity);

  return useQuery({
    queryKey: MAP_PLACES_QUERY_KEY(city),
    queryFn: () => mapApi.getPlaces(city),
    enabled: !!city,
    staleTime: 1000 * 60 * 10,
  });
}