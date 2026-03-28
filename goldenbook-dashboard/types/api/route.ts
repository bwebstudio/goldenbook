// Raw API types matching the admin routes backend endpoints.

export interface AdminRouteResponseDTO {
  id:               string
  slug:             string
  title:            string
  summary:          string | null
  body:             string | null
  routeType:        string
  estimatedMinutes: number | null
  featured:         boolean
  status:           string
  citySlug:         string
  cityName:         string
  placesCount:      number
  heroImage:        { bucket: string | null; path: string | null }
}

export interface AdminRoutePlaceDTO {
  id:          string
  slug:        string
  name:        string
  note:        string | null
  stayMinutes: number | null
  sortOrder:   number
  heroImage:   { bucket: string | null; path: string | null }
  city:        string | null
}

export interface AdminRoutesResponseDTO {
  items: AdminRouteResponseDTO[]
}

export interface AdminRoutePlacesResponseDTO {
  items: AdminRoutePlaceDTO[]
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateRoutePayload {
  title:             string
  slug:              string
  summary?:          string
  body?:             string
  citySlug:          string
  routeType:         string
  estimatedMinutes?: number
  featured:          boolean
  status:            'draft' | 'published' | 'archived'
}

export type UpdateRoutePayload = Partial<CreateRoutePayload>

export interface SetRoutePlacesPayload {
  places: {
    placeId:      string
    sortOrder:    number
    note?:        string
    stayMinutes?: number
  }[]
}