import type { DashboardRole } from "@/types/auth";

const EDITOR_ALLOWED_PREFIXES = ["/dashboard", "/places", "/categories", "/routes"] as const;

export function isAdmin(role: DashboardRole | null | undefined): role is "super_admin" {
  return role === "super_admin";
}

export function isEditor(role: DashboardRole | null | undefined): role is "editor" {
  return role === "editor";
}

export function canAccessPath(role: DashboardRole | null | undefined, pathname: string): boolean {
  if (!role) return false;
  if (isAdmin(role)) return true;

  return EDITOR_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getRoleLabel(role: DashboardRole): string {
  return role === "super_admin" ? "Super Admin" : "Editor";
}
