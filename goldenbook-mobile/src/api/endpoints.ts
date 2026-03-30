import { apiClient } from './client';
import type {
  Destination,
  CategoryDetailDTO,
  MapResponseDTO,
  UserProfile,
  SavedResponse,
  SearchResults,
  DiscoverResponse,
  PlaceDetailDTO,
  RoutesResponseDTO,
  RouteDetailDTO,
} from '@/types/api';
import type {
  ConciergeBootstrapDTO,
  ConciergeRecommendResponseDTO,
} from '@/features/concierge/types';

export const api = {
  health: () => apiClient.get('/health'),

  discover: (city: string, interests?: string[], style?: string, locale = 'en') =>
    apiClient
      .get<DiscoverResponse>('/discover', {
        params: {
          city,
          locale,
          ...(interests?.length ? { interests: interests.join(',') } : {}),
          ...(style ? { style } : {}),
        },
      })
      .then((r) => r.data),

  destinations: () =>
    apiClient.get<Destination[]>('/destinations').then((r) => r.data),

  placeBySlug: (slug: string, locale = 'en') =>
    apiClient.get<PlaceDetailDTO>(`/places/${slug}`, { params: { locale } }).then((r) => r.data),

  routes: (city: string, locale = 'en', limit = 20, offset = 0) =>
    apiClient
      .get<RoutesResponseDTO>('/routes', { params: { city, locale, limit, offset } })
      .then((r) => r.data),

  routeBySlug: (slug: string, locale = 'en') =>
    apiClient.get<RouteDetailDTO>(`/routes/${slug}`, { params: { locale } }).then((r) => r.data),

  search: (query: string, city?: string, locale = 'en') =>
    apiClient.get<SearchResults>('/search', { params: { q: query, city, locale } }).then((r) => r.data),

  categoryBySlug: (slug: string, city: string, locale = 'en') =>
    apiClient.get<CategoryDetailDTO>(`/categories/${slug}`, { params: { city, locale } }).then((r) => r.data),

  mapPlaces: (city: string, category?: string) =>
    apiClient
      .get<MapResponseDTO>('/map/places', { params: { city, category } })
      .then((r) => r.data.items),

  me: () =>
    apiClient.get<UserProfile>('/me').then((r) => r.data),

  mySaved: (locale = 'en') =>
    apiClient.get<SavedResponse>('/me/saved', { params: { locale } }).then((r) => r.data),

  savePlace: (placeId: string) =>
    apiClient.post(`/me/saved/places/${placeId}`).then((r) => r.data),

  unsavePlace: (placeId: string) =>
    apiClient.delete(`/me/saved/places/${placeId}`).then((r) => r.data),

  saveRoute: (routeId: string) =>
    apiClient.post(`/me/saved/routes/${routeId}`).then((r) => r.data),

  unsaveRoute: (routeId: string) =>
    apiClient.delete(`/me/saved/routes/${routeId}`).then((r) => r.data),

  // ── Booking tracking ───────────────────────────────────────────────────────
  trackBookingClick: (params: {
    placeId: string;
    provider: string;
    bookingMode: string;
    targetUrl?: string | null;
    locale?: string;
    city?: string;
    sessionId?: string;
  }) =>
    apiClient.post('/booking/click', params).catch(() => {}),

  trackBookingImpression: (params: {
    placeId: string;
    provider: string;
    bookingMode: string;
    targetUrl?: string | null;
    locale?: string;
    city?: string;
    sessionId?: string;
  }) =>
    apiClient.post('/booking/impression', params).catch(() => {}),

  // ── Concierge ─────────────────────────────────────────────────────────────
  conciergeBootstrap: (city?: string, locale = 'en') =>
    apiClient
      .get<ConciergeBootstrapDTO>('/concierge/bootstrap', { params: { city, locale } })
      .then((r) => r.data),

  conciergeRecommend: (params: {
    city?: string
    intent?: string
    query?: string
    limit?: number
    locale?: string
  }) =>
    apiClient
      .post<ConciergeRecommendResponseDTO>('/concierge/recommend', params)
      .then((r) => r.data),
};
