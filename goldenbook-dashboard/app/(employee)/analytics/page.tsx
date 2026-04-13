import {
  fetchAnalyticsOverview,
  fetchCampaignPerformance,
  fetchEstablishmentPerformance,
  fetchTimePerformance,
} from "@/lib/api/campaign-analytics";
import { fetchAdminInsights } from "@/lib/api/recommendations";
import { fetchBehaviorAnalytics } from "@/lib/api/tracking";
import CampaignAnalyticsClient from "./CampaignAnalyticsClient";
import AdminInsightsClient from "./AdminInsightsClient";
import BehaviorAnalyticsClient from "./BehaviorAnalyticsClient";
import ContentOverviewClient from "./ContentOverviewClient";

export default async function AnalyticsPage() {
  const [overviewResult, campaignsResult, establishmentsResult, timeResult, insightsResult, behaviorResult] = await Promise.allSettled([
    fetchAnalyticsOverview("30"),
    fetchCampaignPerformance(),
    fetchEstablishmentPerformance(),
    fetchTimePerformance(),
    fetchAdminInsights(),
    fetchBehaviorAnalytics("30"),
  ]);

  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const campaigns = campaignsResult.status === "fulfilled" ? campaignsResult.value : [];
  const establishments = establishmentsResult.status === "fulfilled" ? establishmentsResult.value : [];
  const time = timeResult.status === "fulfilled" ? timeResult.value : null;
  const insights = insightsResult.status === "fulfilled" ? insightsResult.value : null;
  const behavior = behaviorResult.status === "fulfilled" ? behaviorResult.value : null;

  return (
    <div className="flex flex-col gap-10">
      {insights && <AdminInsightsClient insights={insights} />}

      <ContentOverviewClient />

      <CampaignAnalyticsClient
        overview={overview}
        campaigns={campaigns}
        establishments={establishments}
        timeBuckets={time?.timeBuckets ?? []}
        dayOfWeek={time?.dayOfWeek ?? []}
      />

      <BehaviorAnalyticsClient data={behavior} />
    </div>
  );
}
