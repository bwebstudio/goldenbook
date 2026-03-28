import Link from "next/link";
import { fetchCategories } from "@/lib/api/categories";
import { mapCategoriesToUI } from "@/lib/api/mappers/categoryMapper";
import CategoryForm from "@/components/categories/CategoryForm";
import type { UICategory } from "@/types/ui/category";

export default async function NewCategoryPage() {
  let parentOptions: UICategory[] = [];

  try {
    const dtos = await fetchCategories();
    parentOptions = mapCategoriesToUI(dtos);
  } catch {
    // Non-fatal — parent selector will just be empty
  }

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
        <h1 className="text-3xl font-bold text-text">New category</h1>
        <p className="text-base text-muted mt-1">
          Add a new category to Goldenbook
        </p>
      </div>

      <CategoryForm mode="create" parentOptions={parentOptions} />
    </div>
  );
}