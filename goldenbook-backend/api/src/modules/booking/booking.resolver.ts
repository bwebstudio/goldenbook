// Simplified booking resolver.
// No affiliate logic. Three scenarios:
//   1. Place has a booking_url → show "Reserve" button
//   2. Place has a website_url → show "Reserve" button (website as fallback)
//   3. Place has phone only → contactable but no web CTA
//   4. Nothing → no button
//
// Google Maps URLs are NOT used as booking links.

import type {
  PlaceBookingInput,
  BookingCTA,
  BookingDTO,
  BookingRoutingDecision,
} from './booking.types'

// Place types where a reservation/booking button makes sense
const RESERVABLE_TYPES = new Set([
  'restaurant', 'cafe', 'bar', 'hotel', 'activity', 'venue',
])

function isHttpUrl(url: string | null): url is string {
  if (!url) return false
  const trimmed = url.trim()
  return /^https?:\/\/[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+/i.test(trimmed)
}

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

  // Non-reservable place types never show a booking button
  if (!RESERVABLE_TYPES.has(place.place_type)) {
    return base
  }

  const bookingUrl = isHttpUrl(place.booking_url) ? place.booking_url.trim() : null
  const websiteUrl = isHttpUrl(place.website_url) ? place.website_url.trim() : null

  // 1. Real booking URL — primary
  if (bookingUrl) {
    return { ...base, eligible: true, chosenProvider: 'website', reason: 'has_booking_url', ctaLabel: 'Reserve', targetUrl: bookingUrl, trackable: false }
  }

  // 2. Website URL — fallback (many venues handle reservations on their site)
  if (websiteUrl && place.reservation_relevant) {
    return { ...base, eligible: true, chosenProvider: 'website', reason: 'has_website', ctaLabel: 'Reserve', targetUrl: websiteUrl, trackable: false }
  }

  // 3. No web link available
  return base
}

export function toBookingCTA(decision: BookingRoutingDecision): BookingCTA | null {
  if (!decision.eligible || decision.chosenProvider === 'none') return null
  return {
    enabled: true,
    mode: 'direct_website',
    label: decision.ctaLabel!,
    url: decision.targetUrl,
    platform: decision.chosenProvider,
    trackable: decision.trackable,
  }
}

export function resolveBookingDTO(place: PlaceBookingInput): BookingDTO {
  const decision = resolveBookingDecision(place)
  const cta = toBookingCTA(decision)
  return { enabled: decision.eligible, cta }
}
