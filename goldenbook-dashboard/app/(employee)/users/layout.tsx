import type { ReactNode } from "react";
import { requireDashboardUser } from "@/lib/auth/server";

export default async function UsersLayout({ children }: { children: ReactNode }) {
  await requireDashboardUser();
  return children;
}
