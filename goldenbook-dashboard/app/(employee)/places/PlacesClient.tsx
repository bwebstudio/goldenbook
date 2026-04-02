"use client";

import PlaceCard from "@/components/places/PlaceCard";
import type { UIPlace } from "@/types/ui/place";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkApplySuggestions } from "@/lib/api/suggestions";

type PlaceStatus = "draft" | "published" | "featured";

const STATUS_OPTIONS: { value: PlaceStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "featured", label: "Featured" },
  { value: "draft", label: "Draft" },
];

type BookingFilter = "all" | "configured" | "not_configured" | "has_suggestion" | "high_confidence";

const BOOKING_OPTIONS: { value: BookingFilter; label: string }[] = [
  { value: "all",             label: "All booking states" },
  { value: "configured",      label: "Booking configured" },
  { value: "not_configured",  label: "No booking config" },
  { value: "has_suggestion",  label: "Has suggestion" },
  { value: "high_confidence", label: "High confidence suggestions" },
];

const filterSelectClass =
  "rounded-xl border border-border bg-white px-4 py-3 text-base text-text focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition appearance-none cursor-pointer w-full sm:min-w-[160px] sm:w-auto";

interface PlacesClientProps {
  places: UIPlace[];
  cities: string[];
  categories: string[];
}

export default function PlacesClient({ places, cities, categories }: PlacesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PlaceStatus | "all">("all");
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [bulkActionStatus, setBulkActionStatus] = useState<"idle" | "loading" | "done">("idle");

  const filtered = useMemo(() => {
    return places.filter((place) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        place.name.toLowerCase().includes(q) ||
        place.city.toLowerCase().includes(q) ||
        place.category.toLowerCase().includes(q);

      const matchesCity = cityFilter === "all" || place.city === cityFilter;
      const matchesCategory = categoryFilter === "all" || place.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || place.status === statusFilter;

      let matchesBooking = true;
      if (bookingFilter === "configured") matchesBooking = place.bookingEnabled;
      else if (bookingFilter === "not_configured") matchesBooking = !place.bookingEnabled;
      else if (bookingFilter === "has_suggestion") matchesBooking = place.hasSuggestion && !place.suggestionDismissed;
      else if (bookingFilter === "high_confidence") matchesBooking = place.hasSuggestion && !place.suggestionDismissed && (place.suggestionConfidence ?? 0) >= 0.75;

      return matchesSearch && matchesCity && matchesCategory && matchesStatus && matchesBooking;
    });
  }, [places, search, cityFilter, categoryFilter, statusFilter, bookingFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    cityFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    bookingFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCityFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setBookingFilter("all");
  }

  // Bulk apply high-confidence suggestions from the currently filtered set
  async function handleBulkApply() {
    const eligibleIds = filtered
      .filter(p => p.hasSuggestion && !p.suggestionDismissed && (p.suggestionConfidence ?? 0) >= 0.75 && !p.bookingEnabled)
      .map(p => p.id);

    if (eligibleIds.length === 0) return;

    setBulkActionStatus("loading");
    try {
      await bulkApplySuggestions({ placeIds: eligibleIds });
      setBulkActionStatus("done");
      router.refresh();
    } catch {
      setBulkActionStatus("idle");
    }
  }

  // Stats for the suggestion summary bar
  const suggestionStats = useMemo(() => {
    const withSuggestion = places.filter(p => p.hasSuggestion && !p.suggestionDismissed);
    const highConf = withSuggestion.filter(p => (p.suggestionConfidence ?? 0) >= 0.75);
    const notConfigured = places.filter(p => !p.bookingEnabled);
    const pendingReview = withSuggestion.filter(p => !p.bookingEnabled);
    return { total: places.length, withSuggestion: withSuggestion.length, highConf: highConf.length, notConfigured: notConfigured.length, pendingReview: pendingReview.length };
  }, [places]);

  return (
    <div className="w-full max-w-5xl flex flex-col gap-6">
      {/* Suggestion summary bar */}
      {suggestionStats.withSuggestion > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
            <span className="text-amber-800 font-semibold">{suggestionStats.withSuggestion} suggestions available</span>
            <span className="text-muted">{suggestionStats.highConf} high confidence</span>
            <span className="text-muted">{suggestionStats.pendingReview} pending review</span>
            <span className="text-muted">{suggestionStats.notConfigured} without config</span>
          </div>
          {suggestionStats.highConf > 0 && (
            <button
              onClick={handleBulkApply}
              disabled={bulkActionStatus === "loading"}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-60 w-full sm:w-auto"
            >
              {bulkActionStatus === "loading" ? "Applying..." :
               bulkActionStatus === "done" ? "Applied!" :
               `Apply ${suggestionStats.highConf} high-confidence`}
            </button>
          )}
        </div>
      )}

      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-0 sm:min-w-60 sm:max-w-sm">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B0AAA3] pointer-events-none">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search places..."
            className="w-full rounded-xl border border-border bg-white pl-11 pr-5 py-3 text-base text-text placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition"
          />
        </div>

        <Link
          href="/places/new"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors whitespace-nowrap w-full sm:w-auto"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add new place
        </Link>
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <span className="text-sm font-semibold text-muted sm:col-span-2 lg:col-span-4">Filter by:</span>

        {/* City */}
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className={filterSelectClass}
        >
          <option value="all">All cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={filterSelectClass}
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PlaceStatus | "all")}
          className={filterSelectClass}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Booking / Suggestions */}
        <select
          value={bookingFilter}
          onChange={(e) => setBookingFilter(e.target.value as BookingFilter)}
          className={filterSelectClass}
        >
          {BOOKING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm font-semibold text-muted hover:text-gold underline transition-colors cursor-pointer sm:col-span-2 lg:col-span-4"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-muted -mt-2">
        Showing <span className="font-semibold text-text">{filtered.length}</span> of{" "}
        <span className="font-semibold text-text">{places.length}</span> places
      </p>

      {/* List */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-sm px-4 py-12 sm:px-8 sm:py-20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">
              {search ? "No places found" : "No places yet"}
            </h3>
            <p className="text-base text-muted mt-2 max-w-xs">
              {search
                ? `No places match "${search}". Try adjusting your search or filters.`
                : "Get started by adding your first place to Goldenbook."}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white cursor-pointer"
            >
              Clear all filters
            </button>
          ) : (
            <Link
              href="/places/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors"
            >
              Add new place
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
