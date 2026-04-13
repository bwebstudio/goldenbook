// ─── Booking Mode ────────────────────────────────────────────────────────────
// Matches the DB enum `booking_mode`.
// The enum in the DB still has affiliate_* values for historical data,
// but the active system only uses these three:

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

export type BookingPlatform = 'website' | 'contact'

export interface BookingCTA {
  enabled: boolean
  mode: string
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

// ─── Internal decision type ─────────────────────────────────────────────────

export type BookingRoutingReason =
  | 'has_booking_url'
  | 'has_website'
  | 'has_phone'
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
  place_type: string
  booking_enabled: boolean
  booking_mode: BookingMode
  booking_url: string | null
  booking_label: string | null
  website_url: string | null
  google_maps_url: string | null
  phone: string | null
  reservation_relevant: boolean
  category_slugs: string[]
  subcategory_slugs: string[]
}
