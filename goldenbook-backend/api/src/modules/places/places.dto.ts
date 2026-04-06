import type { PlaceRow, CategoryRow, OpeningHourRow, GalleryRow, NearbyGemRow, OtherLocationRow } from './places.query'
import type { BookingDTO, BookingMode, PlaceBookingInput } from '../booking/booking.types'
import { resolveBookingDTO } from '../booking/booking.resolver'

interface MediaAssetDTO { bucket: string | null; path: string | null }

// ─── Booking URL normalization ────────────────────────────────────────────────

const PHONE_RE = /^(\+?[\d\s\-().]{6,})$|^tel:/i

interface NormalizedBooking {
  bookingUrl: string | null
  reservationPhone: string | null
}

function normalizeBooking(raw: string | null): NormalizedBooking {
  if (!raw) return { bookingUrl: null, reservationPhone: null }

  const trimmed = raw.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    return { bookingUrl: trimmed, reservationPhone: null }
  }

  if (PHONE_RE.test(trimmed)) {
    // Strip leading "tel:" if present
    return { bookingUrl: null, reservationPhone: trimmed.replace(/^tel:/i, '').trim() }
  }

  // Unknown format — discard rather than forward garbage
  return { bookingUrl: null, reservationPhone: null }
}

// ─── Coordinate coercion ──────────────────────────────────────────────────────
// pg returns numeric(9,6) as string — coerce to number | null

function toFloat(val: unknown): number | null {
  if (val == null) return null
  const n = typeof val === 'string' ? parseFloat(val) : Number(val)
  return isFinite(n) ? n : null
}

export interface PlaceDetailDTO {
  id: string
  slug: string
  name: string
  placeType: string
  city: { slug: string; name: string }
  citySlugs: string[]
  heroImage: MediaAssetDTO
  rating: number | null
  tags: string[]
  actions: {
    canSave: boolean
    websiteUrl: string | null
    bookingUrl: string | null
    reservationPhone: string | null
    navigateUrl: string | null
  }
  goldenbookNote: string | null
  whyWeLoveIt: string | null
  insiderTip: string | null
  shortDescription: string | null
  fullDescription: string | null
  contact: {
    phone: string | null
    email: string | null
    website: string | null
  }
  location: {
    address: string | null
    latitude: number | null
    longitude: number | null
  }
  brand: { id: string; slug: string; name: string } | null
  categories: { id: string; slug: string; name: string }[]
  subcategories: { id: string; slug: string; name: string }[]
  openingHours: {
    dayOfWeek: number
    opensAt: string | null
    closesAt: string | null
    isClosed: boolean
  }[]
  nearbyGems: {
    id: string
    slug: string
    name: string
    heroImage: MediaAssetDTO
    distanceMeters: number
  }[]
  gallery: { bucket: string; path: string; sortOrder: number | null }[]
  otherLocations: {
    id: string
    slug: string
    name: string
    cityName: string
    heroImage: MediaAssetDTO
  }[]
  booking: BookingDTO
  // Raw booking fields for admin/editorial use
  bookingAdmin: {
    bookingEnabled: boolean
    bookingMode: string
    bookingLabel: string | null
    reservationRelevant: boolean
    reservationConfidence: number | null
    reservationSource: string | null
    reservationLastReviewedAt: string | null
  }
  // Suggestion data for editorial review
  suggestion: {
    relevant: boolean | null
    mode: string | null
    label: string | null
    url: string | null
    confidence: number | null
    reason: string | null
    source: string | null
    generatedAt: string | null
    dismissed: boolean
  } | null
  // Auto-generated context engine fields (read-only)
  classificationAuto: { type: string; category: string; subcategory: string } | null
  contextWindowsAuto: string[] | null
  contextTagsAuto: string[] | null
  momentTagsAuto: string[] | null
}

export function toPlaceDetailDTO(
  place: PlaceRow,
  categories: CategoryRow[],
  openingHours: OpeningHourRow[],
  gallery: GalleryRow[],
  nearbyGems: NearbyGemRow[],
  otherLocations: OtherLocationRow[],
  citySlugs?: string[],
): PlaceDetailDTO {
  const lat = toFloat(place.latitude)
  const lon = toFloat(place.longitude)

  const navigateUrl =
    lat != null && lon != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
      : null

  const { bookingUrl, reservationPhone } = normalizeBooking(place.booking_url)

  // Build booking input for the resolver
  const bookingInput: PlaceBookingInput = {
    id: place.id,
    booking_enabled: place.booking_enabled,
    booking_mode: (place.booking_mode ?? 'none') as BookingMode,
    booking_url: place.booking_url,
    booking_label: place.booking_label,
    website_url: place.website_url,
    phone: place.phone,
    reservation_relevant: place.reservation_relevant,
    category_slugs: categories.filter(c => c.type === 'category').map(c => c.slug),
    subcategory_slugs: categories.filter(c => c.type === 'subcategory').map(c => c.slug),
  }
  const booking = resolveBookingDTO(bookingInput)

  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    placeType: place.place_type ?? 'restaurant',
    city: { slug: place.city_slug, name: place.city_name },
    citySlugs: citySlugs ?? [place.city_slug],
    heroImage: { bucket: place.hero_bucket, path: place.hero_path },
    rating: place.popularity_score,
    tags: [],
    actions: {
      canSave: true,
      websiteUrl: place.website_url,
      bookingUrl,
      reservationPhone,
      navigateUrl,
    },
    goldenbookNote: place.goldenbook_note,
    whyWeLoveIt: place.why_we_love_it,
    insiderTip: place.insider_tip,
    shortDescription: place.short_description,
    fullDescription: place.full_description,
    contact: {
      phone: place.phone,
      email: place.email,
      website: place.website_url,
    },
    location: {
      address: place.address_line,
      latitude: lat,
      longitude: lon,
    },
    brand: place.brand_id
      ? { id: place.brand_id, slug: place.brand_slug!, name: place.brand_name! }
      : null,
    categories: categories
      .filter((c) => c.type === 'category')
      .map(({ id, slug, name }) => ({ id, slug, name })),
    subcategories: categories
      .filter((c) => c.type === 'subcategory')
      .map(({ id, slug, name }) => ({ id, slug, name })),
    openingHours: openingHours.map((h) => ({
      dayOfWeek: h.day_of_week,
      opensAt: h.opens_at,
      closesAt: h.closes_at,
      isClosed: h.is_closed,
    })),
    nearbyGems: nearbyGems.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      heroImage: { bucket: g.hero_bucket, path: g.hero_path },
      distanceMeters: Math.round(g.distance_m),
    })),
    gallery: gallery.map((g) => ({
      bucket: g.bucket,
      path: g.path,
      sortOrder: g.sort_order,
    })),
    otherLocations: otherLocations.map((l) => ({
      id: l.id,
      slug: l.slug,
      name: l.name,
      cityName: l.city_name,
      heroImage: { bucket: l.hero_bucket, path: l.hero_path },
    })),
    booking,
    bookingAdmin: {
      bookingEnabled: place.booking_enabled,
      bookingMode: place.booking_mode ?? 'none',
      bookingLabel: place.booking_label,
      reservationRelevant: place.reservation_relevant,
      reservationConfidence: place.reservation_confidence != null
        ? Number(place.reservation_confidence)
        : null,
      reservationSource: place.reservation_source,
      reservationLastReviewedAt: place.reservation_last_reviewed_at,
    },
    suggestion: place.suggestion_generated_at
      ? {
          relevant: place.suggestion_relevant,
          mode: place.suggestion_mode,
          label: place.suggestion_label,
          url: place.suggestion_url,
          confidence: place.suggestion_confidence != null
            ? Number(place.suggestion_confidence)
            : null,
          reason: place.suggestion_reason,
          source: place.suggestion_source,
          generatedAt: place.suggestion_generated_at,
          dismissed: place.suggestion_dismissed,
        }
      : null,
    // Auto-generated context engine fields
    classificationAuto: place.classification_auto as PlaceDetailDTO['classificationAuto'] ?? null,
    contextWindowsAuto: place.context_windows_auto as string[] ?? null,
    contextTagsAuto: place.context_tags_auto as string[] ?? null,
    momentTagsAuto: place.moment_tags_auto as string[] ?? null,
  }
}
