import type { DestinationRow } from './destinations.query'

export interface MediaAssetDTO {
  bucket: string | null
  path: string | null
}

export interface DestinationDTO {
  slug: string
  name: string
  heroImage: MediaAssetDTO
}

export interface DestinationsResponseDTO {
  items: DestinationDTO[]
}

export function toDestinationDTO(row: DestinationRow): DestinationDTO {
  return {
    slug: row.slug,
    name: row.name,
    heroImage: {
      bucket: row.hero_bucket,
      path: row.hero_path,
    },
  }
}
