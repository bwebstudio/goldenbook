import { api } from '@/api/endpoints';

export const savedApi = {
  getSaved: (locale: string) => api.mySaved(locale),
  savePlace: (placeId: string) => api.savePlace(placeId),
  unsavePlace: (placeId: string) => api.unsavePlace(placeId),
  saveRoute: (routeId: string) => api.saveRoute(routeId),
  unsaveRoute: (routeId: string) => api.unsaveRoute(routeId),
};
