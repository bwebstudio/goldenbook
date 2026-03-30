import type { Metadata } from "next";
import { fetchAdminCampaigns } from "@/lib/api/campaigns";
import CampaignDiscoveryClient from "../campaigns/CampaignDiscoveryClient";

export const metadata: Metadata = {
  title: "Browse Campaigns — Goldenbook",
  description: "Discover premium placement campaigns and boost your visibility on Goldenbook.",
};

export default async function PortalBrowseCampaignsPage() {
  let campaigns;
  try {
    campaigns = await fetchAdminCampaigns({ status: "active" });
  } catch {
    return (
      <div className="bg-white rounded-2xl border border-[#EDE9E3] p-12 text-center">
        <p className="text-base text-[#6B6B7B]">Could not load campaigns.</p>
        <a href="/portal/browse" className="text-[#D2B68A] font-semibold mt-2 inline-block">Retry</a>
      </div>
    );
  }

  return <CampaignDiscoveryClient campaigns={campaigns} />;
}
