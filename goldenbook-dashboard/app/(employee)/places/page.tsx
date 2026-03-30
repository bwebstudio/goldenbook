// Server component — fetches real data from the backend, then renders the
// interactive PlacesClient with all data passed in as props.

import PlacesClient from "./PlacesClient";
import { fetchAdminPlacesList } from "@/lib/api/places";
import { mapAdminListItemToUI, extractCategories } from "@/lib/api/mappers/placeMapper";
import type { UIPlace } from "@/types/ui/place";

export default async function PlacesPage() {
  let places: UIPlace[] = [];
  let cities: string[] = [];
  let errorMessage: string | null = null;

  try {
    const items = await fetchAdminPlacesList();
    places = items.map(mapAdminListItemToUI);
    places.sort((a, b) => a.name.localeCompare(b.name));

    // Derive city list from the data
    const citySet = new Set(places.map(p => p.city));
    cities = [...citySet].sort();
  } catch (err) {
    console.error("[PlacesPage] Failed to load places:", err);
    errorMessage =
      "Could not connect to the Goldenbook backend. Make sure the API is running and NEXT_PUBLIC_API_BASE_URL is correct in .env.local.";
  }

  // Derive category list from the fetched places
  const categories = extractCategories(places);

  // ── Error state ─────────────────────────────────────────────────────────────
  if (errorMessage) {
    return (
      <div className="max-w-5xl">
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">Could not load places</h3>
            <p className="text-base text-muted mt-2 max-w-sm">{errorMessage}</p>
          </div>
          <a
            href="/places"
            className="px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <PlacesClient
      places={places}
      cities={cities}
      categories={categories}
    />
  );
}
