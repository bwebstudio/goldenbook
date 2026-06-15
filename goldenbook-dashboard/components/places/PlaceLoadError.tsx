"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

/**
 * Localized, retryable error shown when the place edit page fails to load its
 * data from the backend. Replaces the old hardcoded-English "Could not load
 * place" dead-end (which only offered a "Back" link). A transient 401 during a
 * token refresh — e.g. right after a save triggers router.refresh() — used to
 * leave the editor staring at an English wall with no way forward but to leave.
 */
export default function PlaceLoadError({ slug }: { slug: string }) {
  const router = useRouter();
  const t = useT();

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-20 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-text">{t.common.error}</h3>
          <p className="text-base text-muted mt-2 max-w-sm">{t.common.loadError}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="px-6 py-3 rounded-xl bg-gold text-white text-base font-semibold hover:bg-gold-dark transition-colors cursor-pointer"
          >
            {t.common.retry}
          </button>
          <a
            href="/places"
            className="px-6 py-3 rounded-xl border border-border text-base font-semibold text-muted hover:border-gold/50 hover:text-text transition-colors bg-white"
          >
            {t.common.back}
          </a>
        </div>
      </div>
    </div>
  );
}
