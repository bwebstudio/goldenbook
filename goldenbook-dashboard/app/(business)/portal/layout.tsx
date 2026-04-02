import { requireBusinessUser } from "@/lib/auth/server";
import type { ReactNode } from "react";
import { PlaceProvider } from "@/lib/place-context";
import PortalShell from "./PortalShell";

export default async function BusinessPortalLayout({ children }: { children: ReactNode }) {
  const user = await requireBusinessUser();

  return (
    <PlaceProvider>
      <PortalShell user={user}>{children}</PortalShell>
    </PlaceProvider>
  );
}
