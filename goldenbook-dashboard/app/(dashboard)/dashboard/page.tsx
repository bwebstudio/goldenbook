// Dashboard home — fetches real counts from the backend and displays a
// summary overview alongside quick-access section cards.

import Link from "next/link";
import { isAdmin } from "@/lib/auth/permissions";
import { requireDashboardUser } from "@/lib/auth/server";
import { fetchDestinations } from "@/lib/api/destinations";
import { fetchAdminRoutes } from "@/lib/api/routes";
import { fetchCategories } from "@/lib/api/categories";
import { fetchPlacesForCity } from "@/lib/api/places";

// ─── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className="bg-white rounded-2xl border border-border shadow-sm px-7 py-6 flex flex-col gap-2 hover:border-gold/50 hover:shadow-md transition-all">
        <p className="text-sm font-semibold text-muted uppercase tracking-wide">{label}</p>
        <p className="text-4xl font-bold text-text leading-none group-hover:text-gold transition-colors">
          {value}
        </p>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
    </Link>
  );
}

// ─── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  href,
  cta,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block">
      <div className="bg-white rounded-2xl border border-border p-8 flex flex-col gap-5 shadow-sm hover:shadow-md hover:border-gold/50 transition-all h-full">
        <div className="w-14 h-14 rounded-xl bg-[#FBF7F0] flex items-center justify-center text-gold">
          {icon}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-text leading-tight group-hover:text-gold transition-colors">
            {title}
          </h2>
          <p className="text-base text-muted leading-relaxed">{description}</p>
        </div>
        <div className="mt-auto flex items-center gap-2 text-gold font-semibold text-sm">
          <span>{cta}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const currentUser = await requireDashboardUser();

  // Fetch stats in parallel — each call is non-fatal so the page always renders
  const [destinations, routeDTOs, categoryDTOs] = await Promise.all([
    fetchDestinations().catch(() => []),
    fetchAdminRoutes().catch(() => []),
    fetchCategories().catch(() => []),
  ]);

  // Count places across all cities in parallel (non-fatal per city)
  const placesPerCity = await Promise.all(
    destinations.map((d) =>
      fetchPlacesForCity(d.slug)
        .then((items) => items.length)
        .catch(() => 0)
    )
  );
  const totalPlaces = placesPerCity.reduce((a, b) => a + b, 0);

  // Derived counts
  const publishedRoutes   = routeDTOs.filter((r) => r.status === "published").length;
  const totalSubcategories = categoryDTOs.reduce(
    (sum, cat) => sum + (cat.subcategories?.length ?? 0),
    0
  );

  return (
    <div className="max-w-5xl flex flex-col gap-10">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile
          label="Places"
          value={totalPlaces}
          sub={`across ${destinations.length} ${destinations.length === 1 ? "city" : "cities"}`}
          href="/places"
        />
        <StatTile
          label="Routes"
          value={routeDTOs.length}
          sub={publishedRoutes > 0 ? `${publishedRoutes} published` : "none published yet"}
          href="/routes"
        />
        <StatTile
          label="Categories"
          value={categoryDTOs.length}
          sub={totalSubcategories > 0 ? `${totalSubcategories} subcategories` : undefined}
          href="/categories"
        />
        <StatTile
          label="Cities"
          value={destinations.length}
          sub="active destinations"
          href="/places"
        />
      </div>

      {/* ── Section cards ── */}
      <div>
        <h2 className="text-lg font-bold text-text mb-4">Manage content</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SectionCard
            title="Places"
            description="Add, edit, and publish places across all Goldenbook cities."
            href="/places"
            cta="Manage places"
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            }
          />
          <SectionCard
            title="Routes"
            description="Create curated journeys that guide users through a series of places."
            href="/routes"
            cta="Manage routes"
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          />
          <SectionCard
            title="Categories"
            description="Organise places by creating and managing content categories and subcategories."
            href="/categories"
            cta="Manage categories"
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            }
          />
          {isAdmin(currentUser.role) && (
            <SectionCard
              title="Users"
              description="View registered app users and their activity. Coming soon."
              href="/users"
              cta="View users"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              }
            />
          )}
        </div>
      </div>

    </div>
  );
}
