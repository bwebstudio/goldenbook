"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { fetchCategories } from "@/lib/api/categories";
import { mapCategoriesToUI } from "@/lib/api/mappers/categoryMapper";
import CategoryForm from "@/components/categories/CategoryForm";
import type { UICategory } from "@/types/ui/category";

export default function NewCategoryPage() {
  const { locale } = useLocale();
  const t = useT();
  const ct = t.employeePages.categories;
  const [parentOptions, setParentOptions] = useState<UICategory[]>([]);

  useEffect(() => {
    fetchCategories(locale)
      .then((dtos) => setParentOptions(mapCategoriesToUI(dtos)))
      .catch(() => {});
  }, [locale]);

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      {/* Back nav */}
      <Link
        href="/categories"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text transition-colors w-fit"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        {ct.backToCategories}
      </Link>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-text">{ct.addCategory}</h1>
        <p className="text-base text-muted mt-1">
          {ct.subtitle}
        </p>
      </div>

      <CategoryForm mode="create" parentOptions={parentOptions} />
    </div>
  );
}
