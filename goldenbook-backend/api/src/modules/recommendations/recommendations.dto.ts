import { z } from 'zod'

// ─── Request ──────────────────────────────────────────────────────────────

export const recommendRequestSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM format').optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  city: z.string().min(1),
  intent: z.string().optional(),           // dinner, sunset, culture, shopping, etc.
  budget: z.enum(['€', '€€', '€€€', '€€€€']).optional(),
  category: z.string().optional(),         // gastronomy, culture, natureza-outdoor, etc.
  locale: z.string().default('pt'),
  limit: z.number().int().min(1).max(30).default(12),
  surface: z.enum(['now', 'concierge', 'default']).default('default'),
  debug: z.boolean().default(false),
})

export type RecommendRequest = z.infer<typeof recommendRequestSchema>

// ─── Internal candidate ───────────────────────────────────────────────────

export interface RankCandidate {
  id: string
  slug: string
  name: string
  place_type: string
  city_slug: string
  city_name: string
  latitude: number | null
  longitude: number | null
  price_tier: number | null
  google_rating: number | null
  featured: boolean
  hero_bucket: string | null
  hero_path: string | null
  short_description: string | null
  classification_auto: { type: string; category: string; subcategory: string } | null
  context_windows_auto: string[] | null
  context_tags_auto: string[] | null
  moment_tags_auto: string[] | null
}

// ─── Scored result ────────────────────────────────────────────────────────

export interface ScoredPlace {
  id: string
  slug: string
  name: string
  placeType: string
  category: string | null
  subcategory: string | null
  heroImage: { bucket: string | null; path: string | null }
  shortDescription: string | null
  score: number
  reason: string[]
  distance: number | null
  priceLevel: number | null
  googleRating: number | null
}

export interface ScoringBreakdown {
  placeId: string
  name: string
  momentScore: number
  distanceScore: number
  qualityScore: number
  editorialScore: number
  diversityAdjustment: number
  totalScore: number
  matchedMoments: string[]
  distance: number | null
}

// ─── Response ─────────────────────────────────────────────────────────────

export interface RecommendResponse {
  results: ScoredPlace[]
  meta: {
    city: string
    window: string
    intent: string | null
    candidatesTotal: number
    candidatesFiltered: number
    timing: number
  }
  debug?: ScoringBreakdown[]
}
