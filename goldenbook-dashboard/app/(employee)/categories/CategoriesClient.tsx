"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import type { UICategory } from "@/types/ui/category";

const filterSelectClass =
  "rounded-xl border border-border bg-white px-4 py-3 text-base text-text focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition appearance-none cursor-pointer min-w-[180px]";

interface CategoriesClientProps {
  categories: UICategory[];
}

export default function CategoriesClient({ categories }: CategoriesClientProps) {
  const t = useT();
  const ct = t.employeePages.categories;
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "main" | "sub">("all");

  // Filter categories (and their subcategories) based on search and level
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();

    return categories
      .map((cat) => {
        const catMatches =
          q === "" ||
          cat.name.toLowerCase().includes(q) ||
          cat.slug.toLowerCase().includes(q);

        const matchingSubs = cat.subcategories.filter(
          (sub) =>
            q === "" ||
            sub.name.toLowerCase().includes(q) ||
            sub.slug.toLowerCase().includes(q)
        );

        // Apply level filter
        if (levelFilter === "main") {
          if (!catMatches) return null;
          return { ...cat, subcategories: [] };
        }

        if (levelFilter === "sub") {
          if (matchingSubs.length === 0 && !catMatches) return null;
          return { ...cat, subcategories: cat.subcategories };
        }

        // "all" level
        if (!catMatches && matchingSubs.length === 0) return null;
        return { ...cat, subcategories: catMatches ? cat.subcategories : matchingSubs };
      })
      .filter(Boolean) as typeof categories;
  }, [categories, search, levelFilter]);

  const hasActiveFilters = search.trim() !== "" || levelFilter !== "all";

  function clearFilters() {
    setSearch("");
    setLevelFilter("all");
  }

  const totalSubcategories = categories.reduce((acc, c) => acc + c.subcategoryCount, 0);

  return (
    <div className="max-w-4xl flex flex-col gap-8">

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-text">{ct.title}</h1>
        <p className="text-base text-muted mt-1">
          {ct.subtitle}
        </p>
      </div>

      {/* Backend notice */}
      <div className="flex items-start gap-4 bg-[#FBF7F0] border border-gold/30 rounded-2xl px-6 py-5">
        <div className="shrink-0 mt-0.5 text-gold">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-text">{ct.readOnlyTitle}</p>
          <p className="text-sm text-muted mt-0.5">
            {ct.readOnlyDesc}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-text text-white text-xs font-bold">
            {categories.length}
          </span>
          <span>{categories.length === 1 ? ct.mainCategory : ct.mainCategories}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#F5F1EB] text-text text-xs font-bold">
            {totalSubcategories}
          </span>
          <span>{totalSubcategories === 1 ? ct.subcategoryTotal : ct.subcategoriesTotal}</span>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
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
            placeholder={ct.searchPlaceholder}
            className="w-full rounded-xl border border-border bg-white pl-11 pr-5 py-3 text-base text-text placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as "all" | "main" | "sub")}
            className={filterSelectClass}
          >
            <option value="all">{ct.allLevels}</option>
            <option value="main">{ct.mainOnly}</option>
            <option value="sub">{ct.withSubs}</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-semibold text-muted hover:text-gold underline transition-colors cursor-pointer"
            >
              {ct.clearFilters}
            </button>
          )}

          {/* Add category — disabled until backend supports it */}
          <button
            disabled
            title={ct.addCategoryTooltip}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold/40 text-white text-base font-semibold cursor-not-allowed whitespace-nowrap"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {ct.addCategory}
          </button>
        </div>
      </div>

      {/* Results count when filtering */}
      {hasActiveFilters && (
        <p className="text-sm text-muted -mt-4">
          {ct.showingOf} <span className="font-semibold text-text">{filteredCategories.length}</span> {ct.of}{" "}
          <span className="font-semibold text-text">{categories.length}</span> {ct.categoriesLabel}
        </p>
      )}

      {/* Category list */}
      {filteredCategories.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filteredCategories.map((category) => (
            <CategoryGroup key={category.id} category={category} showSubs={levelFilter !== "main"} ct={ct} />
          ))}
        </div>
      ) : (
        <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} ct={ct} />
      )}
    </div>
  );
}

// ── CategoryGroup ──────────────────────────────────────────────────────────────

interface CategoryGroupProps {
  category: UICategory;
  showSubs: boolean;
  ct: Record<string, string>;
}

function CategoryGroup({ category, showSubs, ct }: CategoryGroupProps) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Main category row */}
      <div className="flex items-center gap-4 px-6 py-5">
        {/* Icon placeholder */}
        <div className="shrink-0 w-12 h-12 rounded-xl bg-[#FBF7F0] flex items-center justify-center text-gold">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg font-bold text-text">{category.name}</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-text/8 text-text">
              {ct.mainCategoryBadge}
            </span>
            {category.subcategoryCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5F1EB] text-muted">
                {category.subcategoryCount} {category.subcategoryCount === 1 ? ct.subcategory : ct.subcategories}
              </span>
            )}
          </div>
          <p className="text-sm text-[#B0AAA3] mt-0.5 font-mono">{category.slug}</p>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          <Link
            href={`/categories/${category.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {ct.view}
          </Link>
        </div>
      </div>

      {/* Subcategories */}
      {showSubs && category.subcategoryCount > 0 && (
        <div className="border-t border-border bg-surface divide-y divide-border">
          {category.subcategories.map((sub) => (
            <div key={sub.id} className="flex items-center gap-4 px-6 py-4">
              {/* Indent indicator */}
              <div className="shrink-0 flex items-center gap-2 pl-4">
                <div className="w-5 h-px bg-[#D8D4CE]" />
                <div className="shrink-0 w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center text-[#B0AAA3]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-base font-semibold text-text">{sub.name}</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5F1EB] text-muted">
                    {ct.subcategoryOf} {sub.parentName}
                  </span>
                </div>
                <p className="text-sm text-[#B0AAA3] mt-0.5 font-mono">{sub.slug}</p>
              </div>

              {/* Actions */}
              <div className="shrink-0">
                <Link
                  href={`/categories/${sub.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {ct.view}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear, ct }: { hasFilters: boolean; onClear: () => void; ct: Record<string, string> }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex flex-col items-center gap-5 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      </div>
      <div>
        <h3 className="text-xl font-bold text-text">
          {hasFilters ? ct.noCategoriesFound : ct.noCategoriesYet}
        </h3>
        <p className="text-base text-muted mt-2 max-w-xs">
          {hasFilters ? ct.noCategoriesFoundDesc : ct.noCategoriesYetDesc}
        </p>
      </div>
      {hasFilters && (
        <button
          onClick={onClear}
          className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white cursor-pointer"
        >
          {ct.clearFilters}
        </button>
      )}
    </div>
  );
}
