import { api } from '@/api/endpoints';
import type { RoutesResponseDTO, RouteDetailDTO } from '@/types/api';

// Default locale is PT — see place-detail/api for rationale.
export const routesApi = {
  getRoutes: (city: string, locale = 'pt'): Promise<RoutesResponseDTO> =>
    api.routes(city, locale),

  getRoute: (slug: string, locale = 'pt'): Promise<RouteDetailDTO> =>
    api.routeBySlug(slug, locale),
};
