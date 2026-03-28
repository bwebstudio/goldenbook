// Server component — loads a single route and its stops for the edit form.

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAdminRouteById, fetchAdminRoutePlaces } from "@/lib/api/routes";
import { fetchDestinations } from "@/lib/api/destinations";
import { fetchPlacesForCity } from "@/lib/api/places";
import { mapRouteDetailToUI } from "@/lib/api/mappers/routeMapper";
import { mapMapPlaceToUI } from "@/lib/api/mappers/placeMapper";
import { ApiError } from "@/lib/api/client";
import RouteForm from "@/components/routes/RouteForm";
import type { UIPlace } from "@/types/ui/place";

interface EditRoutePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRoutePage({ params }: EditRoutePageProps) {
  const { id } = await params;

  // Fetch cities and available places (non-fatal)
  const destinations = await fetchDestinations().catch(() => []);

  const cities = destinations
    .map((d) => ({ slug: d.slug, name: d.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

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

  // Fetch the route and its stops
  try {
    const [routeDTO, placesResponse] = await Promise.all([
      fetchAdminRouteById(id),
      fetchAdminRoutePlaces(id),
    ]);

    const route = mapRouteDetailToUI(routeDTO, placesResponse.items);

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
          <h1 className="text-3xl font-bold text-text">{route.title}</h1>
          <p className="text-base text-[#B0AAA3] mt-1 font-mono">{route.slug}</p>
        </div>

        <RouteForm route={route} cities={cities} availablePlaces={places} />
      </div>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }

    return (
      <div className="max-w-3xl flex flex-col gap-8">
        <Link
          href="/routes"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text transition-colors w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to routes
        </Link>
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">Could not load route</h3>
            <p className="text-base text-muted mt-2 max-w-sm">
              This route could not be loaded. Please check the API and try again.
            </p>
          </div>
          <a
            href={`/routes/${id}`}
            className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }
}
