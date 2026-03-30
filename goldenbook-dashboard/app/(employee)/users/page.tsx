import { requireDashboardUser } from "@/lib/auth/server";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const user = await requireDashboardUser();
  return <UsersClient userRole={user.role} />;
}
