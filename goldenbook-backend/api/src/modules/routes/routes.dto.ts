import type { RouteListRow, RouteDetailRow, RoutePlaceRow } from './routes.query'

interface MediaAssetDTO { bucket: string | null; path: string | null }

function toFloat(val: unknown): number | null {
  if (val == null) return null
  const n = typeof val === 'string' ? parseFloat(val) : Number(val)
  return isFinite(n) ? n : null
}

// ─── List ─────────────────────────────────────────────────────────────────────

export interface RouteCardDTO {
  id: string
  slug: string
  title: string
  summary: string | null
  routeType: string
  estimatedMinutes: number | null
  featured: boolean
  heroImage: MediaAssetDTO
  placesCount: number
  city: { slug: string; name: string }
}

export interface RoutesResponseDTO {
  items: RouteCardDTO[]
}

export function toRouteCardDTO(row: RouteListRow): RouteCardDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    routeType: row.route_type,
    estimatedMinutes: row.estimated_duration_minutes,
    featured: row.featured,
    heroImage: { bucket: row.hero_bucket, path: row.hero_path },
    placesCount: row.places_count,
    city: { slug: row.city_slug, name: row.city_name },
  }
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export interface RoutePlaceDTO {
  id: string
  slug: string
  name: string
  /** Localized short description of the place itself (from place_translations).
   *  Always falls back through requested locale → en → original column. */
  shortDescription: string | null
  /** Curator's editorial note for this stop on this specific route. */
  note: string | null
  stayMinutes: number | null
  sortOrder: number
  heroImage: MediaAssetDTO
  location: {
    address: string | null
    latitude: number | null
    longitude: number | null
  }
}

export interface RouteDetailDTO {
  id: string
  slug: string
  title: string
  summary: string | null
  body: string | null
  routeType: string
  estimatedMinutes: number | null
  featured: boolean
  heroImage: MediaAssetDTO
  city: { slug: string; name: string }
  places: RoutePlaceDTO[]
}

export function toRouteDetailDTO(
  route: RouteDetailRow,
  places: RoutePlaceRow[],
): RouteDetailDTO {
  return {
    id: route.id,
    slug: route.slug,
    title: route.title,
    summary: route.summary,
    body: route.body,
    routeType: route.route_type,
    estimatedMinutes: route.estimated_duration_minutes,
    featured: route.featured,
    heroImage: { bucket: route.hero_bucket, path: route.hero_path },
    city: { slug: route.city_slug, name: route.city_name },
    places: places.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.short_description,
      note: p.note,
      stayMinutes: p.stay_minutes,
      sortOrder: p.sort_order,
      heroImage: { bucket: p.hero_bucket, path: p.hero_path },
      location: {
        address: p.address_line,
        latitude: toFloat(p.latitude),
        longitude: toFloat(p.longitude),
      },
    })),
  }
}
