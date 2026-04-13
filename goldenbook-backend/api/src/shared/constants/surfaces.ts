// ─── Surface Name Constants ──────────────────────────────────────────────────
//
// Single source of truth for the three naming conventions:
//
//   1. PLACEMENT_TYPE: used in purchases, pricing_plans, campaign section
//      Example: 'hidden_gems', 'golden_picks'
//
//   2. VISIBILITY_SURFACE: used in place_visibility.surface
//      Example: 'hidden_spots', 'golden_picks'
//
//   3. INVENTORY_KEY: used in promotion_inventory.surface
//      Same as PLACEMENT_TYPE
//
// The only mismatch: hidden_gems (placement) ↔ hidden_spots (visibility)

/** Visibility surface used in place_visibility for "hidden gems" section */
export const SURFACE_HIDDEN_GEMS = 'hidden_spots'

/** All discover surfaces (mutually exclusive per place) */
export const DISCOVER_SURFACES = ['golden_picks', SURFACE_HIDDEN_GEMS, 'new_on_goldenbook'] as const

/** Surfaces that allow only 1 active placement per place */
export const ONE_PER_PLACE_SURFACES = ['now', 'search_priority', 'category_featured'] as const

/** Maps placement_type (purchases/pricing) → visibility surface (place_visibility) */
export const PLACEMENT_TO_SURFACE: Record<string, string> = {
  golden_picks: 'golden_picks',
  now: 'now',
  hidden_gems: SURFACE_HIDDEN_GEMS,
  category_featured: 'category_featured',
  search_priority: 'search_priority',
  new_on_goldenbook: 'new_on_goldenbook',
  concierge: 'concierge',
  route_featured_stop: 'route_featured',
  route_sponsor: 'route_sponsor',
  curated_route: 'curated_route',
}

/** Maps visibility surface → inventory key (promotion_inventory) */
export const SURFACE_TO_INVENTORY: Record<string, string> = {
  golden_picks: 'golden_picks',
  now: 'now',
  [SURFACE_HIDDEN_GEMS]: 'hidden_gems',
  category_featured: 'category_featured',
  search_priority: 'search_priority',
  new_on_goldenbook: 'new_on_goldenbook',
  concierge: 'concierge',
  route_featured: 'route_featured_stop',
  route_sponsor: 'route_sponsor',
  curated_route: 'curated_route',
}

/** Convert placement_type → visibility surface */
export function placementToSurface(placementType: string): string {
  return PLACEMENT_TO_SURFACE[placementType] ?? placementType
}

/** Convert visibility surface → inventory key */
export function surfaceToInventoryKey(surface: string): string {
  return SURFACE_TO_INVENTORY[surface] ?? surface
}
