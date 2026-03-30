import { requireBusinessUser } from "@/lib/auth/server";
import CampaignAvailabilityClient from "./CampaignAvailabilityClient";

export default async function PortalCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireBusinessUser();
  const placeId = user.businessClient?.placeId ?? "";

  return <CampaignAvailabilityClient campaignId={id} placeId={placeId} />;
}
