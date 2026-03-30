import { requireDashboardUser } from "@/lib/auth/server";
import ReviewQueueClient from "./ReviewQueueClient";

export default async function ReviewQueuePage() {
  await requireDashboardUser();
  return <ReviewQueueClient />;
}
