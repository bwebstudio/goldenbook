"use client";

import Link from "next/link";
import type { CampaignDTO } from "@/types/api/campaign";

const SECTION_LABELS: Record<string, string> = {
  golden_picks: "Golden Picks",
  now: "Now",
  hidden_gems: "Hidden Gems",
  new_on_goldenbook: "New on Goldenbook",
  search_priority: "Search Priority",
  category_featured: "Category Featured",
  concierge: "Concierge",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function CampaignDiscoveryClient({ campaigns }: { campaigns: CampaignDTO[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-[#F5F1EB] flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D2B68A" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
        </div>
        <h3 className="text-lg font-bold text-[#222D52]">No campaigns available</h3>
        <p className="text-sm text-[#6B6B7B] mt-1">Check back later for premium placement opportunities.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-[#222D52]">Available Campaigns</h2>
        <p className="text-sm text-[#6B6B7B] mt-1">Boost your visibility with premium placements.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((c) => (
          <Link
            key={c.id}
            href={`/portal/campaigns/${c.id}`}
            className="bg-white rounded-2xl border border-[#EDE9E3] p-6 hover:border-[#D2B68A] transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#222D52] group-hover:text-[#D2B68A] transition-colors">
                  {c.name}
                </h3>
                <p className="text-sm text-[#6B6B7B] mt-0.5">
                  {SECTION_LABELS[c.section] ?? c.section}
                  {c.city_name && ` · ${c.city_name}`}
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#F5F1EB] text-[#D2B68A] capitalize">
                {c.section_group}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#6B6B7B]">Available slots</p>
                <p className="text-lg font-bold text-[#222D52]">{c.available_inventory}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#6B6B7B]">Period</p>
                <p className="text-sm font-medium text-[#222D52]">
                  {formatDate(c.start_date)} — {formatDate(c.end_date)}
                </p>
              </div>
            </div>

            {/* Capacity bar */}
            <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: c.total_inventory > 0 ? `${(c.sold_inventory / c.total_inventory) * 100}%` : "0%",
                  backgroundColor: c.available_inventory === 0 ? "#EF4444" : c.sold_inventory > c.total_inventory * 0.7 ? "#F59E0B" : "#10B981",
                }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
