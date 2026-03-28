"use client";

import PlaceCard from "@/components/places/PlaceCard";
import type { UIPlace } from "@/types/ui/place";
import Link from "next/link";
import { useMemo, useState } from "react";

type PlaceStatus = "draft" | "published" | "featured";

const STATUS_OPTIONS: { value: PlaceStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "featured", label: "Featured" },
  { value: "draft", label: "Draft" },
];

const filterSelectClass =
  "rounded-xl border border-border bg-white px-4 py-3 text-base text-text focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition appearance-none cursor-pointer min-w-[160px]";

interface PlacesClientProps {
  places: UIPlace[];
  cities: string[];
  categories: string[];
}

export default function PlacesClient({ places, cities, categories }: PlacesClientProps) {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PlaceStatus | "all">("all");

  const filtered = useMemo(() => {
    return places.filter((place) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        place.name.toLowerCase().includes(q) ||
        place.city.toLowerCase().includes(q) ||
        place.category.toLowerCase().includes(q);

      const matchesCity = cityFilter === "all" || place.city === cityFilter;

      // Category filter compares against the formatted display name
      const matchesCategory =
        categoryFilter === "all" || place.category === categoryFilter;

      const matchesStatus =
        statusFilter === "all" || place.status === statusFilter;

      return matchesSearch && matchesCity && matchesCategory && matchesStatus;
    });
  }, [places, search, cityFilter, categoryFilter, statusFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    cityFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCityFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
  }

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      {/* Top action row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-60 max-w-sm">
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
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors whitespace-nowrap"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add new place
        </Link>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-muted mr-1">Filter by:</span>

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

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm font-semibold text-muted hover:text-gold underline transition-colors cursor-pointer ml-1"
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
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex flex-col items-center gap-5 text-center">
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
