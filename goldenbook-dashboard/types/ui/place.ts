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
}

// Richer shape for the edit/detail page, mapped from PlaceDetailDTO
export interface UIPlaceDetail {
  id: string;
  slug: string;
  name: string;
  city: string;
  citySlug: string;
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
}
