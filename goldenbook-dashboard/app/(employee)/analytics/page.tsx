import {
  fetchAnalyticsOverview,
  fetchCampaignPerformance,
  fetchEstablishmentPerformance,
  fetchTimePerformance,
} from "@/lib/api/campaign-analytics";
import { fetchAdminInsights } from "@/lib/api/recommendations";
import CampaignAnalyticsClient from "./CampaignAnalyticsClient";
import AdminInsightsClient from "./AdminInsightsClient";
import ContentOverviewClient from "./ContentOverviewClient";
import UserBehaviorV2Client from "./UserBehaviorV2Client";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [overviewResult, campaignsResult, establishmentsResult, timeResult, insightsResult] = await Promise.allSettled([
    fetchAnalyticsOverview("30"),
    fetchCampaignPerformance(),
    fetchEstablishmentPerformance(),
    fetchTimePerformance(),
    fetchAdminInsights(),
  ]);

  // Log server-side fetch failures so ops can see which endpoint is down —
  // previously the errors were silently swallowed and the UI rendered an
  // empty dashboard with no clue why.
  const fetchNames = ["overview", "campaigns", "establishments", "time", "insights"];
  [overviewResult, campaignsResult, establishmentsResult, timeResult, insightsResult].forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[AnalyticsPage] ${fetchNames[i]} fetch failed:`, r.reason);
    }
  });

  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const campaigns = campaignsResult.status === "fulfilled" ? campaignsResult.value : [];
  const establishments = establishmentsResult.status === "fulfilled" ? establishmentsResult.value : [];
  const time = timeResult.status === "fulfilled" ? timeResult.value : null;
  const insights = insightsResult.status === "fulfilled" ? insightsResult.value : null;

  return (
    <div className="flex flex-col gap-10">
      {insights && <AdminInsightsClient insights={insights} />}

      <UserBehaviorV2Client />

      <ContentOverviewClient />

      <CampaignAnalyticsClient
        overview={overview}
        campaigns={campaigns}
        establishments={establishments}
        timeBuckets={time?.timeBuckets ?? []}
        dayOfWeek={time?.dayOfWeek ?? []}
      />
    </div>
  );
}
