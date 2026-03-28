import type { SearchPlaceRow, SearchRouteRow, SearchCategoryRow } from './search.query'

interface MediaAssetDTO { bucket: string | null; path: string | null }

export interface SearchPlaceDTO {
  id: string
  slug: string
  name: string
  summary: string | null
  heroImage: MediaAssetDTO
}

export interface SearchRouteDTO {
  id: string
  slug: string
  title: string
  summary: string | null
  heroImage: MediaAssetDTO
}

export interface SearchCategoryDTO {
  id: string
  slug: string
  name: string
  iconName: string | null
}

export interface SearchResponseDTO {
  query: string
  places: SearchPlaceDTO[]
  routes: SearchRouteDTO[]
  categories: SearchCategoryDTO[]
}

export function toSearchPlaceDTO(row: SearchPlaceRow): SearchPlaceDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    heroImage: { bucket: row.hero_bucket, path: row.hero_path },
  }
}

export function toSearchRouteDTO(row: SearchRouteRow): SearchRouteDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    heroImage: { bucket: row.hero_bucket, path: row.hero_path },
  }
}

export function toSearchCategoryDTO(row: SearchCategoryRow): SearchCategoryDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    iconName: row.icon_name,
  }
}