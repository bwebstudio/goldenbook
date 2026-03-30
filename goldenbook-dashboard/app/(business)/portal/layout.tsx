import { requireBusinessUser } from "@/lib/auth/server";
import type { ReactNode } from "react";
import PortalShell from "./PortalShell";

export default async function BusinessPortalLayout({ children }: { children: ReactNode }) {
  const user = await requireBusinessUser();

  return <PortalShell user={user}>{children}</PortalShell>;
}
