import { api } from '@/api/endpoints';
import type { MapPlace } from '@/types/api';

export const mapApi = {
  getPlaces: (city: string, locale = 'en'): Promise<MapPlace[]> => api.mapPlaces(city, locale),
};
