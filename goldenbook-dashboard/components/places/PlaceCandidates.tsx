"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchCandidatesForPlace,
  generateCandidatesForPlace,
  activateCandidate,
  deactivateCandidate,
  addManualCandidate,
  updateCandidateUrl,
  deleteCandidateApi,
  type BookingCandidateDTO,
} from "@/lib/api/candidates";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

const PROVIDER_NAMES: Record<string, string> = {
  booking: "Booking.com",
  thefork: "TheFork",
  viator: "Viator",
  getyourguide: "GetYourGuide",
  website: "Website",
};

interface PlaceCandidatesProps {
  placeId: string;
  reservable: boolean;
  onReservableChange: (value: boolean) => void;
}

export default function PlaceCandidates({ placeId, reservable, onReservableChange }: PlaceCandidatesProps) {
  const router = useRouter();
  const t = useT();
  const [candidates, setCandidates] = useState<BookingCandidateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");

  const load = useCallback(async () => {
    try {
      setCandidates(await fetchCandidatesForPlace(placeId));
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => { load(); }, [load]);

  const active = candidates.find(c => c.is_active);
  const others = candidates.filter(c => !c.is_active);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); router.refresh(); } finally { setBusy(false); }
  };

  const handleAddUrl = async () => {
    const url = newUrl.trim();
    if (!url) return;
    await withBusy(async () => { await addManualCandidate(placeId, url); });
    setNewUrl("");
  };

  const handleSaveEdit = async (candidateId: string) => {
    const url = editUrl.trim();
    if (!url) return;
    await withBusy(async () => { await updateCandidateUrl(candidateId, url); });
    setEditingId(null);
    setEditUrl("");
  };

  if (loading) return <p className="text-sm text-muted py-3">{t.empCandidates.loading}</p>;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Is this place reservable? ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text">{t.empCandidates.canGuestsReserve}</p>
          <p className="text-xs text-muted mt-0.5">{t.empCandidates.canGuestsReserveHint}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reservable}
          onClick={() => onReservableChange(!reservable)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${reservable ? "bg-gold" : "bg-gray-200"}`}
        >
          <span className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${reservable ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Only show reservation links if reservable */}
      {reservable && (
        <>
          <div className="border-t border-border" />

          {/* ── Active link ── */}
          {active ? (
            <div className="rounded-xl border border-green-200 bg-green-50/50 p-5">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">{t.empCandidates.activeReservation}</p>

              {editingId === active.id ? (
                /* Editing active link */
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(active.id)}
                  />
                  <button onClick={() => handleSaveEdit(active.id)} disabled={busy} className="px-4 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50">{t.common.save}</button>
                  <button onClick={() => { setEditingId(null); setEditUrl(""); }} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted hover:text-text transition-colors cursor-pointer">{t.common.cancel}</button>
                </div>
              ) : (
                /* Showing active link */
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-text">{PROVIDER_NAMES[active.provider] ?? active.provider}</p>
                    <a href={active.candidate_url} target="_blank" rel="noopener noreferrer" className="text-sm text-gold hover:text-gold-dark transition-colors truncate block mt-0.5" title={active.candidate_url}>
                      {active.candidate_url}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditingId(active.id); setEditUrl(active.candidate_url); }}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-text hover:border-gold/50 transition-colors bg-white cursor-pointer disabled:opacity-50"
                    >
                      {t.empCandidates.editButton}
                    </button>
                    <button
                      onClick={() => withBusy(async () => { await deactivateCandidate(active.id); })}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-red-600 hover:border-red-200 transition-colors bg-white cursor-pointer disabled:opacity-50"
                    >
                      {t.empCandidates.deleteButton}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-green-600 mt-2">
                {t.empCandidates.activeHint}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-sm text-amber-800">
                {t.empCandidates.noActiveLink}
              </p>
            </div>
          )}

          {/* ── Add or paste a link ── */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{t.empCandidates.addLink}</p>
            <div className="flex gap-3">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={t.empCandidates.addPlaceholder}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              />
              <button
                onClick={handleAddUrl}
                disabled={busy || !newUrl.trim()}
                className="px-5 py-2.5 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50"
              >
                {t.empCandidates.addButton}
              </button>
            </div>
            <p className="text-xs text-muted mt-1.5">
              {t.empCandidates.autoDetectHint}
            </p>
          </div>

          {/* ── Other available links ── */}
          {others.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">{t.empCandidates.otherLinks}</p>
              <div className="flex flex-col gap-2">
                {others.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-white px-4 py-3">
                    {editingId === c.id ? (
                      <div className="flex gap-3 flex-1">
                        <input type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-gold" onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(c.id)} />
                        <button onClick={() => handleSaveEdit(c.id)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-gold text-white text-xs font-semibold cursor-pointer disabled:opacity-50">{t.empCandidates.save}</button>
                        <button onClick={() => { setEditingId(null); setEditUrl(""); }} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted cursor-pointer">{t.common.cancel}</button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text">{PROVIDER_NAMES[c.provider] ?? c.provider}</p>
                          <a href={c.candidate_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:text-gold-dark transition-colors truncate block mt-0.5" title={c.candidate_url}>
                            {c.candidate_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => { setEditingId(c.id); setEditUrl(c.candidate_url); }} disabled={busy} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-text transition-colors cursor-pointer disabled:opacity-50">{t.empCandidates.editButton}</button>
                          <button onClick={() => withBusy(async () => { await activateCandidate(c.id, placeId); })} disabled={busy} className="px-3 py-1.5 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50">{t.empCandidates.useThis}</button>
                          <button onClick={() => withBusy(async () => { await deleteCandidateApi(c.id); })} disabled={busy} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50">{t.empCandidates.deleteButton}</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Auto-search ── */}
          <button
            onClick={() => withBusy(async () => { await generateCandidatesForPlace(placeId); })}
            disabled={busy}
            className="self-start px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted hover:text-text hover:border-gold/50 transition-colors bg-white cursor-pointer disabled:opacity-50"
          >
            {t.empCandidates.searchAuto}
          </button>
        </>
      )}
    </div>
  );
}
