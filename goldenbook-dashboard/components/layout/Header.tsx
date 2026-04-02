"use client";

import type { DashboardUser } from "@/types/auth";
import { useT } from "@/lib/i18n";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/ui/NotificationBell";

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
    return { title: "Goldenbook Go", subtitle: "" };
  }

  const page = getPageInfo(pathname);

  return (
    <header className="bg-white border-b border-border px-4 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1 pl-10 lg:pl-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text leading-tight truncate">{page.title}</h1>
        {page.subtitle && <p className="text-sm lg:text-base text-muted mt-0.5 lg:mt-1 truncate">{page.subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <NotificationBell />
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gold flex items-center justify-center">
          <span className="text-white font-semibold text-xs sm:text-sm">{getInitials(currentUser.name)}</span>
        </div>
        <div className="hidden sm:flex flex-col">
          <span className="text-sm lg:text-base font-medium text-text">{currentUser.name}</span>
          <span className="text-xs lg:text-sm text-muted">{roleLabels[currentUser.role] ?? currentUser.role}</span>
        </div>
      </div>
    </header>
  );
}
