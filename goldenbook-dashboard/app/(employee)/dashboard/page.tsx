import { redirect } from "next/navigation";
import { isBusinessClient } from "@/lib/auth/permissions";
import { requireDashboardUser } from "@/lib/auth/server";
import { fetchDestinations } from "@/lib/api/destinations";
import { fetchCuratedRoutes, type CuratedRouteDTO } from "@/lib/api/curated-routes";
import { fetchCategories } from "@/lib/api/categories";
import { fetchPlaceCounts } from "@/lib/api/analytics-v2";
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

  const [destinationsR, routesR, categoriesR, placeCountsR] = await Promise.allSettled([
    fetchDestinations(),
    fetchCuratedRoutes(),
    fetchCategories(),
    fetchPlaceCounts(),
  ]);

  // If every primary fetch failed the backend is effectively unreachable —
  // render a retryable error instead of a dashboard full of misleading zeros
  // (which looks like a real but empty account). Partial failures still render
  // with whatever loaded.
  if (
    destinationsR.status === "rejected" &&
    routesR.status === "rejected" &&
    categoriesR.status === "rejected" &&
    placeCountsR.status === "rejected"
  ) {
    return <LoadError />;
  }

  const destinations = destinationsR.status === "fulfilled" ? destinationsR.value : [];
  const routes = routesR.status === "fulfilled" ? routesR.value : ([] as CuratedRouteDTO[]);
  const categoryDTOs = categoriesR.status === "fulfilled" ? categoriesR.value : [];

  // One count query for every status. The tile used to sum /map/places per
  // city, which only returns published places with coordinates, capped at
  // 200 a city, and turned any failure into 0. A failure is now shown as one.
  if (placeCountsR.status === "rejected") {
    console.error("[DashboardPage] place counts fetch failed:", placeCountsR.reason);
  }
  const placeCounts = placeCountsR.status === "fulfilled" ? placeCountsR.value.totals : null;

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
      publishedPlaces={placeCounts?.published ?? null}
      draftPlaces={placeCounts?.draft ?? 0}
      totalCities={destinations.length}
      totalRoutes={activeRoutes}
      publishedRoutes={editorialActive}
      totalCategories={categoryDTOs.length}
      totalSubcategories={totalSubcategories}
    />
  );
}
