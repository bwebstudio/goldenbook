"use client";

import type { DashboardUser } from "@/types/auth";
import { useT } from "@/lib/i18n";
import { usePathname } from "next/navigation";

type PageInfo = { title: string; subtitle: string };

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "G";
}

export default function Header({ currentUser }: { currentUser: DashboardUser }) {
  const pathname = usePathname();
  const t = useT();

  const pages = t.employeePages as Record<string, PageInfo>;
  const roleLabels = t.roles as Record<string, string>;

  function getPageInfo(p: string): PageInfo {
    const exactMap: Record<string, string> = {
      "/dashboard": "dashboard",
      "/places": "places",
      "/places/new": "placesNew",
      "/categories": "categories",
      "/routes": "routes",
      "/routes/new": "routesNew",
      "/users": "users",
      "/settings": "settings",
      "/placement-requests": "placementRequests",
      "/review-queue": "reviewQueue",
      "/campaigns": "campaigns",
      "/campaigns/new": "campaignsNew",
    };

    if (exactMap[p] && pages[exactMap[p]]) return pages[exactMap[p]];
    if (p.startsWith("/campaigns/")) return pages.campaignsEdit ?? { title: "", subtitle: "" };
    if (p.startsWith("/places/")) return pages.placesEdit ?? { title: "", subtitle: "" };
    if (p.startsWith("/routes/")) return pages.routesEdit ?? { title: "", subtitle: "" };
    if (p.startsWith("/categories/")) return pages.categoriesEdit ?? { title: "", subtitle: "" };
    return { title: "Goldenbook", subtitle: "" };
  }

  const page = getPageInfo(pathname);

  return (
    <header className="bg-white border-b border-border px-10 py-6 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-text leading-tight">{page.title}</h1>
        {page.subtitle && <p className="text-base text-muted mt-1">{page.subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center">
          <span className="text-white font-semibold text-sm">{getInitials(currentUser.name)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-medium text-text">{currentUser.name}</span>
          <span className="text-sm text-muted">{roleLabels[currentUser.role] ?? currentUser.role}</span>
        </div>
      </div>
    </header>
  );
}
