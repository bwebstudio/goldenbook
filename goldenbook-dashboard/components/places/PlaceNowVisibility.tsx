"use client";

import { useEffect, useState } from "react";
import { fetchNowContextTags, fetchPlaceNowConfig, type NowContextTag } from "@/lib/api/places";
import { useT, useLocale } from "@/lib/i18n";

// ─── Time windows ──────────────────────────────────────────────────────────

const TIME_WINDOWS = [
  { value: "morning",   en: "Morning (6–11)",    pt: "Manhã (6–11)" },
  { value: "midday",    en: "Midday (11–14)",    pt: "Meio-dia (11–14)" },
  { value: "afternoon", en: "Afternoon (14–18)", pt: "Tarde (14–18)" },
  { value: "evening",   en: "Evening (18–22)",   pt: "Fim de tarde (18–22)" },
  { value: "night",     en: "Night (22–6)",      pt: "Noite (22–6)" },
] as const;

// ─── Tag grouping by context ───────────────────────────────────────────────
// Groups help editors understand which tags to use. Tags appear in their most
// relevant group but can be freely selected regardless of group.

const TAG_GROUPS: { key: string; en: string; pt: string; tags: string[] }[] = [
  {
    key: "dining",
    en: "Dining & Drinks",
    pt: "Gastronomia & Bebidas",
    tags: ["brunch", "lunch", "dinner", "fine-dining", "coffee", "quick-stop", "cocktails", "wine", "late-night"],
  },
  {
    key: "ambiance",
    en: "Ambiance & Setting",
    pt: "Ambiente & Espaço",
    tags: ["romantic", "terrace", "rooftop", "viewpoint", "sunset", "rainy-day"],
  },
  {
    key: "experience",
    en: "Experience & Culture",
    pt: "Experiência & Cultura",
    tags: ["culture", "live-music", "local-secret", "wellness", "shopping"],
  },
  {
    key: "audience",
    en: "Audience & Occasion",
    pt: "Público & Ocasião",
    tags: ["family", "sunday", "celebration"],
  },
];

// Suggested tags by place type — highlighted but not auto-selected
const SUGGESTED_TAGS: Record<string, string[]> = {
  restaurant: ["lunch", "dinner", "fine-dining", "romantic", "terrace", "viewpoint", "family", "wine"],
  bar:        ["cocktails", "wine", "late-night", "live-music", "rooftop", "terrace"],
  cafe:       ["coffee", "brunch", "quick-stop", "lunch", "rainy-day"],
  hotel:      ["wellness", "romantic", "viewpoint", "terrace", "rooftop"],
  shop:       ["shopping", "local-secret", "quick-stop"],
  museum:     ["culture", "rainy-day", "family", "local-secret"],
  landmark:   ["culture", "viewpoint", "family", "local-secret"],
  activity:   ["culture", "wellness", "family", "viewpoint", "local-secret", "wine"],
  beach:      ["viewpoint", "sunset", "family", "wellness"],
};

// ─── Exported types ──────────────────────────────────────────────────────────

export interface NowFormValues {
  nowTagSlugs: string[];
  nowTimeWindows: string[];
}

export const EMPTY_NOW_FORM: NowFormValues = {
  nowTagSlugs: [],
  nowTimeWindows: [],
};

// ─── Component ───────────────────────────────────────────────────────────────

interface PlaceContextualRelevanceProps {
  placeId: string;
  placeType?: string;
  value: NowFormValues;
  onChange: (next: NowFormValues) => void;
}

export default function PlaceNowVisibility({ placeId, placeType, value, onChange }: PlaceContextualRelevanceProps) {
  const [allTags, setAllTags] = useState<NowContextTag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { locale } = useLocale();
  const lang = locale.split("-")[0] || "en";
  const isPt = lang === "pt";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tags, config] = await Promise.all([
          fetchNowContextTags(),
          fetchPlaceNowConfig(placeId),
        ]);
        if (cancelled) return;
        setAllTags(tags);
        onChange({
          nowTagSlugs: config.nowTagSlugs,
          nowTimeWindows: config.nowTimeWindows,
        });
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  const tagMap = new Map(allTags.map((t) => [t.slug, t]));
  const suggested = new Set(SUGGESTED_TAGS[placeType ?? ""] ?? []);

  function toggleTag(slug: string) {
    const next = value.nowTagSlugs.includes(slug)
      ? value.nowTagSlugs.filter((s) => s !== slug)
      : [...value.nowTagSlugs, slug];
    onChange({ ...value, nowTagSlugs: next });
  }

  function toggleTimeWindow(tw: string) {
    const next = value.nowTimeWindows.includes(tw)
      ? value.nowTimeWindows.filter((s) => s !== tw)
      : [...value.nowTimeWindows, tw];
    onChange({ ...value, nowTimeWindows: next });
  }

  if (!loaded) {
    return (
      <div className="py-8 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Description */}
      <p className="text-sm text-muted leading-relaxed">
        {isPt
          ? "Define os momentos e contextos em que este espaço é mais relevante. Isto melhora a qualidade das recomendações no NOW e no Concierge."
          : "Define the moments and contexts in which this place is most relevant. This helps improve recommendation quality across NOW and Concierge."}
      </p>

      {/* Context tags — grouped */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          {isPt ? "Tags de contexto" : "Context tags"}
        </label>
        <p className="text-[11px] text-muted mb-3">
          {isPt
            ? "Quando é que este espaço é uma boa recomendação? Selecione todos os que se aplicam."
            : "When is this place a good recommendation? Select all that apply."}
          {suggested.size > 0 && (
            <span className="ml-1 text-gold">
              {isPt ? "Os tags sugeridos para este tipo estão destacados." : "Suggested tags for this type are highlighted."}
            </span>
          )}
        </p>

        <div className="flex flex-col gap-4">
          {TAG_GROUPS.map((group) => {
            const groupTags = group.tags.filter((slug) => tagMap.has(slug));
            if (groupTags.length === 0) return null;
            return (
              <div key={group.key}>
                <p className="text-[10px] font-semibold text-muted/60 uppercase tracking-wider mb-1.5">
                  {isPt ? group.pt : group.en}
                </p>
                <div className="flex flex-wrap gap-2">
                  {groupTags.map((slug) => {
                    const tag = tagMap.get(slug)!;
                    const selected = value.nowTagSlugs.includes(slug);
                    const isSuggested = suggested.has(slug);
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => toggleTag(slug)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                          selected
                            ? "bg-gold/10 text-gold border-gold/30"
                            : isSuggested
                              ? "bg-amber-50 border-amber-200 text-amber-700 hover:border-gold/30"
                              : "bg-white border-border text-muted hover:border-gold/30"
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time windows */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          {isPt ? "Janelas horárias" : "Time windows"}
        </label>
        <p className="text-[11px] text-muted mb-2">
          {isPt
            ? "Quando é que este espaço é mais relevante durante o dia? Deixe vazio se relevante a todas as horas."
            : "When is this place most relevant during the day? Leave empty if relevant at all times."}
        </p>
        <div className="flex flex-wrap gap-2">
          {TIME_WINDOWS.map((tw) => {
            const selected = value.nowTimeWindows.includes(tw.value);
            return (
              <button
                key={tw.value}
                type="button"
                onClick={() => toggleTimeWindow(tw.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                  selected
                    ? "bg-gold/10 text-gold border-gold/30"
                    : "bg-white border-border text-muted hover:border-gold/30"
                }`}
              >
                {isPt ? tw.pt : tw.en}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
