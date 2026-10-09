import type { Metadata } from "next";
import { fetchUnifiedPlacements, fetchAdminCampaigns } from "@/lib/api/campaigns";
import type { UnifiedPlacement } from "@/lib/api/campaigns";
import type { CampaignDTO } from "@/types/api/campaign";
import { requireDashboardUser } from "@/lib/auth/server";
import CampaignsClient from "./CampaignsClient";

export const metadata: Metadata = {
  title: "Campaigns — Goldenbook Admin",
  description: "Manage premium placement campaigns, inventory, and slots.",
};

export default async function CampaignsPage() {
  const user = await requireDashboardUser();

  const [placementsResult, campaignsResult] = await Promise.allSettled([
    fetchUnifiedPlacements(),
    fetchAdminCampaigns(),
  ]);

  const placements: UnifiedPlacement[] = placementsResult.status === "fulfilled" ? placementsResult.value : [];
  const campaigns: CampaignDTO[] = campaignsResult.status === "fulfilled" ? campaignsResult.value : [];

  if (placementsResult.status === "rejected" && campaignsResult.status === "rejected") {
    return (
      <div className="bg-white rounded-2xl border border-border p-12 text-center">
        <p className="text-lg text-muted">Could not load campaigns.</p>
        {/* A hard reload is intentional: "Retry" must re-run this server
            render from scratch, which a soft <Link> to the same URL does not
            guarantee. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/campaigns" className="text-gold font-semibold mt-2 inline-block">Retry</a>
      </div>
    );
  }

  return <CampaignsClient placements={placements} campaigns={campaigns} userRole={user.role} />;
}
