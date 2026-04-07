"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchGooglePlaces, generatePlace } from "@/lib/api/places";
import { useLocale } from "@/lib/i18n";

interface GoogleResult {
  placeId: string;
  name: string;
  address: string;
}

interface PlaceGeneratorProps {
  cities: { slug: string; name: string }[];
}

export default function PlaceGenerator({ cities }: PlaceGeneratorProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const isPt = locale.startsWith("pt");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleResult[]>([]);
  const [selected, setSelected] = useState<GoogleResult | null>(null);
  const [citySlug, setCitySlug] = useState(cities[0]?.slug ?? "");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    setSelected(null);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchGooglePlaces(value);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  // Select a result
  const handleSelect = (result: GoogleResult) => {
    setSelected(result);
    setQuery(result.name);
    setResults([]);
  };

  // Generate place
  const handleGenerate = async () => {
    if (!selected || !citySlug) return;

    setGenerating(true);
    setError(null);

    try {
      const place = await generatePlace(selected.placeId, citySlug);
      // Redirect to edit page
      router.push(`/places/${place.slug}`);
    } catch (err) {
      setGenerating(false);
      setError(
        err instanceof Error
          ? err.message
          : isPt
            ? "Erro ao gerar o estabelecimento. Tente novamente."
            : "Error generating the establishment. Please try again."
      );
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Generating overlay ────────────────────────────────────────────────────

  if (generating) {
    return (
      <div className="max-w-2xl mx-auto mt-20 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8964E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-text">
            {isPt ? "A gerar estabelecimento..." : "Generating establishment..."}
          </h2>
          <p className="text-sm text-muted mt-2 max-w-sm">
            {isPt
              ? "A buscar dados do Google Places, a gerar notas editoriais e a traduzir para PT, EN e ES. Isto pode demorar alguns segundos."
              : "Fetching Google Places data, generating editorial notes, and translating to PT, EN and ES. This may take a few seconds."}
          </p>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">
          {isPt ? "Novo estabelecimento" : "New establishment"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {isPt
            ? "Pesquise o nome do estabelecimento e selecione-o da lista. Todos os campos serão preenchidos automaticamente."
            : "Search for the establishment name and select it from the list. All fields will be auto-filled."}
        </p>
      </div>

      {/* City selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-text mb-1.5">
          {isPt ? "Cidade" : "City"} <span className="text-red-400">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {cities.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCitySlug(c.slug)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                citySlug === c.slug
                  ? "bg-gold/10 text-gold border-gold/30"
                  : "bg-white border-border text-muted hover:border-gold/30"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <label className="block text-sm font-medium text-text mb-1.5">
          {isPt ? "Nome do estabelecimento" : "Establishment name"} <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            ref={inputRef}
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
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
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
        disabled={!selected || !citySlug}
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
        {isPt ? "Gerar conteúdo automaticamente" : "Auto-generate content"}
      </button>

      <p className="text-[11px] text-muted mt-3">
        {isPt
          ? "Isto irá buscar todos os dados do Google Places, gerar notas editoriais, classificar automaticamente e traduzir para PT, EN e ES."
          : "This will fetch all Google Places data, generate editorial notes, auto-classify, and translate to PT, EN and ES."}
      </p>
    </div>
  );
}
