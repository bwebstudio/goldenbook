// Server component — loads a single curated route (editorial or sponsored)
// and renders a detail view. All dashboard users can view; role-gated actions
// are delegated to the client component (admin: edit; both: deactivate).

import { notFound } from "next/navigation";
import { fetchRouteById, type CuratedRouteDTO } from "@/lib/api/curated-routes";
import { ApiError } from "@/lib/api/client";
import { requireDashboardUser } from "@/lib/auth/server";
import { getServerLocale } from "@/lib/i18n/server";
import RouteDetailClient from "./RouteDetailClient";

export const dynamic = "force-dynamic";

interface RouteDetailPageProps {
  params: Promise<{ id: string }>;
}

async function loadRoute(id: string, locale: string): Promise<CuratedRouteDTO> {
  try {
    return await fetchRouteById(id, locale);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}

export default async function RouteDetailPage({ params }: RouteDetailPageProps) {
  const { id } = await params;
  const [currentUser, locale] = await Promise.all([
    requireDashboardUser(),
    getServerLocale(),
  ]);
  const route = await loadRoute(id, locale);
  return <RouteDetailClient initialRoute={route} initialLocale={locale} id={id} userRole={currentUser.role} />;
}
