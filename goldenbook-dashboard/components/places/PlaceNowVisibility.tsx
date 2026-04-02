"use client";

import { useEffect, useState } from "react";
import { fetchNowContextTags, fetchPlaceNowConfig, type NowContextTag } from "@/lib/api/places";

const TIME_WINDOWS = [
  { value: "morning",   label: "Morning (6–11)" },
  { value: "midday",    label: "Midday (11–14)" },
  { value: "afternoon", label: "Afternoon (14–18)" },
  { value: "evening",   label: "Evening (18–22)" },
  { value: "night",     label: "Night (22–6)" },
] as const;

// ─── Exported types ──────────────────────────────────────────────────────────

/**
 * Editor-facing form values: only tags and time windows.
 * Campaign/priority/featured fields are kept in the DB for internal
 * commercial logic but NOT exposed in the editorial place editor.
 */
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
  value: NowFormValues;
  onChange: (next: NowFormValues) => void;
}

export default function PlaceNowVisibility({ placeId, value, onChange }: PlaceContextualRelevanceProps) {
  const [allTags, setAllTags] = useState<NowContextTag[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load available tags + current place config once
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
        // Only populate editorial fields — campaign fields are not editor-facing
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
        Define the moments and contexts in which this place is most relevant.
        This helps improve recommendation quality across NOW and Concierge.
      </p>

      {/* Context tags */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          Context tags
        </label>
        <p className="text-[11px] text-muted mb-2">
          When is this place a good recommendation? Select all that apply.
        </p>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const selected = value.nowTagSlugs.includes(tag.slug);
            return (
              <button
                key={tag.slug}
                type="button"
                onClick={() => toggleTag(tag.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  selected
                    ? "bg-gold/10 text-gold border-gold/30"
                    : "bg-white border-border text-muted hover:border-gold/30"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time windows */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          Time windows
        </label>
        <p className="text-[11px] text-muted mb-2">
          When is this place most relevant during the day? Leave empty if relevant at all times.
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
                {tw.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
