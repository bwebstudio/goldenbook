// ─── Booking Mode ────────────────────────────────────────────────────────────
// Matches the DB enum `booking_mode`

export type BookingMode =
  | 'none'
  | 'affiliate_booking'
  | 'affiliate_thefork'
  | 'affiliate_viator'
  | 'affiliate_getyourguide'
  | 'direct_website'
  | 'contact_only'

export type ReservationSource = 'manual' | 'ai_suggested' | 'imported'

// ─── Booking CTA ─────────────────────────────────────────────────────────────
// What the app renders for a place's booking action

export type BookingPlatform =
  | 'booking'
  | 'thefork'
  | 'viator'
  | 'getyourguide'
  | 'website'
  | 'contact'

export interface BookingCTA {
  enabled: boolean
  mode: BookingMode
  label: string
  url: string | null
  platform: BookingPlatform
  trackable: boolean
}

// ─── Booking DTO ─────────────────────────────────────────────────────────────
// Embedded in the PlaceDetailDTO response

export interface BookingDTO {
  enabled: boolean
  cta: BookingCTA | null
}

// ─── Smart Booking Router ────────────────────────────────────────────────────
// Internal decision type — not exposed to clients directly

export type BookingRoutingReason =
  | 'manual_override'
  | 'explicit_none'
  | 'category_match'
  | 'has_affiliate_url'
  | 'fallback_to_website'
  | 'not_reservation_relevant'

export interface BookingRoutingDecision {
  placeId: string
  eligible: boolean
  chosenProvider: BookingPlatform | 'none'
  reason: BookingRoutingReason
  ctaLabel: string | null
  targetUrl: string | null
  trackable: boolean
}

// ─── Place Booking Data ──────────────────────────────────────────────────────
// Subset of place fields needed by the booking resolver

export interface PlaceBookingInput {
  id: string
  booking_enabled: boolean
  booking_mode: BookingMode
  booking_url: string | null
  booking_label: string | null
  website_url: string | null
  phone: string | null
  reservation_relevant: boolean
  // Category/subcategory slugs for heuristic inference
  category_slugs: string[]
  subcategory_slugs: string[]
}
