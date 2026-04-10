// ─── Curated Route Fulfillment ──────────────────────────────────────────────
//
// Called by the Stripe webhook after a curated_route purchase is paid.
// Generates a sponsored route for the buyer's place in their city,
// displacing the oldest editorial route if needed.
//

import { db } from '../../db/postgres'
import {
  countActiveByCity,
  findEditorialToDisplace,
  deactivateRoute,
  createCuratedRoute,
} from './curated-routes.query'
import { generateSponsoredRoute } from './curated-routes.generation'

const MAX_ROUTES_PER_CITY = 2
const CURATED_ROUTE_DURATION_DAYS = 15

export interface CuratedRouteFulfillmentResult {
  status: 'created' | 'generation_failed' | 'no_city'
  routeId?: string
  displacedRouteId?: string | null
}

/**
 * Fulfill a curated_route purchase.
 *
 * Steps:
 *  1. Resolve buyer's place_id and city slug
 *  2. Check if city has < 2 sponsored routes
 *  3. If city has 2 routes and at least 1 editorial, deactivate oldest editorial
 *  4. Generate a sponsored route around the buyer's place
 *  5. Save the route with route_type = 'sponsored', expires in 15 days
 */
export async function fulfillCuratedRoute(
  placeId: string,
  purchaseId: string,
): Promise<CuratedRouteFulfillmentResult> {
  // 1. Resolve city slug for the buyer's place
  const { rows: cityRows } = await db.query<{ city_slug: string }>(
    `SELECT d.slug AS city_slug
     FROM places p
     JOIN destinations d ON d.id = p.destination_id
     WHERE p.id = $1 LIMIT 1`,
    [placeId],
  )

  const citySlug = cityRows[0]?.city_slug
  if (!citySlug) {
    console.error(`[curated-route-fulfillment] No city found for place ${placeId}`)
    return { status: 'no_city' }
  }

  // 2. Check current route capacity — max 2 total per city
  const counts = await countActiveByCity(citySlug)
  let displacedRouteId: string | null = null

  // If city already has 2 sponsored, reject (no editorial to displace)
  if (counts.sponsored >= MAX_ROUTES_PER_CITY) {
    console.error(`[curated-route-fulfillment] City ${citySlug} already has ${counts.sponsored} sponsored routes — cannot add more`)
    return { status: 'generation_failed' }
  }

  // 3. If at capacity (2 routes) and at least 1 editorial, displace oldest editorial
  if (counts.total >= MAX_ROUTES_PER_CITY && counts.editorial > 0) {
    displacedRouteId = await findEditorialToDisplace(citySlug)
    if (displacedRouteId) {
      await deactivateRoute(displacedRouteId)
      console.info(
        `[curated-route-fulfillment] Deactivated editorial route ${displacedRouteId} in ${citySlug} to make room for sponsored route`,
      )
    }
  }

  // 4. Generate the sponsored route
  const generated = await generateSponsoredRoute(citySlug, placeId)

  if (!generated) {
    console.error(
      `[curated-route-fulfillment] Route generation failed for place ${placeId} in ${citySlug}`,
    )
    return { status: 'generation_failed', displacedRouteId }
  }

  // 5. Create the route with 15-day expiration
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + CURATED_ROUTE_DURATION_DAYS)

  const result = await createCuratedRoute({
    citySlug: generated.citySlug,
    routeType: 'sponsored',
    templateType: generated.templateType,
    sponsorPlaceId: placeId,
    title: generated.title,
    summary: generated.summary,
    expiresAt,
    purchaseId,
    stops: generated.stops,
  })

  console.info(
    `[curated-route-fulfillment] Created sponsored route ${result.id} for place ${placeId} in ${citySlug} (expires ${expiresAt.toISOString()})`,
  )

  return {
    status: 'created',
    routeId: result.id,
    displacedRouteId,
  }
}
