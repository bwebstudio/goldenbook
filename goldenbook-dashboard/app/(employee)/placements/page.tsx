import { fetchAllVisibilities, type VisibilityGlobalDTO } from "@/lib/api/visibility";
import PlacementsClient from "./PlacementsClient";
import PlacementsError from "./PlacementsError";

export default async function PlacementsPage() {
  let items: VisibilityGlobalDTO[] = [];

  try {
    items = await fetchAllVisibilities();
  } catch {
    return <PlacementsError />;
  }

  const cities = [...new Set(items.map(i => i.city_name))].sort();
  const surfaces = [...new Set(items.map(i => i.surface))].sort();

  return <PlacementsClient items={items} cities={cities} surfaces={surfaces} />;
}
