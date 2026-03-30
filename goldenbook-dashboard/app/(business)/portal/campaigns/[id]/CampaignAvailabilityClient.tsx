"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CampaignAvailabilityResponse, AvailabilityInventoryItem } from "@/types/api/campaign";
import { fetchCampaignAvailability, createCampaignCheckout, trackCampaignEvent } from "@/lib/api/campaigns";

const SECTION_LABELS: Record<string, string> = {
  golden_picks: "Golden Picks",
  now: "Now",
  hidden_gems: "Hidden Gems",
  new_on_goldenbook: "New on Goldenbook",
  search_priority: "Search Priority",
  category_featured: "Category Featured",
  concierge: "Concierge",
};

const BUCKET_LABELS: Record<string, string> = {
  all_day: "All Day",
  morning: "Morning",
  lunch: "Lunch",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

function fmtDay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

interface Props {
  campaignId: string;
  placeId: string;
}

export default function CampaignAvailabilityClient({ campaignId, placeId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<CampaignAvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  // Step-by-step selection
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [selectedBucket, setSelectedBucket] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    setNetworkError(false);
    try {
      setData(await fetchCampaignAvailability(campaignId, placeId));
    } catch {
      setNetworkError(true);
    } finally {
      setLoading(false);
    }
  }, [campaignId, placeId]);

  useEffect(() => { loadAvailability(); }, [loadAvailability]);

  // ── Derived availability maps ─────────────────────────────────────────────

  const inventory = data?.inventory ?? [];

  // All available items
  const availableItems = useMemo(
    () => inventory.filter((i) => i.available),
    [inventory],
  );

  // Dates that have at least one available slot
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const item of availableItems) set.add(item.date);
    return [...set].sort();
  }, [availableItems]);

  // Positions available for the selected date
  const availablePositions = useMemo(() => {
    if (!selectedDate) return [];
    const set = new Set<number>();
    for (const item of availableItems) {
      if (item.date === selectedDate) set.add(item.position);
    }
    return [...set].sort((a, b) => a - b);
  }, [availableItems, selectedDate]);

  // Time buckets available for selected date + position
  const availableBuckets = useMemo(() => {
    if (!selectedDate || selectedPosition === null) return [];
    return availableItems
      .filter((i) => i.date === selectedDate && i.position === selectedPosition)
      .map((i) => i.time_bucket);
  }, [availableItems, selectedDate, selectedPosition]);

  // Auto-select if only one option
  useEffect(() => {
    if (availableBuckets.length === 1 && !selectedBucket) {
      setSelectedBucket(availableBuckets[0]);
    }
  }, [availableBuckets, selectedBucket]);

  const selectionComplete = selectedDate && selectedPosition !== null && selectedBucket;
  const isEligible = data?.place.eligible ?? false;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedPosition(null);
    setSelectedBucket("");
  }

  function selectPosition(pos: number) {
    setSelectedPosition(pos);
    setSelectedBucket("");

    trackCampaignEvent("slot_selected", {
      campaign_id: campaignId,
      place_id: placeId,
      position: pos,
      date: selectedDate,
    });
  }

  async function handleCheckout() {
    if (!selectionComplete || checkingOut) return;

    setCheckingOut(true);
    trackCampaignEvent("checkout_started", {
      campaign_id: campaignId,
      place_id: placeId,
      position: selectedPosition!,
      date: selectedDate,
      time_bucket: selectedBucket,
    });

    try {
      // Re-fetch to confirm availability
      const fresh = await fetchCampaignAvailability(campaignId, placeId);
      const stillAvailable = fresh.inventory.find(
        (i) => i.date === selectedDate && i.position === selectedPosition && i.time_bucket === selectedBucket && i.available,
      );

      if (!stillAvailable || !fresh.place.eligible) {
        // Silently refresh — the UI will update and the sold slot will disappear
        setData(fresh);
        setSelectedDate("");
        setSelectedPosition(null);
        setSelectedBucket("");
        return;
      }

      const result = await createCampaignCheckout({
        planId: "00000000-0000-0000-0000-000000000000",
        campaignId,
        date: selectedDate,
        position: selectedPosition!,
        time_bucket: selectedBucket,
      });

      trackCampaignEvent("checkout_completed", {
        campaign_id: campaignId,
        place_id: placeId,
        position: selectedPosition!,
        date: selectedDate,
        time_bucket: selectedBucket,
      });

      window.location.href = result.checkoutUrl;
    } catch {
      // Refresh availability to show current state
      await loadAvailability();
      setSelectedDate("");
      setSelectedPosition(null);
      setSelectedBucket("");
    } finally {
      setCheckingOut(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#D2B68A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (networkError || !data) {
    return (
      <div className="bg-white rounded-2xl border border-[#EDE9E3] p-12 text-center">
        <p className="text-sm text-[#6B6B7B]">Could not load campaign.</p>
        <button onClick={loadAvailability} className="mt-2 text-[#D2B68A] font-semibold cursor-pointer">Retry</button>
      </div>
    );
  }

  const { campaign, place, alternatives } = data;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <button onClick={() => router.push("/portal/promote")} className="text-sm text-[#6B6B7B] hover:text-[#222D52] cursor-pointer mb-2 inline-flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h2 className="text-xl font-bold text-[#222D52]">{campaign.name}</h2>
        <p className="text-sm text-[#6B6B7B] mt-0.5">
          {SECTION_LABELS[campaign.section] ?? campaign.section}
          {campaign.city_name && ` · ${campaign.city_name}`}
        </p>
      </div>

      {/* Eligibility — only show if NOT eligible */}
      {!isEligible && (
        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-[#92400E]">
            {place.reason === "DISCOVER_CONFLICT"
              ? "You already have an active Discover placement."
              : place.reason === "DUPLICATE_SECTION"
                ? `You already have an active ${SECTION_LABELS[campaign.section] ?? campaign.section} placement.`
                : place.reason === "CITY_MISMATCH"
                  ? "Your place is not in the same city as this campaign."
                  : "No slots available right now."}
          </p>
          {alternatives.filter((a) => a.available).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {alternatives.filter((a) => a.available).map((a) => (
                <span key={a.section} className="text-xs bg-white/80 rounded-full px-2.5 py-0.5 text-[#92400E] font-medium">
                  {SECTION_LABELS[a.section] ?? a.section}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Select Date (Calendar) ─────────────────────────────────── */}
      {isEligible && (
        <div className="bg-white rounded-2xl border border-[#EDE9E3] p-5">
          <p className="text-sm font-bold text-[#222D52] mb-3">Select a date</p>

          {availableDates.length === 0 ? (
            <p className="text-sm text-[#6B6B7B] py-4 text-center">No dates available.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
              {availableDates.map((d) => {
                const dt = new Date(d + "T00:00:00");
                const isSelected = selectedDate === d;
                return (
                  <button
                    key={d}
                    onClick={() => selectDate(d)}
                    className={`flex flex-col items-center py-2.5 px-2 rounded-xl text-center transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-[#D2B68A] text-white border-[#D2B68A] shadow-sm"
                        : "bg-white text-[#222D52] border-[#EDE9E3] hover:border-[#D2B68A] hover:bg-[#FDFAF5]"
                    }`}
                  >
                    <span className={`text-[10px] font-medium uppercase ${isSelected ? "text-white/70" : "text-[#6B6B7B]"}`}>
                      {dt.toLocaleDateString("en-GB", { weekday: "short" })}
                    </span>
                    <span className="text-lg font-bold leading-tight">{dt.getDate()}</span>
                    <span className={`text-[10px] ${isSelected ? "text-white/70" : "text-[#6B6B7B]"}`}>
                      {dt.toLocaleDateString("en-GB", { month: "short" })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Select Position ────────────────────────────────────────── */}
      {isEligible && selectedDate && (
        <div className="bg-white rounded-2xl border border-[#EDE9E3] p-5">
          <p className="text-sm font-bold text-[#222D52] mb-3">Select a position</p>
          <div className="flex flex-wrap gap-2">
            {availablePositions.map((pos) => {
              const isSelected = selectedPosition === pos;
              return (
                <button
                  key={pos}
                  onClick={() => selectPosition(pos)}
                  className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-[#D2B68A] text-white border-[#D2B68A]"
                      : "bg-white text-[#222D52] border-[#EDE9E3] hover:border-[#D2B68A]"
                  }`}
                >
                  #{pos}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 3: Select Time Bucket ─────────────────────────────────────── */}
      {isEligible && selectedDate && selectedPosition !== null && availableBuckets.length > 1 && (
        <div className="bg-white rounded-2xl border border-[#EDE9E3] p-5">
          <p className="text-sm font-bold text-[#222D52] mb-3">Select a time slot</p>
          <div className="flex flex-wrap gap-2">
            {availableBuckets.map((b) => {
              const isSelected = selectedBucket === b;
              return (
                <button
                  key={b}
                  onClick={() => setSelectedBucket(b)}
                  className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-[#D2B68A] text-white border-[#D2B68A]"
                      : "bg-white text-[#222D52] border-[#EDE9E3] hover:border-[#D2B68A]"
                  }`}
                >
                  {BUCKET_LABELS[b] ?? b}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Summary + Checkout ─────────────────────────────────────────────── */}
      {isEligible && selectionComplete && (
        <div className="bg-white rounded-2xl border border-[#D2B68A]/30 p-5 shadow-sm">
          <p className="text-sm font-bold text-[#222D52]">Summary</p>
          <div className="mt-2.5 space-y-1">
            <p className="text-sm text-[#222D52]">
              <span className="font-semibold">{SECTION_LABELS[campaign.section] ?? campaign.section}</span> #{selectedPosition}
            </p>
            <p className="text-sm text-[#6B6B7B]">{fmtDay(selectedDate)}</p>
            <p className="text-sm text-[#6B6B7B]">{BUCKET_LABELS[selectedBucket] ?? selectedBucket}</p>
          </div>

          <p className="mt-3 text-xs text-[#6B6B7B]">
            Slot confirmed after payment. Not reserved until then.
          </p>

          <button
            onClick={handleCheckout}
            disabled={checkingOut}
            className="mt-4 w-full bg-[#D2B68A] text-white font-semibold text-base py-3.5 rounded-xl hover:bg-[#C6A769] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {checkingOut && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {checkingOut ? "Checking availability..." : "Proceed to Checkout"}
          </button>
        </div>
      )}
    </div>
  );
}
