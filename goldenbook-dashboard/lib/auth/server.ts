import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DashboardUser } from "@/types/auth";
import { AUTH_COOKIE_NAMES, fetchCurrentUser } from "@/lib/api/auth";
import { isAdmin, isBusinessClient } from "@/lib/auth/permissions";

export const getCurrentDashboardUser = cache(async (): Promise<DashboardUser | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value;

  if (!accessToken) {
    return null;
  }

  try {
    return await fetchCurrentUser(accessToken);
  } catch {
    return null;
  }
});

export async function requireDashboardUser(): Promise<DashboardUser> {
  const user = await getCurrentDashboardUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdminDashboardUser(): Promise<DashboardUser> {
  const user = await requireDashboardUser();

  if (!isAdmin(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}

export async function requireBusinessUser(): Promise<DashboardUser> {
  const user = await requireDashboardUser();

  if (!isBusinessClient(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}
