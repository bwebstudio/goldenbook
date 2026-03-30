import { redirect } from "next/navigation";
import { isBusinessClient } from "@/lib/auth/permissions";
import { requireDashboardUser } from "@/lib/auth/server";
import { fetchDestinations } from "@/lib/api/destinations";
import { fetchAdminRoutes } from "@/lib/api/routes";
import { fetchCategories } from "@/lib/api/categories";
import { fetchPlacesForCity } from "@/lib/api/places";
import DashboardContent from "./DashboardContent";

export default async function DashboardPage() {
  const currentUser = await requireDashboardUser();

  if (isBusinessClient(currentUser.role)) {
    redirect("/portal");
  }

  const [destinations, routeDTOs, categoryDTOs] = await Promise.all([
    fetchDestinations().catch(() => []),
    fetchAdminRoutes().catch(() => []),
    fetchCategories().catch(() => []),
  ]);

  const placesPerCity = await Promise.all(
    destinations.map((d) =>
      fetchPlacesForCity(d.slug).then((items) => items.length).catch(() => 0)
    )
  );
  const totalPlaces = placesPerCity.reduce((a, b) => a + b, 0);
  const publishedRoutes = routeDTOs.filter((r) => r.status === "published").length;
  const totalSubcategories = categoryDTOs.reduce((sum, cat) => sum + (cat.subcategories?.length ?? 0), 0);

  return (
    <DashboardContent
      totalPlaces={totalPlaces}
      totalCities={destinations.length}
      totalRoutes={routeDTOs.length}
      publishedRoutes={publishedRoutes}
      totalCategories={categoryDTOs.length}
      totalSubcategories={totalSubcategories}
    />
  );
}
