import {
  fetchAnalyticsOverview,
  fetchCampaignPerformance,
  fetchEstablishmentPerformance,
  fetchTimePerformance,
  fetchBookingProviderAnalytics,
} from "@/lib/api/campaign-analytics";
import { fetchAdminInsights } from "@/lib/api/recommendations";
import { fetchBehaviorAnalytics } from "@/lib/api/tracking";
import CampaignAnalyticsClient from "./CampaignAnalyticsClient";
import BookingAnalyticsClient from "./BookingAnalyticsClient";
import AdminInsightsClient from "./AdminInsightsClient";
import BehaviorAnalyticsClient from "./BehaviorAnalyticsClient";

export default async function AnalyticsPage() {
  const [overviewResult, campaignsResult, establishmentsResult, timeResult, bookingResult, insightsResult, behaviorResult] = await Promise.allSettled([
    fetchAnalyticsOverview("30"),
    fetchCampaignPerformance(),
    fetchEstablishmentPerformance(),
    fetchTimePerformance(),
    fetchBookingProviderAnalytics(),
    fetchAdminInsights(),
    fetchBehaviorAnalytics("30"),
  ]);

  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const campaigns = campaignsResult.status === "fulfilled" ? campaignsResult.value : [];
  const establishments = establishmentsResult.status === "fulfilled" ? establishmentsResult.value : [];
  const time = timeResult.status === "fulfilled" ? timeResult.value : null;
  const booking = bookingResult.status === "fulfilled" ? bookingResult.value : null;
  const insights = insightsResult.status === "fulfilled" ? insightsResult.value : null;
  const behavior = behaviorResult.status === "fulfilled" ? behaviorResult.value : null;

  return (
    <div className="flex flex-col gap-10">
      {insights && <AdminInsightsClient insights={insights} />}

      <CampaignAnalyticsClient
        overview={overview}
        campaigns={campaigns}
        establishments={establishments}
        timeBuckets={time?.timeBuckets ?? []}
        dayOfWeek={time?.dayOfWeek ?? []}
      />

      <BehaviorAnalyticsClient data={behavior} />

      <BookingAnalyticsClient
        providers={booking?.providers ?? []}
        dailyClicks={booking?.dailyClicks ?? []}
        topPlaces={booking?.topPlaces ?? []}
      />
    </div>
  );
}
