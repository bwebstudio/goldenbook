// Server component — prepares data for the new route form.

import Link from "next/link";
import { fetchDestinations } from "@/lib/api/destinations";
import { fetchPlacesForCity } from "@/lib/api/places";
import { mapMapPlaceToUI } from "@/lib/api/mappers/placeMapper";
import RouteForm from "@/components/routes/RouteForm";
import type { UIPlace } from "@/types/ui/place";

export default async function NewRoutePage() {
  // Fetch cities (non-fatal — empty list degrades gracefully in the form)
  const destinations = await fetchDestinations().catch(() => []);

  const cities = destinations
    .map((d) => ({ slug: d.slug, name: d.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Fetch all places across every city so the form has a full picker list.
  // Failures per city are silently skipped.
  const placesPerCity = await Promise.all(
    destinations.map((d) =>
      fetchPlacesForCity(d.slug)
        .then((dtos) => dtos.map(mapMapPlaceToUI))
        .catch(() => [] as UIPlace[])
    )
  );

  const seen   = new Set<string>();
  const places: UIPlace[] = [];
  for (const batch of placesPerCity) {
    for (const p of batch) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        places.push(p);
      }
    }
  }
  places.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      {/* Back nav */}
      <Link
        href="/routes"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text transition-colors w-fit"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to routes
      </Link>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-text">New route</h1>
        <p className="text-base text-muted mt-1">Create a new curated journey</p>
      </div>

      <RouteForm cities={cities} availablePlaces={places} />
    </div>
  );
}