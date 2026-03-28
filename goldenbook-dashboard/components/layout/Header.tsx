"use client";

import { getRoleLabel } from "@/lib/auth/permissions";
import type { DashboardUser } from "@/types/auth";
import { usePathname } from "next/navigation";

type PageInfo = { title: string; subtitle: string };

const exactTitles: Record<string, PageInfo> = {
  "/dashboard": {
    title: "Welcome back",
    subtitle: "Here is an overview of your content",
  },
  "/places": {
    title: "Places",
    subtitle: "Manage all places in Goldenbook",
  },
  "/places/new": {
    title: "Add New Place",
    subtitle: "Fill in the details below and save when ready",
  },
  "/categories": {
    title: "Categories",
    subtitle: "Manage content categories",
  },
  "/routes": {
    title: "Routes",
    subtitle: "Manage curated journeys and experiences",
  },
  "/routes/new": {
    title: "New route",
    subtitle: "Set up a new curated journey",
  },
  "/users": {
    title: "Users",
    subtitle: "Manage registered users",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Configure your dashboard preferences",
  },
};

function getPageInfo(pathname: string): PageInfo {
  // Exact match first
  if (exactTitles[pathname]) return exactTitles[pathname];

  // Sub-route patterns
  if (pathname.startsWith("/places/")) {
    return { title: "Edit Place", subtitle: "Update the details and save when ready" };
  }
  if (pathname.startsWith("/routes/")) {
    return { title: "Edit route", subtitle: "Update this route and its stops" };
  }
  if (pathname.startsWith("/categories/")) {
    return { title: "Edit category", subtitle: "Update name, structure, and visibility" };
  }

  return { title: "Goldenbook", subtitle: "" };
}

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
  const page = getPageInfo(pathname);

  return (
    <header className="bg-white border-b border-border px-10 py-6 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-text leading-tight">
          {page.title}
        </h1>
        {page.subtitle && (
          <p className="text-base text-muted mt-1">{page.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center">
          <span className="text-white font-semibold text-sm">{getInitials(currentUser.name)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-medium text-text">{currentUser.name}</span>
          <span className="text-sm text-muted">{getRoleLabel(currentUser.role)}</span>
        </div>
      </div>
    </header>
  );
}
