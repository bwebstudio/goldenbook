export interface Destination {
  id: string;
  name: string;
  slug: string;
  country: string;
  description?: string;
  coverImage?: string;
}

export interface Place {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  destination?: Destination;
  coverImage?: string;
  coordinates?: { lat: number; lng: number };
  tags?: string[];
  isSaved?: boolean;
}

export interface Route {
  id: string;
  name: string;
  slug: string;
  description?: string;
  places?: Place[];
  coverImage?: string;
  duration?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  places?: Place[];
}

// --- Category Detail (matches backend CategoryDetailDTO exactly) ---

export interface CategoryPlaceDTO {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  heroImage: MediaAsset;
  cityName: string;
  subcategory?: string;
}

export interface SubcategoryDTO {
  slug: string;
  name: string;
}

export interface CategoryDetailDTO {
  slug: string;
  name: string;
  description: string | null;
  iconName: string | null;
  subcategories: SubcategoryDTO[];
  items: CategoryPlaceDTO[];
}

// Matches backend MapPlaceDTO exactly
export interface MapPlace {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  placeType: string;
  categorySlugs: string[];
  cityName: string;
  heroImage: MediaAsset;
}

export interface MapResponseDTO {
  items: MapPlace[];
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

// --- Saved (matches backend SavedPlaceDTO / SavedRouteDTO exactly) ---

export interface SavedPlaceDTO {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  savedAt: string;
  image: { bucket: string; path: string } | null;
}

export interface SavedRouteDTO {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  savedAt: string;
  image: { bucket: string; path: string } | null;
}

export interface SavedResponse {
  savedPlaces: SavedPlaceDTO[];
  savedRoutes: SavedRouteDTO[];
}

export interface SearchPlaceDTO {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  heroImage: MediaAsset;
}

export interface SearchRouteDTO {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  heroImage: MediaAsset;
}

export interface SearchCategoryDTO {
  id: string;
  slug: string;
  name: string;
  iconName: string | null;
}

export interface SearchResults {
  query?: string;
  places: SearchPlaceDTO[];
  routes: SearchRouteDTO[];
  categories: SearchCategoryDTO[];
}

// --- Discover (matches backend DiscoverDTO exactly) ---

export type TimeSegment = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

export interface MediaAsset {
  bucket: string | null;
  path: string | null;
}

export interface NowRecommendation {
  slug: string;
  name: string;
  image: MediaAsset;
  categorySlugs: string[];
  featured: boolean;
  timeSegment: TimeSegment;
}

export interface DiscoverPlaceCard {
  id: string;
  slug: string;
  name: string;
  heroImage: MediaAsset;
  shortDescription: string | null;
  placeType: string | null;
  cityName: string | null;
  isSponsored?: boolean;
}

export interface DiscoverCategory {
  id: string;
  slug: string;
  name: string;
  iconName: string | null;
}

export interface DiscoverRoute {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  heroImage: MediaAsset;
  placesCount: number;
}

// --- Booking CTA (matches backend BookingCTA / BookingDTO) ---

export type BookingPlatform =
  | 'booking'
  | 'thefork'
  | 'viator'
  | 'getyourguide'
  | 'website'
  | 'contact';

export interface BookingCTA {
  enabled: boolean;
  mode: string;
  label: string;
  url: string | null;
  platform: BookingPlatform;
  trackable: boolean;
}

export interface BookingDTO {
  enabled: boolean;
  cta: BookingCTA | null;
}

// --- Place Detail (matches backend PlaceDetailDTO exactly) ---

export interface PlaceDetailDTO {
  id: string;
  slug: string;
  name: string;
  city: { slug: string; name: string };
  heroImage: MediaAsset;
  rating: number | null;
  tags: string[];
  actions: {
    canSave: boolean;
    websiteUrl: string | null;
    bookingUrl: string | null;
    reservationPhone: string | null;
    navigateUrl: string | null;
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
    heroImage: MediaAsset;
    distanceMeters: number;
  }[];
  gallery: { bucket: string; path: string; sortOrder: number | null }[];
  otherLocations: {
    id: string;
    slug: string;
    name: string;
    cityName: string;
    heroImage: MediaAsset;
  }[];
  booking: BookingDTO;
}

// --- Routes (matches backend RouteCardDTO / RouteDetailDTO exactly) ---

export interface RouteCardDTO {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  routeType: string;
  estimatedMinutes: number | null;
  featured: boolean;
  heroImage: MediaAsset;
  placesCount: number;
  city: { slug: string; name: string };
}

export interface RoutesResponseDTO {
  items: RouteCardDTO[];
}

export interface RoutePlaceDTO {
  id: string;
  slug: string;
  name: string;
  note: string | null;
  stayMinutes: number | null;
  sortOrder: number;
  heroImage: MediaAsset;
  location: {
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface RouteDetailDTO {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  routeType: string;
  estimatedMinutes: number | null;
  featured: boolean;
  heroImage: MediaAsset;
  city: { slug: string; name: string };
  places: RoutePlaceDTO[];
}

export interface DiscoverResponse {
  cityHeader: {
    slug: string;
    name: string;
    country: string;
    heroImage: MediaAsset;
  };
  search: {
    placeholder: string;
  };
  nowRecommendation: NowRecommendation | null;
  editorialHero: {
    title: string;
    subtitle: string | null;
    ctaLabel: string | null;
    image: MediaAsset;
    target: { type: 'place'; slug: string };
  } | null;
  hiddenSpotsNearYou: DiscoverPlaceCard[];
  editorsPicks: DiscoverPlaceCard[];
  categories: DiscoverCategory[];
  goldenRoutes: DiscoverRoute[];
  newOnGoldenbook: DiscoverPlaceCard[];
}
