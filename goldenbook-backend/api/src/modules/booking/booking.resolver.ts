// Central booking decision engine.
// Single source of truth for whether a place should show a booking CTA.
//
// Current strategy (v2 — Google Maps first):
//   1. Place type determines if the reservation button is shown at all
//   2. Google Maps URL is the primary booking link
//   3. Fallback: place website or social media
//   4. Manual override (affiliate links) takes priority when set
//   5. Later: affiliate links will replace Google Maps as the primary source

import type {
  PlaceBookingInput,
  BookingCTA,
  BookingDTO,
  BookingRoutingDecision,
  BookingPlatform,
  BookingMode,
} from './booking.types'

const MODE_TO_PLATFORM: Record<BookingMode, BookingPlatform | null> = {
  none:                     null,
  affiliate_booking:        'booking',
  affiliate_thefork:        'thefork',
  affiliate_viator:         'viator',
  affiliate_getyourguide:   'getyourguide',
  direct_website:           'website',
  contact_only:             'contact',
}

// Place types where a reservation/booking button makes sense
const RESERVABLE_TYPES = new Set([
  'restaurant', 'cafe', 'bar', 'hotel', 'activity', 'venue',
])

function isHttpUrl(url: string | null): url is string {
  if (!url) return false
  const trimmed = url.trim()
  // Must be a real URL with a valid domain (at least one dot or localhost)
  // Rejects garbage like "https://–" or "https://-"
  return /^https?:\/\/[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+/i.test(trimmed)
    || /^https?:\/\/localhost/i.test(trimmed)
}

// ─── Resolver ────────────────────────────────────────────────────────────────
// Priority:
//   1. If place_type is not reservable → not eligible (no button)
//   2. Manual affiliate override (booking_enabled + affiliate mode) → affiliate link
//   3. Google Maps URL → "Reserve" button opens Maps
//   4. Website URL → "Reserve" button opens website
//   5. Not eligible (no usable link found)

export function resolveBookingDecision(place: PlaceBookingInput): BookingRoutingDecision {
  const base: BookingRoutingDecision = {
    placeId: place.id,
    eligible: false,
    chosenProvider: 'none',
    reason: 'not_reservation_relevant',
    ctaLabel: null,
    targetUrl: null,
    trackable: false,
  }

  // 1. Place type gate — non-reservable types never show a button
  if (!RESERVABLE_TYPES.has(place.place_type)) {
    return base
  }

  const googleMapsUrl = isHttpUrl(place.google_maps_url) ? place.google_maps_url.trim() : null
  const bookingUrl = isHttpUrl(place.booking_url) ? place.booking_url.trim() : null
  const websiteUrl = isHttpUrl(place.website_url) ? place.website_url.trim() : null

  // 2. Manual affiliate override — takes priority when explicitly set
  if (place.booking_enabled && place.booking_mode !== 'none' && place.booking_mode !== 'direct_website') {
    const platform = MODE_TO_PLATFORM[place.booking_mode]
    const affiliateUrl = bookingUrl || websiteUrl
    if (platform && affiliateUrl) {
      return { ...base, eligible: true, chosenProvider: platform, reason: 'manual_override', ctaLabel: 'Reserve', targetUrl: affiliateUrl, trackable: place.booking_mode.startsWith('affiliate_') }
    }
  }

  // 3. Place website — primary reservation link (most venues handle reservations on their site)
  if (websiteUrl) {
    return { ...base, eligible: true, chosenProvider: 'website', reason: 'category_match', ctaLabel: 'Reserve', targetUrl: websiteUrl, trackable: false }
  }

  // 4. Fallback: Google Maps URL (user can find contact info / reserve through Maps)
  if (googleMapsUrl) {
    return { ...base, eligible: true, chosenProvider: 'website', reason: 'fallback_to_website', ctaLabel: 'Reserve', targetUrl: googleMapsUrl, trackable: false }
  }

  // 5. No usable link — button not shown
  return base
}

export function toBookingCTA(decision: BookingRoutingDecision): BookingCTA | null {
  if (!decision.eligible || decision.chosenProvider === 'none') return null
  return {
    enabled: true,
    mode: platformToMode(decision.chosenProvider),
    label: decision.ctaLabel!,
    url: decision.targetUrl,
    platform: decision.chosenProvider,
    trackable: decision.trackable,
  }
}

function platformToMode(platform: BookingPlatform): BookingMode {
  switch (platform) {
    case 'booking':      return 'affiliate_booking'
    case 'thefork':      return 'affiliate_thefork'
    case 'viator':       return 'affiliate_viator'
    case 'getyourguide': return 'affiliate_getyourguide'
    case 'website':      return 'direct_website'
    case 'contact':      return 'contact_only'
  }
}

export function resolveBookingDTO(place: PlaceBookingInput): BookingDTO {
  const decision = resolveBookingDecision(place)
  const cta = toBookingCTA(decision)
  return { enabled: decision.eligible, cta }
}
