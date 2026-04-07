export const dynamic = "force-dynamic";

import PlaceGenerator from "@/components/places/PlaceGenerator";
import { fetchDestinations } from "@/lib/api/destinations";

export default async function NewPlacePage() {
  const cities = await fetchDestinations()
    .then((dests) =>
      dests
        .map((d) => ({ slug: d.slug, name: d.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
    .catch(() => [] as { slug: string; name: string }[]);

  return <PlaceGenerator cities={cities} />;
}
