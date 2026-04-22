"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

function StatTile({ label, value, sub, href }: { label: string; value: number | string; sub?: string; href: string }) {
  return (
    <Link href={href} className="group block">
      <div className="bg-white rounded-2xl border border-border shadow-sm px-5 py-4 sm:px-7 sm:py-6 flex flex-col gap-1.5 sm:gap-2 hover:border-gold/50 hover:shadow-md transition-all">
        <p className="text-xs sm:text-sm font-semibold text-muted uppercase tracking-wide">{label}</p>
        <p className="text-2xl sm:text-4xl font-bold text-text leading-none group-hover:text-gold transition-colors">{value}</p>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
    </Link>
  );
}

function SectionCard({ title, description, href, cta, icon }: { title: string; description: string; href: string; cta: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group block">
      <div className="bg-white rounded-2xl border border-border p-5 sm:p-8 flex flex-col gap-4 sm:gap-5 shadow-sm hover:shadow-md hover:border-gold/50 transition-all h-full">
        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-[#FBF7F0] flex items-center justify-center text-gold">{icon}</div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-text leading-tight group-hover:text-gold transition-colors">{title}</h2>
          <p className="text-base text-muted leading-relaxed">{description}</p>
        </div>
        <div className="mt-auto flex items-center gap-2 text-gold font-semibold text-sm">
          <span>{cta}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </div>
      </div>
    </Link>
  );
}

interface DashboardContentProps {
  totalPlaces: number;
  totalCities: number;
  totalRoutes: number;
  publishedRoutes: number;
  totalCategories: number;
  totalSubcategories: number;
}

export default function DashboardContent({ totalPlaces, totalCities, totalRoutes, publishedRoutes, totalCategories, totalSubcategories }: DashboardContentProps) {
  const t = useT();
  const d = t.empDashboard;

  return (
    <div className="max-w-5xl flex flex-col gap-6 sm:gap-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile label={d.places} value={totalPlaces} sub={`${d.across} ${totalCities} ${totalCities === 1 ? d.city : d.citiesPlural}`} href="/places" />
        <StatTile label={d.routes} value={totalRoutes} sub={publishedRoutes > 0 ? `${publishedRoutes} ${d.editorialActive}` : d.noActiveRoutes} href="/routes" />
        <StatTile label={d.categories} value={totalCategories} sub={totalSubcategories > 0 ? `${totalSubcategories} ${d.subcategories}` : undefined} href="/categories" />
        <StatTile label={d.cities} value={totalCities} sub={d.activeDestinations} href="/places" />
      </div>

      <div>
        <h2 className="text-lg font-bold text-text mb-4">{d.manageContent}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
          <SectionCard title={d.places} description={d.placesDesc} href="/places" cta={d.managePlaces}
            icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>} />
          <SectionCard title={d.placementsLabel} description={d.placementsDesc} href="/campaigns" cta={d.viewPlacements}
            icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>} />
          <SectionCard title={d.routes} description={d.routesDesc} href="/routes" cta={d.manageRoutes}
            icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>} />
          <SectionCard title={d.analyticsLabel} description={d.analyticsDesc} href="/analytics" cta={d.viewAnalytics}
            icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>} />
        </div>
      </div>
    </div>
  );
}
