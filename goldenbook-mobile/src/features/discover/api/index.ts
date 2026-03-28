import { api } from '@/api/endpoints';
import type { DiscoverResponse } from '@/types/api';

export const discoverApi = {
  getDiscover: (
    city: string,
    interests?: string[],
    style?: string,
    locale = 'en',
  ): Promise<DiscoverResponse> =>
    api.discover(city, interests, style, locale),
};
