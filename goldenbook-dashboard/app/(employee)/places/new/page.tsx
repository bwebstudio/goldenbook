import PlaceForm from "@/components/places/PlaceForm";
import { fetchDestinations } from "@/lib/api/destinations";
import { fetchAdminCategories } from "@/lib/api/places";

export default async function NewPlacePage() {
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

  return <PlaceForm cities={cities} categories={categories} />;
}
