import type { WebHomeDTO } from './types'
import { env } from './env'

const API_PREFIX = '/api/v1'

/**
 * Fetch the homepage payload from goldenbook-backend.
 * Returns null on any error so callers can degrade gracefully.
 *
 * Uses Next.js ISR: revalidates every 5 minutes.
 */
export async function fetchHomepage(params: {
  locale?: string
  city?: string
}): Promise<WebHomeDTO | null> {
  try {
    const url = new URL(`${env.apiBaseUrl}${API_PREFIX}/web/home`)
    url.searchParams.set('locale', params.locale ?? 'en')
    url.searchParams.set('city', params.city ?? 'lisboa')

    const res = await fetch(url.toString(), {
      cache: 'no-store', // Always fresh — page-level revalidation set in route segment config
    })

    if (!res.ok) {
      console.error(`[goldenbook-web] fetchHomepage failed: ${res.status} ${res.statusText}`)
      return null
    }

    return (await res.json()) as WebHomeDTO
  } catch (err) {
    console.error('[goldenbook-web] fetchHomepage error:', err)
    return null
  }
}
