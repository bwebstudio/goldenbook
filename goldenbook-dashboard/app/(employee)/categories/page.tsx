"use client";

import { useState, useEffect } from "react";
import { useLocale, useT } from "@/lib/i18n";
import CategoriesClient from "./CategoriesClient";
import { fetchCategories } from "@/lib/api/categories";
import { mapCategoriesToUI } from "@/lib/api/mappers/categoryMapper";
import type { UICategory } from "@/types/ui/category";

export default function CategoriesPage() {
  const { locale } = useLocale();
  const t = useT();
  const ct = t.employeePages.categories;
  const [categories, setCategories] = useState<UICategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    fetchCategories(locale)
      .then((dtos) => {
        if (!cancelled) {
          setCategories(mapCategoriesToUI(dtos));
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[CategoriesPage] Failed to load categories:", err);
        if (!cancelled) {
          setErrorMessage(ct.couldNotLoad);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [locale, ct.couldNotLoad]);

  if (loading) {
    return (
      <div className="max-w-4xl">
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex items-center justify-center">
          <p className="text-sm text-muted">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-4xl">
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">{ct.couldNotLoad}</h3>
            <p className="text-base text-muted mt-2 max-w-sm">{errorMessage}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors cursor-pointer"
          >
            {ct.tryAgain}
          </button>
        </div>
      </div>
    );
  }

  return <CategoriesClient categories={categories} />;
}
