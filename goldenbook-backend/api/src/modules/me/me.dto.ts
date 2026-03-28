import type { SavedPlaceRow, SavedRouteRow, RecentlyViewedRow } from './me.query'

// ─── Output types (frontend-facing) ──────────────────────────────────────────

interface ImageRef {
  bucket: string
  path: string
}

export interface SavedPlaceDTO {
  id: string
  slug: string
  name: string
  shortDescription: string | null
  savedAt: string
  image: ImageRef | null
}

export interface SavedRouteDTO {
  id: string
  slug: string
  title: string
  summary: string | null
  savedAt: string
  image: ImageRef | null
}

export interface RecentlyViewedDTO {
  id: string
  slug: string
  name: string
  shortDescription: string | null
  viewedAt: string
  image: ImageRef | null
}

export interface SavedDTO {
  savedPlaces: SavedPlaceDTO[]
  savedRoutes: SavedRouteDTO[]
  recentlyViewed: RecentlyViewedDTO[]
}

// ─── Transformers ─────────────────────────────────────────────────────────────

function toImage(bucket: string | null, path: string | null): ImageRef | null {
  if (!bucket || !path) return null
  return { bucket, path }
}

export function toSavedPlaceDTO(row: SavedPlaceRow): SavedPlaceDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    savedAt: row.saved_at instanceof Date ? row.saved_at.toISOString() : String(row.saved_at),
    image: toImage(row.image_bucket, row.image_path),
  }
}

export function toSavedRouteDTO(row: SavedRouteRow): SavedRouteDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    savedAt: row.saved_at instanceof Date ? row.saved_at.toISOString() : String(row.saved_at),
    image: toImage(row.image_bucket, row.image_path),
  }
}

export function toRecentlyViewedDTO(row: RecentlyViewedRow): RecentlyViewedDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    viewedAt: row.viewed_at instanceof Date ? row.viewed_at.toISOString() : String(row.viewed_at),
    image: toImage(row.image_bucket, row.image_path),
  }
}