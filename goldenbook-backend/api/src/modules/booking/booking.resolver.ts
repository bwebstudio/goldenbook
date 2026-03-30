// Central booking decision engine.
// Single source of truth for whether a place should show a booking CTA.

import type {
  PlaceBookingInput,
  BookingCTA,
  BookingDTO,
  BookingRoutingDecision,
  BookingPlatform,
  BookingMode,
} from './booking.types'
import { inferBookingMode } from './booking.heuristics'

const MODE_TO_PLATFORM: Record<BookingMode, BookingPlatform | null> = {
  none:                     null,
  affiliate_booking:        'booking',
  affiliate_thefork:        'thefork',
  affiliate_viator:         'viator',
  affiliate_getyourguide:   'getyourguide',
  direct_website:           'website',
  contact_only:             'contact',
}

function isHttpUrl(url: string | null): url is string {
  if (!url) return false
  return /^https?:\/\/[^\s@]+/i.test(url.trim())
}

// ─── Resolver ────────────────────────────────────────────────────────────────
// Priority:
//   1. Manual override (booking_enabled + booking_mode explicitly set)
//   2. Valid booking_url + category heuristic → affiliate CTA
//   3. Valid booking_url without category match → website CTA
//   4. Category says reservable + has website_url → website CTA
//   5. Not eligible

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

  const bookingUrl = isHttpUrl(place.booking_url) ? place.booking_url.trim() : null
  const websiteUrl = isHttpUrl(place.website_url) ? place.website_url.trim() : null
  const bestUrl = bookingUrl || websiteUrl

  // 1. Manual override
  if (place.booking_enabled && place.booking_mode !== 'none') {
    const platform = MODE_TO_PLATFORM[place.booking_mode]
    if (platform && bestUrl) {
      return { ...base, eligible: true, chosenProvider: platform, reason: 'manual_override', ctaLabel: 'Reserve', targetUrl: bestUrl, trackable: place.booking_mode.startsWith('affiliate_') }
    }
  }

  // 2–4. Category heuristic — works with or without booking_url
  const inferredMode = inferBookingMode(place.category_slugs, place.subcategory_slugs)

  if (inferredMode && inferredMode !== 'none' && bestUrl) {
    const platform = MODE_TO_PLATFORM[inferredMode]
    if (platform) {
      return { ...base, eligible: true, chosenProvider: platform, reason: 'category_match', ctaLabel: 'Reserve', targetUrl: bestUrl, trackable: false }
    }
  }

  // 5. Has a valid URL but no category match — show generic reserve
  if (bookingUrl) {
    return { ...base, eligible: true, chosenProvider: 'website', reason: 'fallback_to_website', ctaLabel: 'Reserve', targetUrl: bookingUrl, trackable: false }
  }

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
