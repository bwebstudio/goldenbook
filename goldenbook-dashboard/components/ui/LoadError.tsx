"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

/**
 * Generic, localized, retryable "couldn't load" state for server components
 * that fetch their data in page.tsx. When a primary backend fetch fails the
 * page used to render silently-empty (zeros, blank charts) — indistinguishable
 * from a genuinely empty account. This surfaces the failure and a retry that
 * re-runs the server render via router.refresh().
 */
export default function LoadError() {
  const router = useRouter();
  const t = useT();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-sm text-muted max-w-sm">{t.common.loadError}</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="px-4 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer"
      >
        {t.common.retry}
      </button>
    </div>
  );
}
