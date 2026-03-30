import { fetchAdminCampaignDetail } from "@/lib/api/campaigns";
import CampaignDetailClient from "./CampaignDetailClient";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  try {
    data = await fetchAdminCampaignDetail(id);
  } catch {
    return (
      <div className="bg-white rounded-2xl border border-border p-12 text-center">
        <p className="text-lg text-muted">Could not load campaign.</p>
        <a href="/campaigns" className="text-gold font-semibold mt-2 inline-block">Back to campaigns</a>
      </div>
    );
  }

  return <CampaignDetailClient data={data} />;
}
