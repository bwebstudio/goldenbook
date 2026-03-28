import { api } from '@/api/endpoints';
import type { RoutesResponseDTO, RouteDetailDTO } from '@/types/api';

export const routesApi = {
  getRoutes: (city: string, locale = 'en'): Promise<RoutesResponseDTO> =>
    api.routes(city, locale),

  getRoute: (slug: string, locale = 'en'): Promise<RouteDetailDTO> =>
    api.routeBySlug(slug, locale),
};
