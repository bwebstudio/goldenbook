export type CandidateProvider = 'booking' | 'thefork' | 'viator' | 'getyourguide' | 'website'

export type CandidateType = 'exact_listing' | 'provider_search' | 'official_booking_page' | 'official_website'

export type ValidationStatus = 'pending' | 'valid' | 'invalid' | 'unreachable' | 'ambiguous'

export type CandidateSource = 'generated' | 'verified_script' | 'manual'

export interface BookingCandidate {
  id: string
  place_id: string
  provider: CandidateProvider
  candidate_url: string
  candidate_type: CandidateType
  is_valid: boolean | null
  validation_status: ValidationStatus
  validation_details: string | null
  confidence: number
  source: CandidateSource
  discovered_at: string
  last_checked_at: string | null
  notes: string | null
  is_active: boolean
  priority: number
}

export interface CandidateGenerationInput {
  id: string
  name: string
  slug: string
  city_name: string
  city_slug: string
  website_url: string | null
  category_slugs: string[]
  subcategory_slugs: string[]
}
