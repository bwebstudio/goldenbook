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
import PlaceLoadError from "@/components/places/PlaceLoadError";
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

    return <PlaceLoadError slug={slug} />;
  }
}
