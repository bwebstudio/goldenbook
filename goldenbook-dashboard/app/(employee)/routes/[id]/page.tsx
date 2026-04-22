// Server component — loads a single curated route (editorial or sponsored)
// and renders a detail view. All dashboard users can view; role-gated actions
// are delegated to the client component (admin: edit; both: deactivate).

import { notFound } from "next/navigation";
import { fetchRouteById, type CuratedRouteDTO } from "@/lib/api/curated-routes";
import { ApiError } from "@/lib/api/client";
import { requireDashboardUser } from "@/lib/auth/server";
import RouteDetailClient from "./RouteDetailClient";

export const dynamic = "force-dynamic";

interface RouteDetailPageProps {
  params: Promise<{ id: string }>;
}

async function loadRoute(id: string): Promise<CuratedRouteDTO> {
  try {
    return await fetchRouteById(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}

export default async function RouteDetailPage({ params }: RouteDetailPageProps) {
  const { id } = await params;
  const currentUser = await requireDashboardUser();
  const route = await loadRoute(id);
  return <RouteDetailClient route={route} userRole={currentUser.role} />;
}
