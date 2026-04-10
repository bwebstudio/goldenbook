// ─── Shared Scoring Types ────────────────────────────────────────────────────
//
// Unified types used by both NOW and Concierge scoring pipelines.
// Single source of truth for candidate shape, weights, and scored results.

export type NowTimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening' | 'late_evening' | 'deep_night' | 'night'
// night = legacy alias (22:00-23:00 gap), late_evening = 23:00-02:00, deep_night = 02:00-07:00
export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'hot' | 'cold'

// ─── Unified candidate (superset of NOW + Concierge fields) ─────────────────

export interface UnifiedCandidate {
  id: string
  slug: string
  name: string
  city_slug: string
  city_name: string
  place_type: string
  short_description: string | null
  editorial_summary: string | null
  featured: boolean
  popularity_score: number | null
  hero_bucket: string | null
  hero_path: string | null
  created_at: Date
  latitude: number | null
  longitude: number | null
  distance_meters: number | null
  category_slugs: string[]
  // Contact / booking fields
  website_url: string | null
  booking_url: string | null
  phone: string | null
  google_maps_url: string | null
  // Context tags (from place_now_tags / now_context_tags)
  context_tag_slugs: string[]
  context_tag_max_weight: number
  // NOW editorial fields
  now_enabled: boolean
  now_priority: number
  now_featured: boolean
  now_time_window_match: boolean
}

// ─── Scoring weights ────────────────────────────────────────────────────────

export interface ScoringWeights {
  commercial: number
  context:    number
  editorial:  number
  quality:    number
  proximity:  number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  commercial: 0.15,
  context:    0.30,
  editorial:  0.15,
  quality:    0.25,
  proximity:  0.15,
}

export const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS) as (keyof ScoringWeights)[]

// ─── Score breakdown ────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  commercial: { raw: number; weighted: number }
  context:    { raw: number; weighted: number }
  editorial:  { raw: number; weighted: number }
  quality:    { raw: number; weighted: number }
  proximity:  { raw: number; weighted: number }
}

// ─── Scored result ──────────────────────────────────────────────────────────

export interface ScoredCandidate {
  place: UnifiedCandidate
  totalScore: number
  commercialScore: number
  contextScore: number
  editorialScore: number
  qualityScore: number
  proximityScore: number
  bestTag: string | null
  isSponsored: boolean
  breakdown: ScoreBreakdown
}

// ─── Scoring context (passed into the pipeline) ─────────────────────────────

export interface ScoringContext {
  timeOfDay: NowTimeOfDay
  weather?: WeatherCondition
  paidPlaceIds: Set<string>
  excludeIds: Set<string>
  weights: ScoringWeights
  surface: 'now' | 'concierge'
  /** Concierge intent tags for context overlap scoring */
  intentTags?: string[]
  /** User onboarding interests (fine-dining, wine, culture, etc.) */
  userInterests?: string[]
  /** User exploration style (solo, couple, friends, family) */
  userStyle?: string
}
