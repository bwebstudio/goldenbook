import {
  fetchAnalyticsOverview,
  fetchCampaignPerformance,
  fetchEstablishmentPerformance,
  fetchTimePerformance,
  fetchBookingProviderAnalytics,
} from "@/lib/api/campaign-analytics";
import CampaignAnalyticsClient from "./CampaignAnalyticsClient";
import BookingAnalyticsClient from "./BookingAnalyticsClient";

export default async function AnalyticsPage() {
  const [overviewResult, campaignsResult, establishmentsResult, timeResult, bookingResult] = await Promise.allSettled([
    fetchAnalyticsOverview("30"),
    fetchCampaignPerformance(),
    fetchEstablishmentPerformance(),
    fetchTimePerformance(),
    fetchBookingProviderAnalytics(),
  ]);

  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const campaigns = campaignsResult.status === "fulfilled" ? campaignsResult.value : [];
  const establishments = establishmentsResult.status === "fulfilled" ? establishmentsResult.value : [];
  const time = timeResult.status === "fulfilled" ? timeResult.value : null;
  const booking = bookingResult.status === "fulfilled" ? bookingResult.value : null;

  return (
    <div className="flex flex-col gap-10">
      <CampaignAnalyticsClient
        overview={overview}
        campaigns={campaigns}
        establishments={establishments}
        timeBuckets={time?.timeBuckets ?? []}
        dayOfWeek={time?.dayOfWeek ?? []}
      />

      <BookingAnalyticsClient
        providers={booking?.providers ?? []}
        dailyClicks={booking?.dailyClicks ?? []}
        topPlaces={booking?.topPlaces ?? []}
      />
    </div>
  );
}
