import { deactivateExpiredRoutes, countActiveByCity, createCuratedRoute, findEditorialToDisplace } from './curated-routes.query'
import { generateEditorialRoute } from './curated-routes.generation'

const CITIES = ['porto', 'lisboa', 'algarve', 'madeira']
const MAX_ROUTES_PER_CITY = 2

export async function runCuratedRoutesCycle(): Promise<void> {
  // 1. Deactivate expired routes
  const expired = await deactivateExpiredRoutes()
  if (expired > 0) console.log(`[curated-routes] Deactivated ${expired} expired routes`)

  // 2. For each city, ensure there are up to MAX_ROUTES_PER_CITY active routes
  for (const city of CITIES) {
    const counts = await countActiveByCity(city)
    const emptySlots = MAX_ROUTES_PER_CITY - counts.total

    for (let i = 0; i < emptySlots; i++) {
      try {
        const generated = await generateEditorialRoute(city)
        if (!generated) {
          console.warn(`[curated-routes] Could not generate editorial route for ${city} — not enough places`)
          break
        }

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 15)

        await createCuratedRoute({
          citySlug: generated.citySlug,
          routeType: 'editorial',
          templateType: generated.templateType,
          sponsorPlaceId: null,
          title: generated.title,
          summary: generated.summary,
          expiresAt,
          stops: generated.stops.map(s => ({
            placeId: s.placeId,
            stopOrder: s.stopOrder,
            editorialNote: s.editorialNote,
          })),
        })
        console.log(`[curated-routes] Generated editorial route for ${city}: "${generated.title}"`)
      } catch (err) {
        console.error(`[curated-routes] Failed to generate route for ${city}:`, err)
      }
    }
  }
}
