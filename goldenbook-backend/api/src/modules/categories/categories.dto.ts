import type { CategoryHeaderRow, SubcategoryRow, CategoryPlaceRow } from './categories.query'

interface MediaAssetDTO { bucket: string | null; path: string | null }

export interface SubcategoryDTO {
  slug: string
  name: string
}

export interface CategoryPlaceDTO {
  id: string
  slug: string
  name: string
  summary: string | null
  heroImage: MediaAssetDTO
  cityName: string
}

export interface CategoryDetailDTO {
  slug: string
  name: string
  description: string | null
  iconName: string | null
  subcategories: SubcategoryDTO[]
  items: CategoryPlaceDTO[]
}

export function toCategoryDetailDTO(
  header: CategoryHeaderRow,
  subcategories: SubcategoryRow[],
  places: CategoryPlaceRow[],
): CategoryDetailDTO {
  return {
    slug:        header.slug,
    name:        header.name,
    description: header.description,
    iconName:    header.icon_name,
    subcategories: subcategories.map(s => ({ slug: s.slug, name: s.name })),
    items: Array.from(
      new Map(
        Array.from(new Map(places.map(p => [p.id, p])).values())
          .map(p => [p.slug, p]),
      ).values(),
    ).map(p => ({
      id:        p.id,
      slug:      p.slug,
      name:      p.name,
      summary:   p.summary,
      heroImage: { bucket: p.hero_bucket, path: p.hero_path },
      cityName:  p.city_name,
    })),
  }
}