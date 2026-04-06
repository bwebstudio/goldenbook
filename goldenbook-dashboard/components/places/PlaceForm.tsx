"use client";

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
import { createPlace, updatePlace, deletePlaceById } from "@/lib/api/places";
import { applySuggestion, dismissSuggestion, generateSuggestionForPlace } from "@/lib/api/suggestions";
import { ApiError } from "@/lib/api/client";
import { useT, useLocale } from "@/lib/i18n";
import FormSection from "@/components/ui/FormSection";
import InputField from "@/components/ui/InputField";
import SelectField from "@/components/ui/SelectField";
import Toggle from "@/components/ui/Toggle";
import PlaceCandidates from "@/components/places/PlaceCandidates";
import PlaceVisibility from "@/components/places/PlaceVisibility";
import PlaceNowVisibility, { type NowFormValues, EMPTY_NOW_FORM } from "@/components/places/PlaceNowVisibility";
import PlaceMedia from "@/components/places/PlaceMedia";
import PlaceTranslations from "@/components/places/PlaceTranslations";
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

// Status options are built inside the component to access translations

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
  /** Current user role — controls which sections are visible */
  userRole?: "super_admin" | "editor" | "business_client";
}

export default function PlaceForm({ place, cities = [], categories = [], userRole = "editor" }: PlaceFormProps) {
  const router    = useRouter();
  const t         = useT();
  const { locale } = useLocale();
  const isPt      = locale.startsWith("pt");
  const pf        = t.placeForm;
  const isEditing = !!place;

  const statusOptions: { value: PlaceFormValues["status"]; label: string }[] = [
    { value: "draft",     label: pf.statusDraft },
    { value: "published", label: pf.statusPublished },
    { value: "archived",  label: pf.statusArchived },
  ];

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
      citySlugs:        place.citySlugs?.length ? place.citySlugs : [place.citySlug],
      address:          place.address           ?? "",
      website:          place.website           ?? "",
      phone:            place.phone             ?? "",
      email:            place.email             ?? "",
      bookingUrl:       place.bookingUrl        ?? "",
      placeType:        place.placeType ?? "restaurant",
      categorySlug:     place.categories[0]?.slug    ?? "",
      subcategorySlug:  place.subcategories[0]?.slug ?? "",
      status:           "published",
      featured:         false,
      editorsPick:      false,
      reservationRelevant: place.reservationRelevant ?? false,
      bookingEnabled:      place.bookingEnabled ?? false,
      bookingMode:         place.bookingMode ?? "none",
      bookingLabel:        place.bookingLabel ?? "",
      bookingNotes:        place.bookingNotes ?? "",
      reservationSource:   place.reservationSource ?? "",
    };
  });

  const [nowForm, setNowForm] = useState<NowFormValues>({ ...EMPTY_NOW_FORM });
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
        insiderTip:       form.insiderTip       || undefined,
        citySlug:         form.citySlug || form.citySlugs[0] || '',
        citySlugs:        form.citySlugs,
        addressLine:      form.address          || undefined,
        websiteUrl:       form.website          || undefined,
        phone:            form.phone            || undefined,
        email:            form.email            || undefined,
        bookingUrl:       form.bookingUrl       || undefined,
        placeType:        form.placeType || undefined,
        categorySlug:     form.categorySlug,
        subcategorySlug:  form.subcategorySlug  || undefined,
        status:           form.status,
        featured:         form.featured,
        // Booking fields
        bookingEnabled:      form.bookingEnabled,
        bookingMode:         form.bookingMode,
        bookingLabel:        form.bookingLabel   || undefined,
        bookingNotes:        form.bookingNotes   || undefined,
        reservationRelevant: form.reservationRelevant,
        reservationSource:   form.reservationSource || undefined,
      };

      if (isEditing) {
        // Include editorial relevance fields (tags + time windows only).
        // Campaign fields (nowEnabled, nowPriority, nowFeatured, nowStartAt,
        // nowEndAt) are managed by the commercial/campaign system, not editors.
        const fullPayload = {
          ...payload,
          nowTagSlugs:   nowForm.nowTagSlugs,
          nowTimeWindows: nowForm.nowTimeWindows,
        };
        await updatePlace(place.id, fullPayload);
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

  async function confirmDelete() {
    setShowDeleteConfirm(false);
    if (!place) return;
    try {
      await deletePlaceById(place.id);
      router.push("/places");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not delete this place.");
    }
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
              <span className="font-semibold">{pf.saveFailed}</span>{" "}
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
            <p className="text-sm text-green-800 font-semibold">{pf.changesSaved}</p>
          </div>
        )}

        {/* ── A. Basic Information ── */}
        <FormSection
          title={pf.basicInfo}
          description={pf.basicInfoDesc}
        >
          <InputField
            id="name"
            label={pf.placeName}
            value={form.name}
            onChange={handleNameChange}
            placeholder="e.g. Pastéis de Belém"
            required
            error={errors.name}
          />
          <InputField
            id="slug"
            label={pf.slug}
            hint={pf.slugHint}
            value={form.slug}
            onChange={(v) => setField("slug", v)}
            placeholder="pasteis-de-belem"
            error={errors.slug}
          />
          <InputField
            id="shortDescription"
            label={pf.shortDescription}
            hint={pf.shortDescHint}
            value={form.shortDescription}
            onChange={(v) => setField("shortDescription", v)}
            placeholder={pf.phShortDesc}
          />
          <InputField
            id="fullDescription"
            label={pf.fullDescription}
            hint={pf.fullDescHint}
            value={form.fullDescription}
            onChange={(v) => setField("fullDescription", v)}
            placeholder={pf.phFullDesc}
            multiline
            rows={5}
          />
        </FormSection>

        {/* ── B. Editorial Notes ── */}
        <FormSection
          title={pf.editorialNotes}
          description={pf.editorialNotesDesc}
        >
          <InputField
            id="goldenbookNote"
            label={pf.goldenbookNote}
            hint={pf.goldenbookNoteHint}
            value={form.goldenbookNote}
            onChange={(v) => setField("goldenbookNote", v)}
            placeholder={pf.phGoldenbookNote}
            multiline
            rows={3}
          />
          <InputField
            id="insiderTip"
            label={pf.insiderTip}
            hint={pf.insiderTipHint}
            value={form.insiderTip}
            onChange={(v) => setField("insiderTip", v)}
            placeholder={pf.phInsiderTip}
          />
        </FormSection>

        {/* ── B2. English Translations ── */}
        {isEditing && place && (
          <FormSection
            title={pf.enTranslation}
            description={pf.autoTranslated}
          >
            <PlaceTranslations placeId={place.id} />
          </FormSection>
        )}

        {/* ── C. Location ── */}
        <FormSection
          title={pf.location}
          description={pf.locationDesc}
        >
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              {pf.city} <span className="text-red-400">*</span>
            </label>
            <p className="text-[11px] text-muted mb-2">Select all cities where this establishment is present.</p>
            <div className="flex flex-wrap gap-2">
              {cityOptions.map((opt) => {
                const isSelected = form.citySlugs.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? form.citySlugs.filter((s) => s !== opt.value)
                        : [...form.citySlugs, opt.value];
                      setField("citySlugs", next);
                      // Keep citySlug in sync as primary (first selected)
                      if (next.length > 0 && !next.includes(form.citySlug)) {
                        setField("citySlug", next[0]);
                      } else if (next.length === 0) {
                        setField("citySlug", "");
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                      isSelected
                        ? "bg-gold/10 text-gold border-gold/30"
                        : "bg-white border-border text-muted hover:border-gold/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {errors.citySlug && <p className="text-xs text-red-500 mt-1">{errors.citySlug}</p>}
          </div>
          <InputField
            id="address"
            label={pf.address}
            value={form.address}
            onChange={(v) => setField("address", v)}
            placeholder={pf.phAddress}
          />
        </FormSection>

        {/* ── D. Classification ── */}
        <FormSection
          title={pf.classification}
          description={pf.classificationDesc}
        >
          {userRole === "super_admin" && (
            <SelectField
              id="placeType"
              label={isPt ? "Tipo de espaço" : "Place Type"}
              hint={isPt ? "Determina como este espaço aparece nas recomendações" : "Determines how this place appears in recommendations"}
              value={form.placeType}
              onChange={(v) => setField("placeType", v)}
              options={[
                { value: "restaurant", label: isPt ? "Restaurante" : "Restaurant" },
                { value: "bar",        label: "Bar" },
                { value: "cafe",       label: "Café" },
                { value: "hotel",      label: "Hotel" },
                { value: "shop",       label: isPt ? "Loja" : "Shop" },
                { value: "museum",     label: isPt ? "Museu" : "Museum" },
                { value: "landmark",   label: isPt ? "Monumento / Local de interesse" : "Landmark" },
                { value: "activity",   label: isPt ? "Atividade" : "Activity" },
                { value: "beach",      label: isPt ? "Praia" : "Beach" },
                { value: "venue",      label: isPt ? "Espaço / Sala" : "Venue" },
              ]}
            />
          )}
          <div className="grid grid-cols-2 gap-6">
            <SelectField
              id="categorySlug"
              label={pf.category}
              value={form.categorySlug}
              onChange={handleCategoryChange}
              options={categoryOptions}
              placeholder={pf.selectCategory}
              required
              error={errors.categorySlug}
            />
            <SelectField
              id="subcategorySlug"
              label={pf.subcategory}
              hint={pf.subcategoryHint}
              value={form.subcategorySlug}
              onChange={(v) => setField("subcategorySlug", v)}
              options={subcategoryOptions}
              placeholder={
                form.categorySlug
                  ? subcategoryOptions.length > 0
                    ? pf.selectSubcategory
                    : pf.noSubcategories
                  : pf.selectCategoryFirst
              }
            />
          </div>
          <SelectField
            id="status"
            label={pf.statusLabel}
            hint={pf.statusHint}
            value={form.status}
            onChange={(v) => setField("status", v as PlaceFormValues["status"])}
            options={statusOptions}
            required
            error={errors.status}
          />
        </FormSection>

        {/* ── E. Contact & Links ── */}
        <FormSection
          title={pf.contactLinks}
          description={pf.contactLinksDesc}
        >
          <div className="grid grid-cols-2 gap-6">
            <InputField
              id="website"
              label={pf.website}
              value={form.website}
              onChange={(v) => setField("website", v)}
              placeholder="https://example.com"
              type="url"
              error={errors.website}
            />
            <InputField
              id="phone"
              label={pf.phoneNumber}
              value={form.phone}
              onChange={(v) => setField("phone", v)}
              placeholder="+351 213 000 000"
              type="tel"
            />
          </div>
          <InputField
            id="email"
            label={pf.emailAddress}
            value={form.email}
            onChange={(v) => setField("email", v)}
            placeholder="contact@example.com"
            type="email"
            error={errors.email}
          />
        </FormSection>

        {/* ── F. Reservation ── */}
        {isEditing && place && (
          <FormSection
            title={pf.reservation}
            description={pf.reservationDesc}
          >
            <PlaceCandidates
              placeId={place.id}
              reservable={form.reservationRelevant}
              onReservableChange={(v) => setField("reservationRelevant", v)}
            />
          </FormSection>
        )}

        {/* ── G. Visibility — super_admin only ── */}
        {isEditing && place && userRole === "super_admin" && (
          <FormSection
            title={pf.visibility}
            description={pf.visibilityDesc}
          >
            <PlaceVisibility placeId={place.id} />
          </FormSection>
        )}

        {/* ── H. Contextual Relevance (tags + time windows for NOW / Concierge) ── */}
        {isEditing && place && (
          <FormSection
            title={isPt ? "Relevância contextual" : "Contextual relevance"}
            description={isPt ? "Define os momentos e contextos em que este espaço é mais relevante." : "Define the moments and contexts in which this place is most relevant."}
          >
            <PlaceNowVisibility
              placeId={place.id}
              placeType={form.placeType}
              value={nowForm}
              onChange={(next) => { setNowForm(next); setIsDirty(true); }}
            />
          </FormSection>
        )}

        {/* ── I. Images ── */}
        {isEditing && place && (
          <FormSection
            title={pf.images}
            description={pf.imagesDesc}
          >
            <PlaceMedia placeId={place.id} userRole={userRole} />
          </FormSection>
        )}

        {/* ── Danger Zone (edit only) ── */}
        {isEditing && (
          <div className="rounded-2xl border border-red-100 bg-red-50/50 px-6 py-6 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-red-700">{pf.dangerZone}</h3>
              <p className="text-sm text-red-600 mt-1">{pf.dangerZoneDesc}</p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-5 py-2.5 rounded-xl border border-red-200 text-sm font-semibold text-red-600 bg-white hover:bg-red-50 transition-colors cursor-pointer"
              >
                {pf.deletePlace}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky footer ── */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-border px-10 py-5 flex items-center gap-4 justify-between z-10">
        <p className="text-sm text-muted">
          {saveStatus === "saving"
            ? pf.saving
            : isDirty
              ? pf.unsavedChanges
              : isEditing
                ? pf.noUnsavedChanges
                : pf.fillAndSave}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancelClick}
            className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white cursor-pointer"
          >
            {t.common.cancel}
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
                {pf.saving}
              </>
            ) : (
              isEditing ? t.common.save : pf.createPlace
            )}
          </button>
        </div>
      </div>

      {/* ── Confirm: leave without saving ── */}
      <ConfirmDialog
        open={showCancelConfirm}
        title={pf.leaveTitle}
        description={pf.leaveDesc}
        confirmLabel={pf.leave}
        cancelLabel={pf.stay}
        variant="danger"
        onConfirm={confirmCancel}
        onCancel={() => setShowCancelConfirm(false)}
      />

      {/* ── Confirm: delete place ── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title={pf.deleteTitle}
        description={`"${form.name}" — ${pf.dangerZoneDesc}`}
        confirmLabel={pf.deleteConfirm}
        cancelLabel={t.common.cancel}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
