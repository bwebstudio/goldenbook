"use client";

import { useT } from "@/lib/i18n";

export default function PlacementsError() {
  const t = useT();
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-text mb-6">{t.empPlacements.title}</h1>
      <div className="bg-white rounded-2xl border border-border shadow-sm px-8 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center text-gold mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 3l-4 4-4-4" /></svg>
        </div>
        <p className="text-lg font-semibold text-text mb-1">{t.empPlacements.noPlacementsYet}</p>
        <p className="text-sm text-muted max-w-sm mx-auto">{t.empPlacements.noPlacementsDesc}</p>
      </div>
    </div>
  );
}
