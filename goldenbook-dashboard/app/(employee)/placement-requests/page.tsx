import { requireAdminDashboardUser } from "@/lib/auth/server";
import PlacementRequestsClient from "./PlacementRequestsClient";

export default async function PlacementRequestsPage() {
  await requireAdminDashboardUser();
  return <PlacementRequestsClient />;
}
