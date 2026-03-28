import type { ReactNode } from "react";
import { requireAdminDashboardUser } from "@/lib/auth/server";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireAdminDashboardUser();
  return children;
}
