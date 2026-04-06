// Dashboard-friendly place shape used by PlaceCard and the places list.
// Mapped from backend API responses via lib/api/mappers/placeMapper.ts

export interface UIPlace {
  id: string;
  slug: string;
  name: string;
  /** City display name (e.g. "Lisbon") */
  city: string;
  /** Primary category display name derived from the first category slug */
  category: string;
  /** All category slugs — used for client-side category filtering */
  categorySlugs: string[];
  // NOTE: The backend does not currently expose status, featured, or editorsPick
  // on the map/list endpoint. These default to "published" / false until an
  // admin list endpoint is added.
  status: "draft" | "published" | "featured";
  address: string | null;
  featured: boolean;
  editorsPick: boolean;
  /** Full Supabase Storage URL, or null if no image is set */
  mainImage: string | null;
  // Booking/suggestion metadata for list filtering
  bookingEnabled: boolean;
  hasSuggestion: boolean;
  suggestionRelevant: boolean | null;
  suggestionMode: string | null;
  suggestionConfidence: number | null;
  suggestionDismissed: boolean;
}

import type { BookingMode, ReservationSource } from "@/types/api/place";

// Richer shape for the edit/detail page, mapped from PlaceDetailDTO
export interface UIPlaceDetail {
  id: string;
  slug: string;
  name: string;
  placeType: string;
  city: string;
  citySlug: string;
  citySlugs: string[];
  shortDescription: string | null;
  fullDescription: string | null;
  goldenbookNote: string | null;
  whyWeLoveIt: string | null;
  insiderTip: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bookingUrl: string | null;
  categories: { id: string; slug: string; name: string }[];
  subcategories: { id: string; slug: string; name: string }[];
  mainImage: string | null;
  gallery: string[];
  // Booking fields
  bookingEnabled: boolean;
  bookingMode: BookingMode;
  bookingLabel: string | null;
  bookingNotes: string | null;
  reservationRelevant: boolean;
  reservationConfidence: number | null;
  reservationSource: ReservationSource | null;
  reservationLastReviewedAt: string | null;
  // Suggestion
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
  // Auto-generated context engine fields (read-only)
  classificationAuto: { type: string; category: string; subcategory: string } | null;
  contextWindowsAuto: string[] | null;
  contextTagsAuto: string[] | null;
  momentTagsAuto: string[] | null;
}
