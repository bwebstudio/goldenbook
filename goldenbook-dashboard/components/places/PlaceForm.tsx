"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { UIPlaceDetail } from "@/types/ui/place";
import {
  type PlaceFormValues,
  type PlaceFormErrors,
  EMPTY_PLACE_FORM,
  validatePlaceForm,
  isFormValid,
} from "@/types/forms/place";
import { createPlace, updatePlace } from "@/lib/api/places";
import { ApiError } from "@/lib/api/client";
import FormSection from "@/components/ui/FormSection";
import InputField from "@/components/ui/InputField";
import SelectField from "@/components/ui/SelectField";
import Toggle from "@/components/ui/Toggle";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// Auto-generate slug from name
function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const statusOptions: { value: PlaceFormValues["status"]; label: string }[] = [
  { value: "draft",     label: "Draft — Not visible to users" },
  { value: "published", label: "Published — Visible to all users" },
  { value: "archived",  label: "Archived — Hidden and no longer active" },
];

interface CategoryOption {
  slug: string;
  name: string;
  subcategories: { slug: string; name: string }[];
}

interface PlaceFormProps {
  /** When provided, form is in edit mode and pre-populated with this data. */
  place?: UIPlaceDetail;
  /** City options for the dropdown — slug is the form value, name is the label. */
  cities?: { slug: string; name: string }[];
  /**
   * Category options including their subcategories.
   * Category dropdown shows the top-level list.
   * Subcategory dropdown is filtered to the selected category.
   */
  categories?: CategoryOption[];
}

export default function PlaceForm({ place, cities = [], categories = [] }: PlaceFormProps) {
  const router    = useRouter();
  const isEditing = !!place;

  // ── Form state ─────────────────────────────────────────────────────────────

  const [form, setForm] = useState<PlaceFormValues>(() => {
    if (!place) return { ...EMPTY_PLACE_FORM };
    return {
      ...EMPTY_PLACE_FORM,
      name:             place.name,
      slug:             place.slug,
      shortDescription: place.shortDescription ?? "",
      fullDescription:  place.fullDescription  ?? "",
      goldenbookNote:   place.goldenbookNote    ?? "",
      whyWeLoveIt:      place.whyWeLoveIt       ?? "",
      insiderTip:       place.insiderTip        ?? "",
      citySlug:         place.citySlug,
      address:          place.address           ?? "",
      website:          place.website           ?? "",
      phone:            place.phone             ?? "",
      email:            place.email             ?? "",
      bookingUrl:       place.bookingUrl        ?? "",
      categorySlug:     place.categories[0]?.slug    ?? "",
      subcategorySlug:  place.subcategories[0]?.slug ?? "",
      status:           "published",
      featured:         false,
      editorsPick:      false,
    };
  });

  const [errors,            setErrors]           = useState<PlaceFormErrors>({});
  const [isDirty,           setIsDirty]          = useState(false);
  const [saveError,         setSaveError]        = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveStatus,        setSaveStatus]       = useState<"idle" | "saving" | "success">("idle");

  // ── Unsaved changes guard ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // ── Field helpers ──────────────────────────────────────────────────────────

  function setField<K extends keyof PlaceFormValues>(key: K, value: PlaceFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: isEditing ? prev.slug : toSlug(name),
    }));
    setIsDirty(true);
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
    if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
  }

  // Clear subcategory whenever category changes — the previous subcategory
  // belongs to the old category and would be rejected by the backend.
  function handleCategoryChange(slug: string) {
    setForm((prev) => ({ ...prev, categorySlug: slug, subcategorySlug: "" }));
    setIsDirty(true);
    if (errors.categorySlug) setErrors((prev) => ({ ...prev, categorySlug: undefined }));
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    // 1. Validate
    const validationErrors = validatePlaceForm(form, isEditing);
    setErrors(validationErrors);

    if (!isFormValid(validationErrors)) {
      const firstErrorKey = Object.keys(validationErrors)[0];
      document.getElementById(firstErrorKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);

    try {
      const payload = {
        name:             form.name,
        slug:             form.slug             || undefined,
        shortDescription: form.shortDescription || undefined,
        fullDescription:  form.fullDescription  || undefined,
        goldenbookNote:   form.goldenbookNote   || undefined,
        whyWeLoveIt:      form.whyWeLoveIt      || undefined,
        insiderTip:       form.insiderTip       || undefined,
        citySlug:         form.citySlug,
        addressLine:      form.address          || undefined,
        websiteUrl:       form.website          || undefined,
        phone:            form.phone            || undefined,
        email:            form.email            || undefined,
        bookingUrl:       form.bookingUrl       || undefined,
        categorySlug:     form.categorySlug,
        subcategorySlug:  form.subcategorySlug  || undefined,
        status:           form.status,
        featured:         form.featured,
      };

      if (isEditing) {
        await updatePlace(place.id, payload);
        setIsDirty(false);
        setSaveStatus("success");
        router.refresh();
      } else {
        const result = await createPlace({ ...payload, slug: form.slug });
        // Navigate to the edit page of the newly created place so the user
        // can keep editing and the URL reflects the real place slug.
        router.push(`/places/${result.slug}`);
      }
    } catch (err) {
      setSaveStatus("idle");
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError("An unexpected error occurred. Please try again.");
      }
    }
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  const handleCancelClick = useCallback(() => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      router.push("/places");
    }
  }, [isDirty, router]);

  function confirmCancel() {
    setShowCancelConfirm(false);
    router.push("/places");
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function confirmDelete() {
    setShowDeleteConfirm(false);
    // TODO: Call DELETE /api/v1/admin/places/:id when the backend supports it.
  }

  // ── Derived dropdown options ───────────────────────────────────────────────

  const cityOptions     = cities.map((c) => ({ value: c.slug, label: c.name }));
  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.name }));

  // Subcategory options are scoped to the currently selected category.
  const selectedCategory  = categories.find((c) => c.slug === form.categorySlug);
  const subcategoryOptions = (selectedCategory?.subcategories ?? []).map((s) => ({
    value: s.slug,
    label: s.name,
  }));

  return (
    <>
      <div className="max-w-3xl flex flex-col gap-6 pb-32">

        {/* ── Save error ── */}
        {saveError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Save failed.</span>{" "}
              {saveError}
            </p>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="shrink-0 text-red-500 hover:text-red-700 transition-colors"
              aria-label="Dismiss"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Save success ── */}
        {saveStatus === "success" && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4">
            <p className="text-sm text-green-800 font-semibold">Changes saved.</p>
          </div>
        )}

        {/* ── A. Basic Information ── */}
        <FormSection
          title="Basic Information"
          description="The main details that describe this place."
        >
          <InputField
            id="name"
            label="Place name"
            value={form.name}
            onChange={handleNameChange}
            placeholder="e.g. Pastéis de Belém"
            required
            error={errors.name}
          />
          <InputField
            id="slug"
            label="Slug"
            hint="Used in the URL. Generated automatically from the name."
            value={form.slug}
            onChange={(v) => setField("slug", v)}
            placeholder="pasteis-de-belem"
            error={errors.slug}
          />
          <InputField
            id="shortDescription"
            label="Short description"
            hint="One sentence shown in search results and cards."
            value={form.shortDescription}
            onChange={(v) => setField("shortDescription", v)}
            placeholder="A brief summary of this place"
          />
          <InputField
            id="fullDescription"
            label="Full description"
            hint="Shown on the place detail page inside the app."
            value={form.fullDescription}
            onChange={(v) => setField("fullDescription", v)}
            placeholder="Write a complete description of this place..."
            multiline
            rows={5}
          />
        </FormSection>

        {/* ── B. Editorial Notes ── */}
        <FormSection
          title="Editorial Notes"
          description="Internal copy shown on the place detail screen in the app."
        >
          <InputField
            id="goldenbookNote"
            label="Goldenbook note"
            hint="A short curator's note about why this place is special."
            value={form.goldenbookNote}
            onChange={(v) => setField("goldenbookNote", v)}
            placeholder="What makes this place worth visiting?"
            multiline
            rows={3}
          />
          <InputField
            id="whyWeLoveIt"
            label="Why we love it"
            hint="Shown as a highlight on the detail page."
            value={form.whyWeLoveIt}
            onChange={(v) => setField("whyWeLoveIt", v)}
            placeholder="The reason Goldenbook recommends this place..."
            multiline
            rows={3}
          />
          <InputField
            id="insiderTip"
            label="Insider tip"
            hint="A local tip or hidden detail that makes the visit better."
            value={form.insiderTip}
            onChange={(v) => setField("insiderTip", v)}
            placeholder="e.g. Go early on weekdays to skip the queue."
          />
        </FormSection>

        {/* ── C. Location ── */}
        <FormSection
          title="Location"
          description="Where is this place located?"
        >
          <SelectField
            id="citySlug"
            label="City"
            value={form.citySlug}
            onChange={(v) => setField("citySlug", v)}
            options={cityOptions}
            placeholder="Select a city"
            required
            error={errors.citySlug}
          />
          <InputField
            id="address"
            label="Address"
            value={form.address}
            onChange={(v) => setField("address", v)}
            placeholder="Rua de Belém 84-92, 1300-085 Lisboa"
          />
        </FormSection>

        {/* ── D. Classification ── */}
        <FormSection
          title="Classification"
          description="How should this place be categorised in the app?"
        >
          <div className="grid grid-cols-2 gap-6">
            <SelectField
              id="categorySlug"
              label="Category"
              value={form.categorySlug}
              onChange={handleCategoryChange}
              options={categoryOptions}
              placeholder="Select a category"
              required
              error={errors.categorySlug}
            />
            <SelectField
              id="subcategorySlug"
              label="Subcategory"
              hint="Optional — filtered to the selected category."
              value={form.subcategorySlug}
              onChange={(v) => setField("subcategorySlug", v)}
              options={subcategoryOptions}
              placeholder={
                form.categorySlug
                  ? subcategoryOptions.length > 0
                    ? "Select a subcategory"
                    : "No subcategories for this category"
                  : "Select a category first"
              }
            />
          </div>
          <SelectField
            id="status"
            label="Status"
            hint="Controls whether this place is visible to app users."
            value={form.status}
            onChange={(v) => setField("status", v as PlaceFormValues["status"])}
            options={statusOptions}
            required
            error={errors.status}
          />
        </FormSection>

        {/* ── E. Contact & Links ── */}
        <FormSection
          title="Contact & Links"
          description="Optional contact details and online presence."
        >
          <div className="grid grid-cols-2 gap-6">
            <InputField
              id="website"
              label="Website"
              value={form.website}
              onChange={(v) => setField("website", v)}
              placeholder="https://example.com"
              type="url"
              error={errors.website}
            />
            <InputField
              id="phone"
              label="Phone number"
              value={form.phone}
              onChange={(v) => setField("phone", v)}
              placeholder="+351 213 000 000"
              type="tel"
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <InputField
              id="email"
              label="Email address"
              value={form.email}
              onChange={(v) => setField("email", v)}
              placeholder="contact@example.com"
              type="email"
              error={errors.email}
            />
            <InputField
              id="bookingUrl"
              label="Booking / Reservation"
              hint="A booking URL or phone number for reservations."
              value={form.bookingUrl}
              onChange={(v) => setField("bookingUrl", v)}
              placeholder="https://reservations.example.com or +351..."
              error={errors.bookingUrl}
            />
          </div>
        </FormSection>

        {/* ── F. Images ── */}
        <FormSection
          title="Images"
          description="The main photo shown in listings and on the place detail page."
        >
          {isEditing && place?.mainImage ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-muted">Current main image</p>
              <div className="relative w-full max-w-sm aspect-video rounded-xl overflow-hidden border border-border">
                <Image
                  src={place.mainImage}
                  alt={place.name}
                  fill
                  className="object-cover"
                  sizes="384px"
                />
              </div>
              <p className="text-sm text-muted">
                To replace this image, update it directly in{" "}
                <span className="font-semibold">Supabase Storage</span> and refresh the page.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
              <p className="text-base font-medium">No image yet</p>
              <p className="text-sm mt-1">
                Images are managed in Supabase Storage. Upload support will be added once the
                backend exposes media endpoints.
              </p>
            </div>
          )}
        </FormSection>

        {/* ── G. Highlights ── */}
        <FormSection
          title="Highlights"
          description="Special flags that affect how this place appears in the app."
        >
          <Toggle
            label="Featured place"
            description="Shown prominently in the app's featured section."
            checked={form.featured}
            onChange={(v) => setField("featured", v)}
          />
          <div className="border-t border-border" />
          <Toggle
            label="Editor's Pick"
            description="Marked as personally recommended by the Goldenbook team. (Backend support coming soon.)"
            checked={form.editorsPick}
            onChange={(v) => setField("editorsPick", v)}
          />
        </FormSection>

        {/* ── Danger Zone (edit only) ── */}
        {isEditing && (
          <div className="rounded-2xl border border-red-100 bg-red-50/50 px-6 py-6 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-red-700">Danger zone</h3>
              <p className="text-sm text-red-600 mt-1">
                Deleting a place is permanent and cannot be undone.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled
                title="Delete is not yet available — the backend endpoint is missing."
                className="px-5 py-2.5 rounded-xl border border-red-200 text-sm font-semibold text-red-400 bg-white cursor-not-allowed opacity-60"
              >
                Delete this place
              </button>
              <p className="text-xs text-red-400 mt-2">
                Not available yet — backend DELETE endpoint is missing.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky footer ── */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-border px-10 py-5 flex items-center gap-4 justify-between z-10">
        <p className="text-sm text-muted">
          {saveStatus === "saving"
            ? "Saving…"
            : isDirty
              ? "You have unsaved changes."
              : isEditing
                ? "No unsaved changes."
                : "Fill in the details above and save when ready."}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancelClick}
            className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saveStatus === "saving" ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Saving…
              </>
            ) : (
              isEditing ? "Save changes" : "Create place"
            )}
          </button>
        </div>
      </div>

      {/* ── Confirm: leave without saving ── */}
      <ConfirmDialog
        open={showCancelConfirm}
        title="Leave without saving?"
        description="You have unsaved changes on this page. If you leave now, your changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={confirmCancel}
        onCancel={() => setShowCancelConfirm(false)}
      />

      {/* ── Confirm: delete place ── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete this place?"
        description={`"${form.name}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete permanently"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
