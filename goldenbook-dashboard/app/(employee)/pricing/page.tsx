import { requireDashboardUser } from "@/lib/auth/server";
import PricingClient from "./PricingClient";

export default async function PricingPage() {
  const user = await requireDashboardUser();
  return <PricingClient readOnly={user.role !== "super_admin"} />;
}
