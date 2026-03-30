import type { DashboardRole } from "@/types/auth";

const EDITOR_ALLOWED_PREFIXES = ["/dashboard", "/places", "/categories", "/routes", "/analytics", "/users", "/review-queue", "/pricing", "/campaigns"] as const;
const BUSINESS_ALLOWED_PREFIXES = ["/portal"] as const;

export function isAdmin(role: DashboardRole | null | undefined): role is "super_admin" {
  return role === "super_admin";
}

export function isEditor(role: DashboardRole | null | undefined): role is "editor" {
  return role === "editor";
}

export function isBusinessClient(role: DashboardRole | null | undefined): role is "business_client" {
  return role === "business_client";
}

export function canAccessPath(role: DashboardRole | null | undefined, pathname: string): boolean {
  if (!role) return false;
  if (isAdmin(role)) return true;

  if (isBusinessClient(role)) {
    return BUSINESS_ALLOWED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
  }

  return EDITOR_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getRoleLabel(role: DashboardRole): string {
  if (role === "super_admin") return "Super Admin";
  if (role === "business_client") return "Business";
  return "Editor";
}
