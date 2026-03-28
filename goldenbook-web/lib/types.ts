// ─── Web API types ────────────────────────────────────────────────────────────
// Mirror of goldenbook-backend src/modules/web/web.dto.ts
// Keep in sync when the backend DTO changes.

export interface WebPlaceDTO {
  id: string
  slug: string
  name: string
  category: string | null
  city: string
  whyWeLoveIt: string | null
  address: string | null
  imageUrl: string | null
}

export interface WebExperienceNowSlotDTO {
  id: string
  slug: string
  name: string
  category: string | null
  iconName: string | null
  city: string
  description: string | null
  imageUrl: string | null
}

export interface WebRouteDTO {
  id: string
  slug: string
  name: string
  city: string
  summary: string | null
  stops: number
  imageUrl: string | null
}

export interface WebCityDTO {
  slug: string
  name: string
  country: string
  imageUrl: string | null
}

export interface WebCategoryDTO {
  key: string
  name: string
  iconName: string | null
}

export interface WebHomeDTO {
  hero: {
    citySlug: string
    cityName: string
    imageUrl: string | null
  }
  goldenPicks: WebPlaceDTO[]
  experienceNow: {
    morning: WebExperienceNowSlotDTO | null
    afternoon: WebExperienceNowSlotDTO | null
    evening: WebExperienceNowSlotDTO | null
    night: WebExperienceNowSlotDTO | null
  }
  routes: WebRouteDTO[]
  cities: WebCityDTO[]
  categories: WebCategoryDTO[]
}
