import type { WebHomeDTO } from './types'
import { getWebHomeData } from './queries'

/**
 * Fetch the homepage payload directly from the database.
 * Runs server-side in Next.js Server Components — no external backend needed.
 *
 * Returns null on any error so callers can degrade gracefully.
 */
export async function fetchHomepage(params: {
  locale?: string
  city?: string
}): Promise<WebHomeDTO | null> {
  const locale = params.locale ?? 'en'
  const city = params.city ?? 'lisboa'

  try {
    return await getWebHomeData(city, locale)
  } catch (err) {
    console.error('[goldenbook-web] fetchHomepage error:', err)
    return null
  }
}
