import { redirect } from "next/navigation";
import { isBusinessClient } from "@/lib/auth/permissions";
import { requireDashboardUser } from "@/lib/auth/server";
import { fetchDestinations } from "@/lib/api/destinations";
import { fetchCuratedRoutes, type CuratedRouteDTO } from "@/lib/api/curated-routes";
import { fetchCategories } from "@/lib/api/categories";
import { fetchPlacesForCity } from "@/lib/api/places";
import DashboardContent from "./DashboardContent";
import LoadError from "@/components/ui/LoadError";

export const dynamic = "force-dynamic";

// Routes in the dashboard summary follow the same definition as the /routes list:
// "active" means `is_active = true` AND not expired. Any other state (inactive,
// expired, scheduled, archived) is excluded.
function isActiveRoute(route: CuratedRouteDTO): boolean {
  if (!route.isActive) return false;
  if (!route.expiresAt) return true;
  return new Date(route.expiresAt) > new Date();
}

export default async function DashboardPage() {
  const currentUser = await requireDashboardUser();

  if (isBusinessClient(currentUser.role)) {
    redirect("/portal");
  }

  const [destinationsR, routesR, categoriesR] = await Promise.allSettled([
    fetchDestinations(),
    fetchCuratedRoutes(),
    fetchCategories(),
  ]);

  // If every primary fetch failed the backend is effectively unreachable —
  // render a retryable error instead of a dashboard full of misleading zeros
  // (which looks like a real but empty account). Partial failures still render
  // with whatever loaded.
  if (
    destinationsR.status === "rejected" &&
    routesR.status === "rejected" &&
    categoriesR.status === "rejected"
  ) {
    return <LoadError />;
  }

  const destinations = destinationsR.status === "fulfilled" ? destinationsR.value : [];
  const routes = routesR.status === "fulfilled" ? routesR.value : ([] as CuratedRouteDTO[]);
  const categoryDTOs = categoriesR.status === "fulfilled" ? categoriesR.value : [];

  const placesPerCity = await Promise.all(
    destinations.map((d) =>
      fetchPlacesForCity(d.slug).then((items) => items.length).catch(() => 0)
    )
  );
  const totalPlaces = placesPerCity.reduce((a, b) => a + b, 0);

  const activeRoutes = routes.filter(isActiveRoute).length;
  const editorialActive = routes.filter(
    (r) => isActiveRoute(r) && r.routeType === "editorial",
  ).length;

  const totalSubcategories = categoryDTOs.reduce(
    (sum, cat) => sum + (cat.subcategories?.length ?? 0),
    0,
  );

  return (
    <DashboardContent
      totalPlaces={totalPlaces}
      totalCities={destinations.length}
      totalRoutes={activeRoutes}
      publishedRoutes={editorialActive}
      totalCategories={categoryDTOs.length}
      totalSubcategories={totalSubcategories}
    />
  );
}
