"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchGooglePlaces, previewPlaceFromGoogle, createPlace, ingestGooglePhotos, type PlacePreview } from "@/lib/api/places";
import { ApiError } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n";

interface GoogleResult {
  placeId: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
}

export default function PlaceGenerator() {
  const cities = [
    { slug: 'algarve', name: 'Algarve' },
    { slug: 'lisboa', name: 'Lisboa' },
    { slug: 'madeira', name: 'Madeira' },
    { slug: 'porto', name: 'Porto' },
  ];
  const router = useRouter();
  const { locale } = useLocale();
  const isPt = locale.startsWith("pt");

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
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, []);

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
    </div>
  );
}
