import Link from "next/link";
import { fetchCategories } from "@/lib/api/categories";
import { mapCategoriesToUI } from "@/lib/api/mappers/categoryMapper";
import CategoryForm from "@/components/categories/CategoryForm";
import type { UICategory, UISubcategory } from "@/types/ui/category";

interface CategoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { id } = await params;

  let allCategories: UICategory[] = [];
  let errorMessage: string | null = null;

  try {
    const dtos = await fetchCategories();
    allCategories = mapCategoriesToUI(dtos);
  } catch (err) {
    console.error("[CategoryDetailPage] Failed to load categories:", err);
    errorMessage = "Could not load category data. Please try again.";
  }

  if (errorMessage) {
    return (
      <div className="max-w-2xl flex flex-col gap-8">
        <Link
          href="/categories"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text transition-colors w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to categories
        </Link>
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-16 flex flex-col items-center gap-5 text-center">
          <div className="w-14 h-14 rounded-xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">Could not load data</h3>
            <p className="text-base text-muted mt-2 max-w-sm">{errorMessage}</p>
          </div>
          <a
            href={`/categories/${id}`}
            className="px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  // Find the item by id — could be a main category or a subcategory
  let foundCategory: UICategory | null = null;
  let foundSubcategory: UISubcategory | null = null;

  for (const cat of allCategories) {
    if (cat.id === id) {
      foundCategory = cat;
      break;
    }
    for (const sub of cat.subcategories) {
      if (sub.id === id) {
        foundSubcategory = sub;
        foundCategory = cat; // parent
        break;
      }
    }
    if (foundCategory) break;
  }

  // If nothing found, show a not-found state
  if (!foundCategory && !foundSubcategory) {
    return (
      <div className="max-w-2xl flex flex-col gap-8">
        <Link
          href="/categories"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text transition-colors w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to categories
        </Link>
        <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-16 flex flex-col items-center gap-5 text-center">
          <div className="w-14 h-14 rounded-xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">Category not found</h3>
            <p className="text-base text-muted mt-2 max-w-sm">
              This category does not exist or may have been removed.
            </p>
          </div>
          <Link
            href="/categories"
            className="px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors"
          >
            Back to categories
          </Link>
        </div>
      </div>
    );
  }

  // Determine what we're showing
  const isSubcategory = foundSubcategory !== null;
  const displayName = isSubcategory ? foundSubcategory!.name : foundCategory!.name;
  const displaySlug = isSubcategory ? foundSubcategory!.slug : foundCategory!.slug;
  const parentOptions = allCategories.filter(
    (c) => !isSubcategory || c.id !== foundSubcategory!.parentId
  );

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
        Back to categories
      </Link>

      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-text">{displayName}</h1>
          {isSubcategory ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-[#F5F1EB] text-muted">
              Subcategory of {foundSubcategory!.parentName}
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-text/8 text-text">
              Main category
            </span>
          )}
        </div>
        <p className="text-base text-[#B0AAA3] mt-1 font-mono">{displaySlug}</p>
      </div>

      <CategoryForm
        mode="edit"
        initialValues={{
          name:             displayName,
          slug:             displaySlug,
          description:      isSubcategory ? (foundSubcategory!.description ?? "") : (foundCategory!.description ?? ""),
          iconName:         isSubcategory ? "" : (foundCategory!.iconName ?? ""),
          sortOrder:        String(isSubcategory ? foundSubcategory!.sortOrder : foundCategory!.sortOrder),
          isActive:         isSubcategory ? foundSubcategory!.isActive : foundCategory!.isActive,
          parentCategoryId: isSubcategory ? foundSubcategory!.parentId : "",
        }}
        parentOptions={parentOptions}
        categoryId={id}
      />

      {/* Usage info — subcategory count if it's a main category */}
      {!isSubcategory && foundCategory!.subcategoryCount > 0 && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-border bg-surface">
            <h2 className="text-xl font-bold text-text">Subcategories</h2>
            <p className="text-sm text-muted mt-1">
              These subcategories belong to {foundCategory!.name}
            </p>
          </div>
          <div className="divide-y divide-border">
            {foundCategory!.subcategories.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between px-8 py-4">
                <div>
                  <p className="text-base font-semibold text-text">{sub.name}</p>
                  <p className="text-sm text-[#B0AAA3] font-mono mt-0.5">{sub.slug}</p>
                </div>
                <Link
                  href={`/categories/${sub.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}