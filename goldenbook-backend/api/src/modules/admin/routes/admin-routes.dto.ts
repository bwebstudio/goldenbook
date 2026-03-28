import { z } from 'zod'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// ─── Create schema ─────────────────────────────────────────────────────────────

export const createRouteSchema = z.object({
  title:            z.string().min(2, 'Title must be at least 2 characters'),
  slug:             z
    .string()
    .min(1, 'Slug is required')
    .regex(SLUG_RE, 'Slug must be lowercase letters, numbers, and hyphens only'),
  summary:          z.string().optional(),
  body:             z.string().optional(),
  citySlug:         z.string().min(1, 'City is required'),
  routeType:        z.string().min(1).default('walking'),
  estimatedMinutes: z.coerce.number().int().min(0).optional(),
  featured:         z.boolean().default(false),
  status:           z.enum(['draft', 'published', 'archived']).default('draft'),
})

// ─── Update schema ─────────────────────────────────────────────────────────────

export const updateRouteSchema = z.object({
  title:            z.string().min(2).optional(),
  slug:             z.string().regex(SLUG_RE).optional(),
  summary:          z.string().optional(),
  body:             z.string().optional(),
  citySlug:         z.string().min(1).optional(),
  routeType:        z.string().min(1).optional(),
  estimatedMinutes: z.coerce.number().int().min(0).optional(),
  featured:         z.boolean().optional(),
  status:           z.enum(['draft', 'published', 'archived']).optional(),
})

// ─── Set places schema ─────────────────────────────────────────────────────────
// Replaces all route stops at once.

export const setRoutePlacesSchema = z.object({
  places: z.array(
    z.object({
      placeId:      z.string().uuid(),
      sortOrder:    z.number().int().min(0),
      note:         z.string().optional(),
      stayMinutes:  z.number().int().min(0).optional(),
    }),
  ),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

export type CreateRouteInput    = z.infer<typeof createRouteSchema>
export type UpdateRouteInput    = z.infer<typeof updateRouteSchema>
export type SetRoutePlacesInput = z.infer<typeof setRoutePlacesSchema>

// ─── Response DTOs ─────────────────────────────────────────────────────────────

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