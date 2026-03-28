"use client";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  createCategory,
  createSubcategory,
  deactivateCategory,
  deactivateSubcategory,
  updateCategory,
  updateSubcategory,
} from "@/lib/api/categories";
import {
  type CategoryFormErrors,
  type CategoryFormValues,
  EMPTY_CATEGORY_FORM,
  nameToSlug,
  validateCategoryForm,
} from "@/types/forms/category";
import type { UICategory } from "@/types/ui/category";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface CategoryFormProps {
  mode: "create" | "edit";
  initialValues?: CategoryFormValues;
  parentOptions: UICategory[];
  // For edit mode: id of the item being edited
  categoryId?: string;
  // For edit mode: is this a subcategory?
  isSubcategory?: boolean;
  // For edit mode: parent category id if this is a subcategory
  parentCategoryId?: string;
}

type SaveStatus = "idle" | "saving" | "success";

export default function CategoryForm({
  mode,
  initialValues,
  parentOptions,
  categoryId,
  isSubcategory = false,
}: CategoryFormProps) {
  const router = useRouter();

  const [form, setForm] = useState<CategoryFormValues>(
    initialValues ?? EMPTY_CATEGORY_FORM
  );
  const [errors, setErrors] = useState<CategoryFormErrors>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Auto-derive slug from name while the user hasn't manually edited it
  useEffect(() => {
    if (!slugTouched && form.name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((prev) => ({ ...prev, slug: nameToSlug(prev.name) }));
    }
  }, [form.name, slugTouched]);

  function handleChange(field: keyof CategoryFormValues, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setApiError(null);
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    handleChange("slug", value);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationErrors = validateCategoryForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaveStatus("saving");
    setApiError(null);

    const sortOrder = Number(form.sortOrder) || 0;

    try {
      if (mode === "create") {
        if (form.parentCategoryId) {
          // Creating a subcategory
          await createSubcategory({
            name: form.name.trim(),
            slug: form.slug.trim(),
            description: form.description.trim() || undefined,
            categoryId: form.parentCategoryId,
            sortOrder,
          });
        } else {
          // Creating a main category
          await createCategory({
            name: form.name.trim(),
            slug: form.slug.trim(),
            description: form.description.trim() || undefined,
            iconName: form.iconName.trim() || undefined,
            sortOrder,
          });
        }
        setSaveStatus("success");
        router.push("/categories");
        router.refresh();

      } else if (mode === "edit" && categoryId) {
        if (isSubcategory) {
          await updateSubcategory(categoryId, {
            name: form.name.trim(),
            slug: form.slug.trim(),
            description: form.description.trim() || undefined,
            categoryId: form.parentCategoryId || undefined,
            sortOrder,
            isActive: form.isActive,
          });
        } else {
          await updateCategory(categoryId, {
            name: form.name.trim(),
            slug: form.slug.trim(),
            description: form.description.trim() || undefined,
            iconName: form.iconName.trim() || undefined,
            sortOrder,
            isActive: form.isActive,
          });
        }
        setSaveStatus("success");
        router.refresh();
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    } catch (err) {
      setSaveStatus("idle");
      setApiError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function handleArchive() {
    if (!categoryId) return;
    setIsArchiving(true);
    setApiError(null);
    try {
      if (isSubcategory) {
        await deactivateSubcategory(categoryId);
      } else {
        await deactivateCategory(categoryId);
      }
      router.push("/categories");
      router.refresh();
    } catch (err) {
      setIsArchiving(false);
      setApiError(err instanceof Error ? err.message : "Could not archive. Please try again.");
    }
    setShowArchiveDialog(false);
  }

  const isSubcategoryForm = form.parentCategoryId !== "";

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>

        {/* API error */}
        {apiError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-6 py-4">
            <div className="shrink-0 mt-0.5 text-red-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700">Could not save</p>
              <p className="text-sm text-red-600 mt-0.5">{apiError}</p>
            </div>
            <button
              type="button"
              onClick={() => setApiError(null)}
              className="ml-auto shrink-0 text-red-400 hover:text-red-600 transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Success banner */}
        {saveStatus === "success" && (
          <div className="flex items-center gap-3 bg-[#E8F5EE] border border-[#2D7A4F]/20 rounded-2xl px-6 py-4">
            <div className="text-[#2D7A4F]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#2D7A4F]">Changes saved successfully</p>
          </div>
        )}

        {/* ── Section A: Basic information ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-border bg-surface">
            <h2 className="text-xl font-bold text-text">Basic information</h2>
            <p className="text-sm text-muted mt-1">The name and identifier for this category</p>
          </div>
          <div className="px-8 py-8 flex flex-col gap-6">

            {/* Name */}
            <div className="flex flex-col gap-2">
              <label className="text-base font-semibold text-text">
                Category name <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-muted -mt-1">This is the name shown to users in the app</p>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g. Dining, Culture, Wellness"
                className={`rounded-xl border bg-surface px-5 py-4 text-lg text-text placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition ${errors.name ? "border-red-400 ring-2 ring-red-200" : "border-border"
                  }`}
              />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Slug */}
            <div className="flex flex-col gap-2">
              <label className="text-base font-semibold text-text">
                Slug <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-muted -mt-1">
                Used in URLs. Lowercase letters, numbers, and hyphens only — e.g.{" "}
                <span className="font-mono">fine-dining</span>
              </p>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="e.g. fine-dining"
                className={`rounded-xl border bg-surface px-5 py-4 text-lg font-mono text-text placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition ${errors.slug ? "border-red-400 ring-2 ring-red-200" : "border-border"
                  }`}
              />
              {errors.slug && <p className="text-sm text-red-600">{errors.slug}</p>}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label className="text-base font-semibold text-text">Description</label>
              <p className="text-sm text-muted -mt-1">A short explanation of what this category includes</p>
              <textarea
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="e.g. Restaurants, cafes, bars, and all things food and drink"
                rows={3}
                className="rounded-xl border border-border bg-surface px-5 py-4 text-lg text-text placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Section B: Structure ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-border bg-surface">
            <h2 className="text-xl font-bold text-text">Structure</h2>
            <p className="text-sm text-muted mt-1">
              Is this a main category, or does it belong inside another category?
            </p>
          </div>
          <div className="px-8 py-8 flex flex-col gap-6">

            {/* Type selector */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handleChange("parentCategoryId", "")}
                className={`flex-1 flex flex-col items-center gap-2 px-6 py-5 rounded-xl border-2 transition cursor-pointer ${!isSubcategoryForm
                    ? "border-gold bg-[#FBF7F0]"
                    : "border-border bg-white hover:border-gold/40"
                  }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!isSubcategoryForm ? "bg-gold text-white" : "bg-[#F5F1EB] text-muted"}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
                <span className={`text-sm font-semibold ${!isSubcategoryForm ? "text-gold" : "text-muted"}`}>
                  Main category
                </span>
                <span className="text-xs text-[#B0AAA3] text-center leading-snug">
                  Appears at the top level in the app
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (parentOptions.length > 0 && !form.parentCategoryId) {
                    handleChange("parentCategoryId", parentOptions[0].id);
                  } else if (parentOptions.length > 0) {
                    handleChange("parentCategoryId", parentOptions[0].id);
                  }
                }}
                className={`flex-1 flex flex-col items-center gap-2 px-6 py-5 rounded-xl border-2 transition cursor-pointer ${isSubcategoryForm
                    ? "border-gold bg-[#FBF7F0]"
                    : "border-border bg-white hover:border-gold/40"
                  }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSubcategoryForm ? "bg-gold text-white" : "bg-[#F5F1EB] text-muted"}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 014-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 01-4 4H3" />
                  </svg>
                </div>
                <span className={`text-sm font-semibold ${isSubcategoryForm ? "text-gold" : "text-muted"}`}>
                  Subcategory
                </span>
                <span className="text-xs text-[#B0AAA3] text-center leading-snug">
                  Belongs inside a main category
                </span>
              </button>
            </div>

            {/* Parent selector */}
            {isSubcategoryForm && (
              <div className="flex flex-col gap-2">
                <label className="text-base font-semibold text-text">
                  Parent category <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-muted -mt-1">Which main category does this belong to?</p>
                <select
                  value={form.parentCategoryId}
                  onChange={(e) => handleChange("parentCategoryId", e.target.value)}
                  className="rounded-xl border border-border bg-surface px-5 py-4 text-lg text-text focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition appearance-none"
                >
                  <option value="">Select a category...</option>
                  {parentOptions.filter((c) => c.isActive).map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── Section C: Presentation ──────────────────────────────────── */}
        {!isSubcategoryForm && (
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-border bg-surface">
              <h2 className="text-xl font-bold text-text">Presentation</h2>
              <p className="text-sm text-muted mt-1">How this category appears in the app</p>
            </div>
            <div className="px-8 py-8 flex flex-col gap-6">

              {/* Icon name */}
              <div className="flex flex-col gap-2">
                <label className="text-base font-semibold text-text">Icon name</label>
                <p className="text-sm text-muted -mt-1">
                  The icon identifier used in the app (e.g. <span className="font-mono">utensils</span>,{" "}
                  <span className="font-mono">museum</span>). Leave empty if not needed.
                </p>
                <input
                  type="text"
                  value={form.iconName}
                  onChange={(e) => handleChange("iconName", e.target.value)}
                  placeholder="e.g. utensils"
                  className="rounded-xl border border-border bg-surface px-5 py-4 text-lg font-mono text-text placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition"
                />
              </div>

              {/* Sort order */}
              <div className="flex flex-col gap-2">
                <label className="text-base font-semibold text-text">Display order</label>
                <p className="text-sm text-muted -mt-1">
                  Lower numbers appear first. Use <span className="font-mono">0</span> for the top position.
                </p>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.sortOrder}
                  onChange={(e) => handleChange("sortOrder", e.target.value)}
                  className={`rounded-xl border bg-surface px-5 py-4 text-lg text-text focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition max-w-[160px] ${errors.sortOrder ? "border-red-400 ring-2 ring-red-200" : "border-border"
                    }`}
                />
                {errors.sortOrder && <p className="text-sm text-red-600">{errors.sortOrder}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Section D: Visibility (edit only) ───────────────────────── */}
        {mode === "edit" && (
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-border bg-surface">
              <h2 className="text-xl font-bold text-text">Visibility</h2>
              <p className="text-sm text-muted mt-1">Control whether this category is visible in the app</p>
            </div>
            <div className="px-8 py-8">
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => handleChange("isActive", !form.isActive)}
                className="flex items-center gap-4 cursor-pointer group"
              >
                <div className={`relative w-12 h-6 rounded-full transition-colors ${form.isActive ? "bg-gold" : "bg-[#D8D4CE]"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-6" : "translate-x-0"}`} />
                </div>
                <div>
                  <p className="text-base font-semibold text-text group-hover:text-gold transition-colors">
                    {form.isActive ? "Active — visible in app" : "Inactive — hidden from app"}
                  </p>
                  <p className="text-sm text-muted mt-0.5">
                    {form.isActive
                      ? "This category appears in navigation and filters."
                      : "This category is hidden. Places assigned to it are not affected."}
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Primary actions ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <Link
            href="/categories"
            className="px-8 py-4 rounded-xl border border-border text-lg font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saveStatus === "saving"}
            className="px-8 py-4 rounded-xl bg-gold text-white text-lg font-semibold hover:bg-gold-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saveStatus === "saving"
              ? "Saving…"
              : mode === "create"
                ? "Create category"
                : "Save changes"}
          </button>
        </div>

        {/* ── Archive action (edit only) ────────────────────────────────── */}
        {mode === "edit" && categoryId && (
          <div className="border-t border-border pt-6 mt-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-text">Archive this category</p>
                <p className="text-sm text-muted mt-0.5">
                  Archiving hides it from the app and dropdowns. Existing place links are not removed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowArchiveDialog(true)}
                className="shrink-0 px-5 py-3 rounded-xl border border-border text-sm font-semibold text-muted hover:border-red-300 hover:text-red-600 transition-colors bg-white cursor-pointer"
              >
                Archive
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Archive confirmation dialog */}
      <ConfirmDialog
        open={showArchiveDialog}
        title="Archive this category?"
        description={`"${form.name}" will be hidden from the app and all dropdowns. Places already linked to it will not be changed.`}
        confirmLabel={isArchiving ? "Archiving…" : "Yes, archive"}
        onConfirm={() => { void handleArchive() }}
        onCancel={() => setShowArchiveDialog(false)}
        variant="danger"
      />
    </>
  );
}