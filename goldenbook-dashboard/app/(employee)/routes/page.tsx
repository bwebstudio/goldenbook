export const dynamic = "force-dynamic";

import RoutesClient from "./RoutesClient";
import { fetchCuratedRoutes } from "@/lib/api/curated-routes";
import type { CuratedRouteDTO } from "@/lib/api/curated-routes";
import { requireDashboardUser } from "@/lib/auth/server";
import type { DashboardRole } from "@/types/auth";

export default async function RoutesPage() {
  const currentUser = await requireDashboardUser();
  let routes: CuratedRouteDTO[] = [];
  try {
    routes = await fetchCuratedRoutes();
  } catch (err) {
    console.error("[RoutesPage] Failed to load routes:", err);
  }
  return <RoutesClient initialRoutes={routes} userRole={currentUser.role} />;
}
