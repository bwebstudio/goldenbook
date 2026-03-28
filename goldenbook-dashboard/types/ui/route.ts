// UI-mapped types for the routes management section of the dashboard.

export type RouteStatus = 'draft' | 'published' | 'archived'

export interface UIRoute {
  id:               string
  slug:             string
  title:            string
  summary:          string | null
  routeType:        string
  estimatedMinutes: number | null
  featured:         boolean
  status:           RouteStatus
  city:             string      // display name
  citySlug:         string
  stopsCount:       number
  coverImage:       string | null  // resolved Supabase storage URL
}

export interface UIRouteStop {
  id:          string   // place UUID
  slug:        string
  name:        string
  note:        string   // empty string when absent
  stayMinutes: number | null
  sortOrder:   number
  image:       string | null  // resolved Supabase storage URL
  city:        string | null
}

export interface UIRouteDetail extends UIRoute {
  body:  string | null
  stops: UIRouteStop[]
}