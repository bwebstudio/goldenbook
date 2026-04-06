// Mappers from backend API response shapes → dashboard UI shapes.
// Keep backend types and UI types strictly separate.

import type { MapPlaceDTO, PlaceDetailDTO, BookingMode, ReservationSource, AdminPlaceListItem } from "@/types/api/place";
import type { UIPlace, UIPlaceDetail } from "@/types/ui/place";
import { getStorageUrl } from "@/lib/utils/storage";

// Convert a category slug to a human-readable display name.
// e.g. "bakery-cafe" → "Bakery Cafe", "fine-dining" → "Fine Dining"
function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Map a MapPlaceDTO (from GET /api/v1/map/places?city=) to a UIPlace.
// NOTE: The map endpoint does not expose status, featured, or editorsPick.
// These are defaulted until the backend adds an admin list endpoint.
export function mapMapPlaceToUI(dto: MapPlaceDTO): UIPlace {
  const primaryCategorySlug = dto.categorySlugs[0] ?? "";

  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    city: dto.cityName,
    category: primaryCategorySlug ? slugToTitle(primaryCategorySlug) : "—",
    categorySlugs: dto.categorySlugs,
    // Default: "published" — place is visible in map so it must be active.
    // TODO: reflect real status when backend exposes it.
    status: "published",
    address: null, // map endpoint does not return address; available in PlaceDetailDTO
    featured: false, // TODO: cross-reference with discover.editorsPicks when needed
    editorsPick: false, // TODO: cross-reference with discover.editorsPicks when needed
    mainImage: getStorageUrl(dto.heroImage.bucket, dto.heroImage.path),
    bookingEnabled: false,
    hasSuggestion: false,
    suggestionRelevant: null,
    suggestionMode: null,
    suggestionConfidence: null,
    suggestionDismissed: false,
  };
}

// Map a PlaceDetailDTO (from GET /api/v1/places/:slug) to UIPlaceDetail.
// Used to populate the edit form.
export function mapPlaceDetailToUI(dto: PlaceDetailDTO): UIPlaceDetail {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    placeType: dto.placeType ?? 'restaurant',
    city: dto.city.name,
    citySlug: dto.city.slug,
    citySlugs: dto.citySlugs ?? [dto.city.slug],
    shortDescription: dto.shortDescription,
    fullDescription: dto.fullDescription,
    goldenbookNote: dto.goldenbookNote,
    whyWeLoveIt: dto.whyWeLoveIt,
    insiderTip: dto.insiderTip,
    address: dto.location.address,
    latitude: dto.location.latitude,
    longitude: dto.location.longitude,
    phone: dto.contact.phone,
    email: dto.contact.email,
    website: dto.contact.website,
    bookingUrl: dto.actions.bookingUrl,
    categories: dto.categories,
    subcategories: dto.subcategories,
    mainImage: getStorageUrl(dto.heroImage.bucket, dto.heroImage.path),
    gallery: dto.gallery
      .map((g) => getStorageUrl(g.bucket, g.path))
      .filter((url): url is string => url !== null),
    // Booking fields (from bookingAdmin)
    bookingEnabled: dto.bookingAdmin?.bookingEnabled ?? false,
    bookingMode: (dto.bookingAdmin?.bookingMode ?? "none") as BookingMode,
    bookingLabel: dto.bookingAdmin?.bookingLabel ?? null,
    bookingNotes: null, // Not exposed in detail endpoint; edit-only
    reservationRelevant: dto.bookingAdmin?.reservationRelevant ?? false,
    reservationConfidence: dto.bookingAdmin?.reservationConfidence ?? null,
    reservationSource: (dto.bookingAdmin?.reservationSource as ReservationSource) ?? null,
    reservationLastReviewedAt: dto.bookingAdmin?.reservationLastReviewedAt ?? null,
    suggestion: dto.suggestion ?? null,
    // Auto-generated context engine fields
    classificationAuto: dto.classificationAuto ?? null,
    contextWindowsAuto: dto.contextWindowsAuto ?? null,
    contextTagsAuto: dto.contextTagsAuto ?? null,
    momentTagsAuto: dto.momentTagsAuto ?? null,
  };
}

// Map an AdminPlaceListItem (from GET /api/v1/admin/places) to a UIPlace.
export function mapAdminListItemToUI(dto: AdminPlaceListItem): UIPlace {
  const catSlug = dto.category_slug ?? "";
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    city: dto.city_name,
    category: catSlug ? slugToTitle(catSlug) : "—",
    categorySlugs: catSlug ? [catSlug] : [],
    status: dto.status as UIPlace["status"],
    address: null,
    featured: false,
    editorsPick: false,
    mainImage: getStorageUrl(dto.hero_bucket, dto.hero_path),
    bookingEnabled: dto.booking_enabled,
    hasSuggestion: dto.has_suggestion,
    suggestionRelevant: dto.suggestion_relevant,
    suggestionMode: dto.suggestion_mode,
    suggestionConfidence: dto.suggestion_confidence,
    suggestionDismissed: dto.suggestion_dismissed,
  };
}

// Derive a sorted, unique list of category display names from a set of UIPlaces.
// Used to populate the category filter dropdown.
export function extractCategories(places: UIPlace[]): string[] {
  const seen = new Set<string>();
  for (const place of places) {
    for (const slug of place.categorySlugs) {
      seen.add(slugToTitle(slug));
    }
  }
  return Array.from(seen).sort();
}
