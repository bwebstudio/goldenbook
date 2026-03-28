"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { UIRouteDetail } from "@/types/ui/route";
import type { UIPlace } from "@/types/ui/place";
import {
  type RouteFormValues,
  type RouteFormErrors,
  type RouteFormStop,
  EMPTY_ROUTE_FORM,
  validateRouteForm,
  isRouteFormValid,
} from "@/types/forms/route";
import { createRoute, updateRoute, setRoutePlaces, archiveRoute } from "@/lib/api/routes";
import { ApiError } from "@/lib/api/client";
import FormSection from "@/components/ui/FormSection";
import InputField from "@/components/ui/InputField";
import SelectField from "@/components/ui/SelectField";
import Toggle from "@/components/ui/Toggle";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const statusOptions: { value: RouteFormValues["status"]; label: string }[] = [
  { value: "draft",     label: "Draft — Not visible to app users" },
  { value: "published", label: "Published — Visible to all users" },
  { value: "archived",  label: "Archived — Hidden and no longer active" },
];

const routeTypeOptions = [
  { value: "walking", label: "Walking" },
  { value: "driving", label: "Driving" },
  { value: "cycling", label: "Cycling" },
  { value: "curated", label: "Curated (mixed)" },
];

// ─── Stop card ─────────────────────────────────────────────────────────────────

interface StopCardProps {
  stop:       RouteFormStop;
  index:      number;
  total:      number;
  onMoveUp:   () => void;
  onMoveDown: () => void;
  onRemove:   () => void;
  onNoteChange: (note: string) => void;
}

function StopCard({ stop, index, total, onMoveUp, onMoveDown, onRemove, onNoteChange }: StopCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-stretch">
        {/* Stop number */}
        <div className="w-14 shrink-0 bg-[#FBF7F0] flex items-center justify-center border-r border-border">
          <span className="text-xl font-bold text-gold">{index + 1}</span>
        </div>

        {/* Place image */}
        <div className="w-20 shrink-0 relative overflow-hidden bg-[#F0EFED]">
          {stop.image ? (
            <Image
              src={stop.image}
              alt={stop.name}
              fill
              className="object-cover"
              sizes="80px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B0AAA3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 min-w-0">
          <p className="text-base font-bold text-text leading-tight truncate">{stop.name}</p>
          {stop.city && (
            <p className="text-sm text-muted mt-0.5">{stop.city}</p>
          )}
          {/* Optional note */}
          <input
            type="text"
            value={stop.note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Add an internal note for this stop… (optional)"
            className="mt-3 w-full text-sm rounded-lg border border-border bg-surface px-4 py-2.5 text-text placeholder:text-[#B0AAA3] focus:outline-none focus:ring-2 focus:border-gold focus:ring-gold/20 transition"
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center justify-center gap-1 px-4 border-l border-border shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F0EFED] text-muted hover:text-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Move down"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F0EFED] text-muted hover:text-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Remove from route"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors cursor-pointer mt-1"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Place picker result ───────────────────────────────────────────────────────

interface PickerRowProps {
  place:    UIPlace;
  added:    boolean;
  onAdd:    () => void;
}

function PickerRow({ place, added, onAdd }: PickerRowProps) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface transition-colors">
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative bg-[#F0EFED]">
        {place.mainImage ? (
          <Image
            src={place.mainImage}
            alt={place.name}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-lg font-bold text-gold/60">{place.name.charAt(0)}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-text leading-tight truncate">{place.name}</p>
        <p className="text-sm text-muted mt-0.5">
          {place.city}{place.category ? ` · ${place.category}` : ""}
        </p>
      </div>

      {/* Add button */}
      {added ? (
        <span className="text-sm font-semibold text-green-600 shrink-0 px-1">✓ Added</span>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gold text-gold text-sm font-semibold hover:bg-gold hover:text-white transition-colors cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      )}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RouteFormProps {
  route?:           UIRouteDetail;
  cities?:          { slug: string; name: string }[];
  availablePlaces?: UIPlace[];
}

// ─── Main form ─────────────────────────────────────────────────────────────────

export default function RouteForm({
  route,
  cities          = [],
  availablePlaces = [],
}: RouteFormProps) {
  const router    = useRouter();
  const isEditing = !!route;

  // ── Form state ──────────────────────────────────────────────────────────────

  const [form, setForm] = useState<RouteFormValues>(() => {
    if (!route) return { ...EMPTY_ROUTE_FORM };
    return {
      title:            route.title,
      slug:             route.slug,
      summary:          route.summary ?? "",
      body:             route.body    ?? "",
      citySlug:         route.citySlug,
      routeType:        route.routeType,
      estimatedMinutes: route.estimatedMinutes != null ? String(route.estimatedMinutes) : "",
      featured:         route.featured,
      status:           route.status,
    };
  });

  const [stops, setStops] = useState<RouteFormStop[]>(() => {
    if (!route) return [];
    return route.stops.map((s) => ({
      id:          s.id,
      slug:        s.slug,
      name:        s.name,
      note:        s.note,
      image:       s.image,
      city:        s.city,
    }));
  });

  const [errors,            setErrors]           = useState<RouteFormErrors>({});
  const [isDirty,           setIsDirty]          = useState(false);
  const [saveError,         setSaveError]        = useState<string | null>(null);
  const [saveStatus,        setSaveStatus]       = useState<"idle" | "saving" | "success">("idle");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Picker state
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // ── Unsaved changes guard ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isDirty) return;
    function guard(e: BeforeUnloadEvent) { e.preventDefault(); }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [isDirty]);

  // ── Field helpers ──────────────────────────────────────────────────────────

  function setField<K extends keyof RouteFormValues>(key: K, value: RouteFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleTitleChange(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: isEditing ? prev.slug : toSlug(title),
    }));
    setIsDirty(true);
    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
    if (errors.slug)  setErrors((prev) => ({ ...prev, slug: undefined }));
  }

  // ── Stop helpers ───────────────────────────────────────────────────────────

  const addedIds = new Set(stops.map((s) => s.id));

  function addStop(place: UIPlace) {
    setStops((prev) => [...prev, {
      id:    place.id,
      slug:  place.slug,
      name:  place.name,
      note:  "",
      image: place.mainImage,
      city:  place.city,
    }]);
    setIsDirty(true);
  }

  function removeStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }

  function moveStop(index: number, direction: "up" | "down") {
    setStops((prev) => {
      const next  = [...prev];
      const swap  = direction === "up" ? index - 1 : index + 1;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
    setIsDirty(true);
  }

  function updateStopNote(index: number, note: string) {
    setStops((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], note };
      return next;
    });
    setIsDirty(true);
  }

  // ── Picker filter ──────────────────────────────────────────────────────────

  const pickerResults = availablePlaces.filter((p) => {
    const q = pickerSearch.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    const validationErrors = validateRouteForm(form);
    setErrors(validationErrors);

    if (!isRouteFormValid(validationErrors)) {
      const firstKey = Object.keys(validationErrors)[0] as keyof RouteFormValues;
      document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);

    try {
      const payload = {
        title:            form.title,
        slug:             form.slug,
        summary:          form.summary   || undefined,
        body:             form.body      || undefined,
        citySlug:         form.citySlug,
        routeType:        form.routeType,
        estimatedMinutes: form.estimatedMinutes !== "" ? Number(form.estimatedMinutes) : undefined,
        featured:         form.featured,
        status:           form.status,
      };

      const placesPayload = {
        places: stops.map((s, i) => ({
          placeId:   s.id,
          sortOrder: i,
          note:      s.note || undefined,
        })),
      };

      if (isEditing) {
        await updateRoute(route.id, payload);
        await setRoutePlaces(route.id, placesPayload);
        setIsDirty(false);
        setSaveStatus("success");
        router.refresh();
      } else {
        const created = await createRoute(payload);
        await setRoutePlaces(created.id, placesPayload);
        router.push(`/routes/${created.id}`);
      }
    } catch (err) {
      setSaveStatus("idle");
      setSaveError(
        err instanceof ApiError
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    }
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────

  const handleCancelClick = useCallback(() => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      router.push("/routes");
    }
  }, [isDirty, router]);

  // ── Archive ────────────────────────────────────────────────────────────────

  async function confirmArchive() {
    setShowArchiveConfirm(false);
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await archiveRoute(route!.id);
      router.push("/routes");
    } catch (err) {
      setSaveStatus("idle");
      setSaveError(
        err instanceof ApiError ? err.message : "Could not archive this route. Please try again."
      );
    }
  }

  // ── City dropdown options ──────────────────────────────────────────────────

  const cityOptions = cities.map((c) => ({ value: c.slug, label: c.name }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-6 pb-32">

        {/* ── Save error ── */}
        {saveError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Save failed.</span>{" "}{saveError}
            </p>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="shrink-0 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
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

        {/* ── A. Basic information ── */}
        <FormSection
          title="Basic information"
          description="The title and description of this route."
        >
          <InputField
            id="title"
            label="Route title"
            value={form.title}
            onChange={handleTitleChange}
            placeholder="e.g. Hidden Gems of Alfama"
            required
            error={errors.title}
          />
          <InputField
            id="slug"
            label="Slug"
            hint="Used in the URL. Generated automatically from the title."
            value={form.slug}
            onChange={(v) => setField("slug", v)}
            placeholder="hidden-gems-alfama"
            error={errors.slug}
          />
          <InputField
            id="summary"
            label="Short description"
            hint="One or two sentences shown on route cards in the app."
            value={form.summary}
            onChange={(v) => setField("summary", v)}
            placeholder="A brief summary of this route"
          />
          <InputField
            id="body"
            label="Full description"
            hint="Shown on the route detail page inside the app."
            value={form.body}
            onChange={(v) => setField("body", v)}
            placeholder="Write a fuller description of this curated journey…"
            multiline
            rows={5}
          />
        </FormSection>

        {/* ── B. Destination & settings ── */}
        <FormSection
          title="Destination & settings"
          description="Where this route takes place and how it is classified."
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
          <div className="grid grid-cols-2 gap-6">
            <SelectField
              id="routeType"
              label="Route type"
              hint="How users will travel between stops."
              value={form.routeType}
              onChange={(v) => setField("routeType", v)}
              options={routeTypeOptions}
            />
            <InputField
              id="estimatedMinutes"
              label="Estimated duration"
              hint="Total time in minutes (e.g. 90)."
              value={form.estimatedMinutes}
              onChange={(v) => setField("estimatedMinutes", v)}
              placeholder="90"
              type="number"
              error={errors.estimatedMinutes}
            />
          </div>
          <SelectField
            id="status"
            label="Status"
            hint="Controls whether this route is visible in the app."
            value={form.status}
            onChange={(v) => setField("status", v as RouteFormValues["status"])}
            options={statusOptions}
            required
          />
        </FormSection>

        {/* ── C. Highlights ── */}
        <FormSection
          title="Highlights"
          description="Special flags that affect how this route appears in the app."
        >
          <Toggle
            label="Featured route"
            description="Shown prominently in the app's featured section."
            checked={form.featured}
            onChange={(v) => setField("featured", v)}
          />
        </FormSection>

        {/* ── D. Route stops ── */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Section header */}
          <div className="px-8 py-5 border-b border-border bg-surface">
            <h2 className="text-xl font-bold text-text">Route stops</h2>
            <p className="text-sm text-muted mt-1">
              Add places to this route and arrange them in the order users will visit them.
            </p>
          </div>

          <div className="px-8 py-8 flex flex-col gap-5">

            {/* Stops list or empty state */}
            {stops.length > 0 ? (
              <div className="flex flex-col gap-3">
                {stops.map((stop, i) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    index={i}
                    total={stops.length}
                    onMoveUp={() => moveStop(i, "up")}
                    onMoveDown={() => moveStop(i, "down")}
                    onRemove={() => removeStop(i)}
                    onNoteChange={(note) => updateStopNote(i, note)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface px-8 py-10 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#FBF7F0] flex items-center justify-center text-gold">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-text">No stops yet</p>
                <p className="text-sm text-muted max-w-xs">
                  Use the search below to find and add places to this route.
                </p>
              </div>
            )}

            {/* Add a place — picker */}
            <div className="border border-border rounded-2xl overflow-hidden">
              {/* Picker toggle */}
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="w-full flex items-center justify-between px-6 py-4 bg-surface hover:bg-[#F5F1EB] transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2 text-base font-semibold text-text">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add a place to this route
                </span>
                <svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-muted transition-transform ${pickerOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Picker body */}
              {pickerOpen && (
                <div className="border-t border-border">
                  {/* Search input */}
                  <div className="px-5 py-4 border-b border-border">
                    <div className="relative">
                      <svg
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Search places by name, city, or category…"
                        className="w-full rounded-xl border border-border bg-white pl-11 pr-5 py-3 text-base text-text placeholder:text-[#B0AAA3] focus:outline-none focus:ring-2 focus:border-gold focus:ring-gold/20 transition"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Results */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#F0EFED]">
                    {pickerResults.length === 0 ? (
                      <div className="px-5 py-8 text-center text-sm text-muted">
                        {pickerSearch
                          ? "No places match your search. Try a different name or city."
                          : "No places available. Make sure the backend is running."}
                      </div>
                    ) : (
                      pickerResults.map((place) => (
                        <PickerRow
                          key={place.id}
                          place={place}
                          added={addedIds.has(place.id)}
                          onAdd={() => {
                            addStop(place);
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Danger zone (edit only) ── */}
        {isEditing && (
          <div className="rounded-2xl border border-red-100 bg-red-50/50 px-6 py-6 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-red-700">Danger zone</h3>
              <p className="text-sm text-red-600 mt-1">
                Archiving this route will hide it from the app. It can be restored by
                changing its status back to Published.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(true)}
                className="px-5 py-2.5 rounded-xl border border-red-200 text-sm font-semibold text-red-600 bg-white hover:bg-red-50 transition-colors cursor-pointer"
              >
                Archive this route
              </button>
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
              isEditing ? "Save changes" : "Create route"
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
        onConfirm={() => { setShowCancelConfirm(false); router.push("/routes"); }}
        onCancel={() => setShowCancelConfirm(false)}
      />

      {/* ── Confirm: archive route ── */}
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive this route?"
        description={`"${form.title}" will be hidden from the app. You can restore it later by setting its status back to Published.`}
        confirmLabel="Archive route"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmArchive}
        onCancel={() => setShowArchiveConfirm(false)}
      />
    </>
  );
}
