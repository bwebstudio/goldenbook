// Raw backend request/response types — match the backend DTOs exactly.
// Do NOT use these directly in UI components; use UIPlace from types/ui/place.ts instead.

export interface MediaAssetDTO {
  bucket: string | null;
  path: string | null;
}

// ── Admin write types ─────────────────────────────────────────────────────────

// Payload for POST /api/v1/admin/places (create) and PUT /api/v1/admin/places/:id (update).
// All fields optional on update except the URL param.
export type BookingMode =
  | "none"
  | "affiliate_booking"
  | "affiliate_thefork"
  | "affiliate_viator"
  | "affiliate_getyourguide"
  | "direct_website"
  | "contact_only";

export type ReservationSource = "manual" | "ai_suggested" | "imported";

export interface AdminPlacePayload {
  name?:             string;
  slug?:             string;
  shortDescription?: string;
  fullDescription?:  string;
  goldenbookNote?:   string;
  whyWeLoveIt?:      string;
  insiderTip?:       string;
  citySlug?:         string;
  addressLine?:      string;
  websiteUrl?:       string;
  phone?:            string;
  email?:            string;
  bookingUrl?:       string;
  placeType?:        string;
  categorySlug?:     string;
  subcategorySlug?:  string;
  status?:           "draft" | "published" | "archived";
  featured?:         boolean;
  // Booking fields
  bookingEnabled?:       boolean;
  bookingMode?:          BookingMode;
  bookingLabel?:         string;
  bookingNotes?:         string;
  reservationRelevant?:  boolean;
  reservationSource?:    ReservationSource;
}

// Response from POST /api/v1/admin/places and PUT /api/v1/admin/places/:id.
export interface AdminPlaceResponseDTO {
  id:       string;
  slug:     string;
  name:     string;
  status:   string;
  featured: boolean;
  citySlug: string;
}

// Response from GET /api/v1/admin/categories
export interface AdminCategoryDTO {
  id:   string;
  slug: string;
  name: string;
  subcategories: { id: string; slug: string; name: string }[];
}

export interface AdminCategoriesResponseDTO {
  items: AdminCategoryDTO[];
}

// Response from GET /api/v1/map/places?city={slug}
// This is the primary endpoint used to list places in the dashboard.
export interface MapPlaceDTO {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  placeType: string;
  categorySlugs: string[];
  cityName: string;
  heroImage: MediaAssetDTO;
}

export interface MapPlacesResponseDTO {
  items: MapPlaceDTO[];
}

// Response from GET /api/v1/admin/places
export interface AdminPlaceListItem {
  id: string;
  slug: string;
  name: string;
  city_name: string;
  category_slug: string | null;
  status: string;
  booking_enabled: boolean;
  booking_mode: string;
  reservation_relevant: boolean;
  has_suggestion: boolean;
  suggestion_relevant: boolean | null;
  suggestion_mode: string | null;
  suggestion_confidence: number | null;
  suggestion_dismissed: boolean;
  hero_bucket: string | null;
  hero_path: string | null;
}

export interface AdminPlaceListResponseDTO {
  items: AdminPlaceListItem[];
}

// Response from GET /api/v1/places/:slug
// Used for the detail/edit page.
export interface PlaceDetailDTO {
  id: string;
  slug: string;
  name: string;
  city: { slug: string; name: string };
  citySlugs?: string[];
  heroImage: MediaAssetDTO;
  rating: number | null;
  tags: string[];
  actions: {
    canSave: boolean;
    websiteUrl: string | null;
    bookingUrl: string | null;
    reservationPhone: string | null;
    navigateUrl: string | null;
  };
  booking: {
    enabled: boolean;
    cta: {
      enabled: boolean;
      mode: string;
      label: string;
      url: string | null;
      platform: string;
      trackable: boolean;
    } | null;
  };
  goldenbookNote: string | null;
  whyWeLoveIt: string | null;
  insiderTip: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  contact: {
    phone: string | null;
    email: string | null;
    website: string | null;
  };
  location: {
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  brand: { id: string; slug: string; name: string } | null;
  categories: { id: string; slug: string; name: string }[];
  subcategories: { id: string; slug: string; name: string }[];
  openingHours: {
    dayOfWeek: number;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
  }[];
  nearbyGems: {
    id: string;
    slug: string;
    name: string;
    heroImage: MediaAssetDTO;
    distanceMeters: number;
  }[];
  gallery: { bucket: string; path: string; sortOrder: number | null }[];
  otherLocations: {
    id: string;
    slug: string;
    name: string;
    cityName: string;
    heroImage: MediaAssetDTO;
  }[];
  bookingAdmin: {
    bookingEnabled: boolean;
    bookingMode: string;
    bookingLabel: string | null;
    reservationRelevant: boolean;
    reservationConfidence: number | null;
    reservationSource: string | null;
    reservationLastReviewedAt: string | null;
  };
  suggestion: {
    relevant: boolean | null;
    mode: string | null;
    label: string | null;
    url: string | null;
    confidence: number | null;
    reason: string | null;
    source: string | null;
    generatedAt: string | null;
    dismissed: boolean;
  } | null;
}
