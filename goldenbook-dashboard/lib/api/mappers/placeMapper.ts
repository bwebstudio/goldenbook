// Mappers from backend API response shapes → dashboard UI shapes.
// Keep backend types and UI types strictly separate.

import type { MapPlaceDTO, PlaceDetailDTO } from "@/types/api/place";
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
  };
}

// Map a PlaceDetailDTO (from GET /api/v1/places/:slug) to UIPlaceDetail.
// Used to populate the edit form.
export function mapPlaceDetailToUI(dto: PlaceDetailDTO): UIPlaceDetail {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    city: dto.city.name,
    citySlug: dto.city.slug,
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
