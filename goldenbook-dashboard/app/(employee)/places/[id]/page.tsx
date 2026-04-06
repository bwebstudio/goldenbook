// The route param is named [id] but we treat it as a slug — the backend
// only exposes GET /api/v1/places/:slug (no numeric ID endpoint exists).
// PlaceCard links use place.slug so the param received here is always a slug.

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { fetchPlaceBySlug, fetchAdminCategories } from "@/lib/api/places";
import { fetchDestinations } from "@/lib/api/destinations";
import { mapPlaceDetailToUI } from "@/lib/api/mappers/placeMapper";
import { ApiError } from "@/lib/api/client";
import PlaceForm from "@/components/places/PlaceForm";
import { requireDashboardUser } from "@/lib/auth/server";

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = await params;
  const currentUser = await requireDashboardUser();

  // Fetch cities and full category tree in parallel, both non-fatal
  const [cities, categories] = await Promise.all([
    fetchDestinations()
      .then((dests) =>
        dests
          .map((d) => ({ slug: d.slug, name: d.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      .catch(() => [] as { slug: string; name: string }[]),

    fetchAdminCategories('pt')
      .then((cats) =>
        cats
          .map((c) => ({
            slug: c.slug,
            name: c.name,
            subcategories: c.subcategories,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      .catch(() => [] as { slug: string; name: string; subcategories: { slug: string; name: string }[] }[]),
  ]);

  try {
    const placeDetail = await fetchPlaceBySlug(slug);
    const place = mapPlaceDetailToUI(placeDetail);

    return (
      <PlaceForm
        place={place}
        cities={cities}
        categories={categories}
        userRole={currentUser.role}
      />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }

    return (
      <div className="max-w-3xl">
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">Could not load place</h3>
            <p className="text-base text-muted mt-2 max-w-sm">
              The place &ldquo;{slug}&rdquo; could not be loaded from the backend. Please check the API and try again.
            </p>
          </div>
          <a
            href="/places"
            className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white"
          >
            Back to places
          </a>
        </div>
      </div>
    );
  }
}
