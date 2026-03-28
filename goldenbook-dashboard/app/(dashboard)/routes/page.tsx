// Server component — fetches all routes from the admin endpoint, then hands
// off to the interactive RoutesClient.

import Link from "next/link";
import { fetchAdminRoutes } from "@/lib/api/routes";
import { fetchDestinations } from "@/lib/api/destinations";
import { mapRoutesToUI } from "@/lib/api/mappers/routeMapper";
import RoutesClient from "./RoutesClient";

export default async function RoutesPage() {
  try {
    const [routeDTOs, destinations] = await Promise.all([
      fetchAdminRoutes(),
      fetchDestinations(),
    ]);

    const routes = mapRoutesToUI(routeDTOs);
    const cities = destinations.map((d) => d.name).sort();

    return <RoutesClient routes={routes} cities={cities} />;
  } catch (err) {
    console.error("[RoutesPage] Failed to load routes:", err);
    return (
      <div className="max-w-5xl">
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">Could not load routes</h3>
            <p className="text-base text-muted mt-2 max-w-sm">
              Could not connect to the Goldenbook backend. Make sure the API is running and
              NEXT_PUBLIC_API_BASE_URL is set in .env.local.
            </p>
          </div>
          <Link
            href="/routes"
            className="px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors"
          >
            Try again
          </Link>
        </div>
      </div>
    );
  }
}