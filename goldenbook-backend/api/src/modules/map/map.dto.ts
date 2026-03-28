import type { MapPlaceRow } from './map.query'

function toFloat(val: string): number {
  return parseFloat(val)
}

export interface MapPlaceDTO {
  id: string
  slug: string
  name: string
  latitude: number
  longitude: number
  placeType: string
  categorySlugs: string[]
  cityName: string
  heroImage: { bucket: string | null; path: string | null }
}

export interface MapResponseDTO {
  items: MapPlaceDTO[]
}

export function toMapPlaceDTO(row: MapPlaceRow): MapPlaceDTO {
  return {
    id:            row.id,
    slug:          row.slug,
    name:          row.name,
    latitude:      toFloat(row.latitude),
    longitude:     toFloat(row.longitude),
    placeType:     row.place_type,
    categorySlugs: row.category_slugs ?? [],
    cityName:      row.city_name,
    heroImage:     { bucket: row.hero_bucket, path: row.hero_path },
  }
}