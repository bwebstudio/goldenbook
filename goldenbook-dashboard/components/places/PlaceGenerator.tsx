"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { searchGooglePlaces, previewPlaceFromGoogle, createPlace, ingestGooglePhotos, fetchAdminCategories, type PlacePreview } from "@/lib/api/places";
import type { AdminCategoryDTO } from "@/types/api/place";
import { ApiError } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n";

// Slug helper: keep in sync with backend SLUG_RE (lowercase, a-z 0-9 and
// hyphens). Strips diacritics so "Café d'Olivença" → "cafe-d-olivenca".
function slugify(input: string): string {
  // Strip combining diacritics (U+0300–U+036F) after NFD-normalising, so
  // "Café d'Olivença" becomes "cafe-d-olivenca" — matching backend SLUG_RE.
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CITIES = [
  { slug: 'algarve', name: 'Algarve' },
  { slug: 'lisboa', name: 'Lisboa' },
  { slug: 'madeira', name: 'Madeira' },
  { slug: 'porto', name: 'Porto' },
] as const;

const PLACE_TYPES = [
  'restaurant', 'bar', 'cafe', 'hotel', 'shop', 'museum',
  'landmark', 'activity', 'beach', 'venue', 'transport', 'other',
] as const;

// Shared input class string. Mirrors the convention used elsewhere in the
// dashboard (PlaceForm, etc.) so manual entry fields look identical to the
// rest of the editor. Avoid styled-jsx here — Next 16 + Turbopack ships
// without the explicit styled-jsx setup the rest of this project assumes,
// and the previous `<style jsx>` block was crashing the page at runtime.
const INPUT_CLS =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-white text-sm text-text " +
  "placeholder:text-muted/50 focus:outline-none focus:border-gold/50 focus:ring-2 " +
  "focus:ring-gold/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed";

interface GoogleResult {
  placeId: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
}

export default function PlaceGenerator() {
  const cities = CITIES;
  const router = useRouter();
  const { locale } = useLocale();
  const isPt = locale.startsWith("pt");

  const [manualMode, setManualMode] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleResult[]>([]);
  const [selected, setSelected] = useState<GoogleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlacePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Manual entry mode: editor adds an establishment that isn't on Google Maps
  // (e.g. a brand-new pop-up, a tiny shop without any web presence, or a
  // place that only exists on Booking.com / Facebook). Renders an inline
  // form that hits the same POST /admin/places endpoint with sourceLocale='pt'.
  if (manualMode) {
    return <ManualEntryForm onCancel={() => setManualMode(false)} />;
  }

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    setSelected(null);
    setPreview(null);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchGooglePlaces(value);
        setResults(res);
      } catch (e) {
        console.error("[search-google] failed:", e);
        let msg: string;
        if (e instanceof ApiError) {
          const code = typeof e.data?.error === "string" ? ` (${e.data.error})` : "";
          msg = `${e.status} ${e.message}${code}`;
        } else {
          msg = e instanceof Error ? e.message : String(e);
        }
        setError(isPt ? `Erro a pesquisar: ${msg}` : `Search error: ${msg}`);
        setResults([]);
      }
      finally { setSearching(false); }
    }, 350);
  }, [isPt]);

  const handleSelect = (result: GoogleResult) => {
    setSelected(result);
    setQuery(result.name);
    setResults([]);
    setPreview(null);
    setError(null);
  };

  // Generate preview (does NOT create)
  const handleGenerate = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const data = await previewPlaceFromGoogle(selected.placeId);
      setPreview(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { existingSlug?: string };
        setError(
          isPt
            ? `Este estabelecimento já existe na base de dados.${data.existingSlug ? ` Ver: /places/${data.existingSlug}` : ''}`
            : `This establishment already exists in the database.${data.existingSlug ? ` See: /places/${data.existingSlug}` : ''}`
        );
      } else {
        setError(err instanceof Error ? err.message : isPt ? "Erro ao gerar." : "Error generating.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Save (actually creates the place)
  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    setSavePhase(isPt ? "A criar..." : "Creating...");
    setError(null);

    try {
      // Determine booking config based on place type
      const reservableTypes = new Set(["restaurant", "cafe", "bar", "hotel", "activity", "venue"]);
      const isReservable = reservableTypes.has(preview.placeType);
      const bookingUrl = isReservable
        ? (preview.websiteUrl ?? preview.googleMapsUrl ?? undefined)
        : undefined;

      const result = await createPlace({
        name: preview.name,
        slug: preview.slug,
        citySlug: preview.citySlug,
        placeType: preview.placeType,
        categorySlug: preview.categorySlug,
        subcategorySlug: preview.subcategorySlug,
        // Google Places returns English text. The backend translates
        // EN → PT before persisting the canonical row, so the editor
        // sees Portuguese as the main editorial content immediately.
        sourceLocale: "en",
        shortDescription: preview.shortDescription,
        fullDescription: preview.fullDescription,
        goldenbookNote: preview.goldenbookNote,
        insiderTip: preview.insiderTip,
        addressLine: preview.addressLine ?? undefined,
        phone: preview.phone ?? undefined,
        websiteUrl: preview.websiteUrl ?? undefined,
        bookingUrl,
        status: "published",
        featured: false,
        // Google enrichment
        googlePlaceId: preview.googlePlaceId,
        googleMapsUrl: preview.googleMapsUrl ?? undefined,
        googleRating: preview.googleRating ?? undefined,
        googleRatingCount: preview.googleRatingCount ?? undefined,
        latitude: preview.latitude ?? undefined,
        longitude: preview.longitude ?? undefined,
        priceTier: preview.priceTier ?? undefined,
        // Booking config
        bookingEnabled: isReservable && !!bookingUrl,
        bookingMode: isReservable && bookingUrl ? "direct_website" : "none",
        reservationRelevant: isReservable,
      });

      // Ingest Google photos BEFORE redirect (otherwise navigation cancels the request)
      if (preview.photoNames.length > 0 && result.id) {
        setSavePhase(isPt ? "A importar fotografias..." : "Importing photos...");
        try {
          await ingestGooglePhotos(result.id, preview.photoNames);
        } catch (e) {
          console.warn("Photo ingestion failed:", e);
        }
      }

      // Redirect to edit page
      router.push(`/places/${result.slug}`);
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && err.status === 409) {
        setError(isPt ? "Este estabelecimento já existe (slug duplicado)." : "This establishment already exists (duplicate slug).");
      } else {
        setError(err instanceof Error ? err.message : isPt ? "Erro ao guardar." : "Error saving.");
      }
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const cityName = (slug: string) => cities.find(c => c.slug === slug)?.name ?? slug;

  // ── Loading overlay ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto mt-20 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8964E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-text">{isPt ? "A gerar conteúdo..." : "Generating content..."}</h2>
          <p className="text-sm text-muted mt-2 max-w-sm">
            {isPt
              ? "A buscar dados do Google Places e a gerar notas editoriais. Isto pode demorar alguns segundos."
              : "Fetching Google Places data and generating editorial notes. This may take a few seconds."}
          </p>
        </div>
      </div>
    );
  }

  // ── Preview mode: show all generated data ─────────────────────────────────

  if (preview) {
    return (
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">{isPt ? "Pré-visualização" : "Preview"}</h1>
          <p className="text-sm text-muted mt-1">
            {isPt
              ? "Revise os dados gerados automaticamente. Clique em Guardar para criar o estabelecimento."
              : "Review the auto-generated data. Click Save to create the establishment."}
          </p>
        </div>

        <div className="flex flex-col gap-4 pb-32">
          {/* Name + City */}
          <div className="rounded-xl border border-border bg-white px-5 py-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{isPt ? "Nome" : "Name"}</p>
            <p className="text-lg font-bold text-text">{preview.name}</p>
            <p className="text-sm text-muted mt-1">{cityName(preview.citySlug)} &middot; {preview.placeType}</p>
          </div>

          {/* Google Photos */}
          {preview.photoUrls.length > 0 && (
            <div className="rounded-xl border border-border bg-white px-5 py-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                {isPt ? "Fotografias do Google" : "Google Photos"}
                <span className="ml-2 text-[10px] font-normal normal-case text-muted/70">
                  ({preview.photoUrls.length} {isPt ? "serão importadas ao guardar" : "will be imported on save"})
                </span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {preview.photoUrls.map((url, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={url}
                      alt={`${preview.name} photo ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {i === 0 && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-gold text-white text-[10px] font-semibold uppercase">
                        Hero
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Address + Contact */}
          <div className="rounded-xl border border-border bg-white px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{isPt ? "Morada" : "Address"}</p>
              <p className="text-sm text-text">{preview.addressLine ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{isPt ? "Telefone" : "Phone"}</p>
              <p className="text-sm text-text">{preview.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Website</p>
              <p className="text-sm text-text truncate">{preview.websiteUrl ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Google Rating</p>
              <p className="text-sm text-text">{preview.googleRating ? `${preview.googleRating}★ (${preview.googleRatingCount ?? 0})` : "—"}</p>
            </div>
          </div>

          {/* Classification */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-5 py-4">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">{isPt ? "Classificação automática" : "Auto-classification"}</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium capitalize">{preview.placeType}</span>
              <span className="text-blue-400">→</span>
              <span className="capitalize">{preview.categorySlug}</span>
              <span className="text-blue-400">→</span>
              <span className="capitalize">{preview.subcategorySlug}</span>
            </div>
            {preview.cuisineTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {preview.cuisineTypes.map(c => (
                  <span key={c} className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">{c}</span>
                ))}
              </div>
            )}
          </div>

          {/* Editorial notes */}
          <div className="rounded-xl border border-border bg-white px-5 py-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Goldenbook Note</p>
            <p className="text-sm text-text italic">&ldquo;{preview.goldenbookNote}&rdquo;</p>
          </div>

          <div className="rounded-xl border border-border bg-white px-5 py-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Insider Tip</p>
            <p className="text-sm text-text">{preview.insiderTip}</p>
          </div>

          {/* Description */}
          <div className="rounded-xl border border-border bg-white px-5 py-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{isPt ? "Descrição" : "Description"}</p>
            <p className="text-sm text-text whitespace-pre-line">{preview.fullDescription}</p>
          </div>

          {/* Opening hours */}
          {preview.openingHours.length > 0 && (
            <div className="rounded-xl border border-border bg-white px-5 py-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{isPt ? "Horário" : "Opening hours"}</p>
              <div className="grid grid-cols-2 gap-1 text-sm">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => {
                  const slots = preview.openingHours.filter(h => h.dayOfWeek === i);
                  return (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className="text-muted">{day}</span>
                      <span className="text-text">{slots.length > 0 ? slots.map(s => `${s.opensAt}–${s.closesAt}`).join(', ') : 'Fechado'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-border px-10 py-5 flex items-center justify-between z-10">
          <button
            type="button"
            onClick={() => { setPreview(null); setSelected(null); setQuery(""); }}
            className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white cursor-pointer"
          >
            {isPt ? "Cancelar" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                {savePhase || (isPt ? "A guardar..." : "Saving...")}
              </>
            ) : (
              isPt ? "Guardar estabelecimento" : "Save establishment"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Search mode ───────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">{isPt ? "Novo estabelecimento" : "New establishment"}</h1>
        <p className="text-sm text-muted mt-1">
          {isPt
            ? "Pesquise o nome do estabelecimento e selecione-o da lista. Todos os campos serão preenchidos automaticamente."
            : "Search for the establishment name and select it from the list. All fields will be auto-filled."}
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-6" ref={containerRef}>
        <label className="block text-sm font-medium text-text mb-1.5">
          {isPt ? "Nome do estabelecimento" : "Establishment name"} <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={isPt ? "Escreva o nome do restaurante, hotel, museu..." : "Type the restaurant, hotel, museum name..."}
            className="w-full px-4 py-3 rounded-xl border border-border text-base text-text placeholder:text-muted/50 focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/10 transition-all"
            autoFocus
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="animate-spin w-4 h-4 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          )}
        </div>

        {/* Dropdown results */}
        {results.length > 0 && !selected && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-80 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.placeId}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full text-left px-4 py-3 hover:bg-gold/5 transition-colors border-b border-border/50 last:border-b-0 cursor-pointer"
              >
                <p className="text-sm font-semibold text-text">{r.name}</p>
                <p className="text-xs text-muted mt-0.5">{r.address}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected place preview */}
      {selected && (
        <div className="rounded-xl border border-gold/20 bg-gold/5 px-5 py-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8964E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-text">{selected.name}</p>
              <p className="text-xs text-muted">{selected.address}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!selected}
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
        {isPt ? "Gerar conteúdo automaticamente" : "Auto-generate content"}
      </button>

      <p className="text-[11px] text-muted mt-3">
        {isPt
          ? "Isto irá buscar dados do Google Places e gerar notas editoriais. O estabelecimento só será criado quando clicar em Guardar."
          : "This will fetch Google Places data and generate editorial notes. The establishment will only be created when you click Save."}
      </p>

      {/* Manual entry escape hatch — for places not on Google Maps. */}
      <div className="mt-10 pt-6 border-t border-border">
        <p className="text-xs text-muted mb-2">
          {isPt
            ? "Não encontra o estabelecimento no Google?"
            : "Establishment not on Google Maps?"}
        </p>
        <button
          type="button"
          onClick={() => setManualMode(true)}
          className="text-sm font-semibold text-gold hover:text-gold-dark underline-offset-2 hover:underline cursor-pointer"
        >
          {isPt ? "Adicionar manualmente →" : "Add manually →"}
        </button>
      </div>
    </div>
  );
}

// ─── Manual entry form ──────────────────────────────────────────────────────
// Used when the place isn't on Google Maps. Submits directly to
// POST /admin/places with sourceLocale='pt' (editor writes natively in PT).
// Creates the row as `draft` so the editor can complete photos / editorial
// notes / opening hours on the standard edit page right after.

function ManualEntryForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const { locale } = useLocale();
  const isPt = locale.startsWith("pt");

  const [categories, setCategories] = useState<AdminCategoryDTO[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [citySlug, setCitySlug] = useState<string>("lisboa");
  const [placeType, setPlaceType] = useState<string>("restaurant");
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [subcategorySlug, setSubcategorySlug] = useState<string>("");
  const [addressLine, setAddressLine] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [shortDescription, setShortDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminCategories("pt")
      .then((c) => setCategories(c))
      .catch(() => setCategories([]))
      .finally(() => setCatsLoading(false));
  }, []);

  // Auto-fill slug from name until the editor edits it explicitly.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug) ?? null,
    [categories, categorySlug],
  );

  const subcategories = selectedCategory?.subcategories ?? [];

  // Reset subcategory whenever the parent category changes.
  useEffect(() => { setSubcategorySlug(""); }, [categorySlug]);

  const canSubmit =
    name.trim().length >= 2 &&
    slug.length >= 1 &&
    !!citySlug &&
    !!categorySlug &&
    !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const lat = latitude.trim() ? Number(latitude) : undefined;
    const lng = longitude.trim() ? Number(longitude) : undefined;
    if ((latitude && Number.isNaN(lat!)) || (longitude && Number.isNaN(lng!))) {
      setError(isPt ? "Latitude/longitude inválida." : "Invalid latitude/longitude.");
      setSaving(false);
      return;
    }

    try {
      const result = await createPlace({
        name: name.trim(),
        slug,
        citySlug,
        placeType,
        categorySlug,
        subcategorySlug: subcategorySlug || undefined,
        addressLine: addressLine.trim() || undefined,
        phone: phone.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        latitude: lat,
        longitude: lng,
        shortDescription: shortDescription.trim() || undefined,
        // PT is the canonical editorial locale — manual entry is always
        // written in Portuguese by the editor.
        sourceLocale: "pt",
        // Draft until the editor adds photos + editorial notes on the
        // standard edit page. Publishing a manual entry with no image or
        // description would surface a broken card on mobile.
        status: "draft",
        featured: false,
      });
      router.push(`/places/${result.slug}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(
          isPt
            ? "Já existe um estabelecimento com este slug. Edite o slug e tente novamente."
            : "An establishment with this slug already exists. Edit the slug and try again."
        );
      } else if (err instanceof ApiError) {
        const detail = typeof err.data?.error === "string" ? `: ${err.data.error}` : "";
        setError(`${err.status} ${err.message}${detail}`);
      } else {
        setError(err instanceof Error ? err.message : isPt ? "Erro ao guardar." : "Error saving.");
      }
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">
          {isPt ? "Novo estabelecimento (manual)" : "New establishment (manual)"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {isPt
            ? "Preencha os campos abaixo. O estabelecimento será criado como rascunho — pode adicionar fotografias e notas editoriais a seguir."
            : "Fill in the fields below. The establishment will be created as a draft — you can add photos and editorial notes next."}
        </p>
      </div>

      <div className="flex flex-col gap-4 pb-32">
        {/* Name + slug */}
        <Field label={isPt ? "Nome do estabelecimento" : "Establishment name"} required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isPt ? "Ex: Tasca do Manuel" : "Ex: Tasca do Manuel"}
            className={INPUT_CLS}
            autoFocus
          />
        </Field>

        <Field
          label="Slug"
          required
          hint={isPt
            ? "URL única. Gerado a partir do nome — edite se necessário."
            : "Unique URL identifier. Generated from the name — edit if needed."}
        >
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
            placeholder="tasca-do-manuel"
            className={`${INPUT_CLS} font-mono`}
          />
        </Field>

        {/* City + type */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={isPt ? "Cidade" : "City"} required>
            <select value={citySlug} onChange={(e) => setCitySlug(e.target.value)} className="input">
              {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={isPt ? "Tipo" : "Type"} required>
            <select value={placeType} onChange={(e) => setPlaceType(e.target.value)} className="input">
              {PLACE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        {/* Category + subcategory */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={isPt ? "Categoria" : "Category"} required>
            <select
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              disabled={catsLoading}
              className={INPUT_CLS}
            >
              <option value="">{catsLoading ? (isPt ? "A carregar..." : "Loading...") : (isPt ? "Selecionar..." : "Select...")}</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={isPt ? "Subcategoria" : "Subcategory"}>
            <select
              value={subcategorySlug}
              onChange={(e) => setSubcategorySlug(e.target.value)}
              disabled={subcategories.length === 0}
              className={INPUT_CLS}
            >
              <option value="">{subcategories.length === 0 ? "—" : (isPt ? "Selecionar..." : "Select...")}</option>
              {subcategories.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
          </Field>
        </div>

        {/* Address + phone */}
        <Field label={isPt ? "Morada" : "Address"}>
          <input
            type="text"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder={isPt ? "Rua, número, código postal, cidade" : "Street, number, postal code, city"}
            className={INPUT_CLS}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={isPt ? "Telefone" : "Phone"}>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351 21 000 0000" className="input" />
          </Field>
          <Field label="Website">
            <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." className="input" />
          </Field>
        </div>

        {/* Coords */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude" hint={isPt ? "Opcional, ex: 38.7223" : "Optional, e.g. 38.7223"}>
            <input type="text" inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="38.7223" className="input" />
          </Field>
          <Field label="Longitude" hint={isPt ? "Opcional, ex: -9.1393" : "Optional, e.g. -9.1393"}>
            <input type="text" inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-9.1393" className="input" />
          </Field>
        </div>

        {/* Short description */}
        <Field label={isPt ? "Descrição curta" : "Short description"} hint={isPt ? "Máx 600 caracteres. Pode completar mais tarde." : "Max 600 characters. Can complete later."}>
          <textarea
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value.slice(0, 600))}
            rows={3}
            placeholder={isPt ? "Uma frase ou duas que capturem a essência do espaço..." : "A sentence or two capturing the essence of the place..."}
            className={INPUT_CLS}
          />
        </Field>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-border px-10 py-5 flex items-center justify-between z-10">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white cursor-pointer disabled:opacity-50"
        >
          {isPt ? "Voltar à pesquisa" : "Back to search"}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              {isPt ? "A guardar..." : "Saving..."}
            </>
          ) : (
            isPt ? "Criar como rascunho" : "Create as draft"
          )}
        </button>
      </div>

    </div>
  );
}

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
