import { apiClient } from '@/api/client'
import type { ConciergeBootstrapDTO, ConciergeRecommendResponseDTO } from '../types'

export const conciergeApi = {
  bootstrap: (
    city?: string,
    interests?: string[],
    style?: string,
    locale = 'en',
  ): Promise<ConciergeBootstrapDTO> =>
    apiClient
      .get<ConciergeBootstrapDTO>('/concierge/bootstrap', {
        params: {
          city,
          locale,
          ...(interests?.length ? { interests: interests.join(',') } : {}),
          ...(style ? { style } : {}),
        },
      })
      .then((r) => r.data),

  recommend: (params: {
    city?: string
    intent?: string
    query?: string
    limit?: number
    locale?: string
    interests?: string[]
    style?: string
  }): Promise<ConciergeRecommendResponseDTO> =>
    apiClient
      .post<ConciergeRecommendResponseDTO>('/concierge/recommend', params)
      .then((r) => r.data),
}
