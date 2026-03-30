import type { Metadata } from "next";
import CampaignForm from "@/components/campaigns/CampaignForm";
import { apiGet } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "New Campaign — Goldenbook Admin",
  description: "Create a new premium placement campaign.",
};

interface DestinationDTO {
  id: string;
  name: string;
  slug: string;
}

export default async function NewCampaignPage() {
  let cities: DestinationDTO[] = [];
  try {
    const data = await apiGet<{ items: DestinationDTO[] }>("/api/v1/destinations");
    cities = data.items ?? [];
  } catch {
    // Non-blocking — cities dropdown will be empty
  }

  return <CampaignForm cities={cities.map((c) => ({ value: c.id, label: c.name }))} />;
}
