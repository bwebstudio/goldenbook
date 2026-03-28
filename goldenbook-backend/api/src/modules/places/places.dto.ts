import type { PlaceRow, CategoryRow, OpeningHourRow, GalleryRow, NearbyGemRow, OtherLocationRow } from './places.query'

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
  city: { slug: string; name: string }
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
}

export function toPlaceDetailDTO(
  place: PlaceRow,
  categories: CategoryRow[],
  openingHours: OpeningHourRow[],
  gallery: GalleryRow[],
  nearbyGems: NearbyGemRow[],
  otherLocations: OtherLocationRow[],
): PlaceDetailDTO {
  const lat = toFloat(place.latitude)
  const lon = toFloat(place.longitude)

  const navigateUrl =
    lat != null && lon != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
      : null

  const { bookingUrl, reservationPhone } = normalizeBooking(place.booking_url)

  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    city: { slug: place.city_slug, name: place.city_name },
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
  }
}
