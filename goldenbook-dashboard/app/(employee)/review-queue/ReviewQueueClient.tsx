"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { fetchReviewQueue, approveChange, rejectChange, type ChangeRequest } from "@/lib/api/review-queue";

type Filter = "pending" | "approved" | "rejected";

function diffLines(oldText: string, newText: string): { removed: Set<string>; added: Set<string> } {
  const oldSet = new Set(oldText.split('\n'));
  const newSet = new Set(newText.split('\n'));
  return {
    removed: new Set([...oldSet].filter(l => !newSet.has(l))),
    added: new Set([...newSet].filter(l => !oldSet.has(l))),
  };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ReviewQueueClient() {
  const t = useT();
  const rq = t.reviewQueue;
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await fetchReviewQueue(filter)); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const handleAction = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      if (modal.action === "approve") await approveChange(modal.id, note || null);
      else await rejectChange(modal.id, note || null);
      setModal(null); setNote(""); await load();
      window.dispatchEvent(new Event('review-count-changed'));
    } finally { setBusy(false); }
  };

  const fieldLabels = rq.fieldLabels as Record<string, string>;
  const filters: [Filter, string][] = [["pending", rq.pending], ["approved", rq.approved], ["rejected", rq.rejected]];

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{rq.title}</h1>
          <p className="text-sm text-muted mt-1">{rq.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        {filters.map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${filter === key ? "bg-gold/10 text-gold border border-gold/30" : "bg-white border border-border text-muted hover:text-text"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted py-10">{t.common.loading}</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-border px-8 py-16 text-center">
          <p className="text-lg font-semibold text-text mb-1">{rq.noItems}</p>
          <p className="text-sm text-muted">{rq.noItemsDesc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isExp = expanded === item.id;
            const diff = diffLines(item.old_value ?? '', item.new_value ?? '');
            const submitterDisplay = item.submitter_name ?? item.submitter_email ?? item.created_by ?? '—';
            const reviewerDisplay = item.reviewer_name ?? item.reviewed_by ?? '—';

            return (
              <div key={item.id} className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Header row */}
                <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Place + field */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                      <Link href={`/places/${item.place_slug}`} className="text-sm font-bold text-text hover:text-gold transition-colors">{item.place_name}</Link>
                      <span className="text-[10px] text-muted">·</span>
                      <span className="text-xs text-muted">{fieldLabels[item.field_name] ?? item.field_name}</span>
                    </div>

                    {/* Submitter info */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span className="font-medium text-text">{submitterDisplay}</span>
                      <span>·</span>
                      <span>{rq.businessUser}</span>
                      <span>·</span>
                      <span>{formatDateTime(item.created_at)}</span>
                    </div>

                    {/* Reviewer info (for approved/rejected) */}
                    {item.reviewed_at && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted mt-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                        <span className="font-medium text-text">{reviewerDisplay}</span>
                        <span>·</span>
                        <span>{formatDateTime(item.reviewed_at)}</span>
                      </div>
                    )}

                    {/* Rejection reason */}
                    {item.status === 'rejected' && item.review_note && (
                      <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                        <p className="text-[11px] text-red-700"><span className="font-semibold">{rq.reasonLabel}:</span> {item.review_note}</p>
                      </div>
                    )}
                    {item.status === 'approved' && item.review_note && (
                      <p className="text-[11px] text-muted mt-1 italic">{item.review_note}</p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <button onClick={() => setExpanded(isExp ? null : item.id)} className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-text cursor-pointer transition-colors" title={isExp ? "Collapse" : "Expand"}>
                      {isExp ? "−" : "+"}
                    </button>
                    {filter === "pending" && (
                      <>
                        <button onClick={() => { setModal({ id: item.id, action: "approve" }); setNote(""); }} disabled={busy} className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50">{rq.approve}</button>
                        <button onClick={() => { setModal({ id: item.id, action: "reject" }); setNote(""); }} disabled={busy} className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-50">{rq.reject}</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Compact preview */}
                {!isExp && (
                  <div className="px-4 sm:px-5 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[9px] font-bold text-muted uppercase tracking-wider mb-1">{rq.currentValue}</p>
                        <p className="text-xs text-muted line-clamp-2">{item.old_value || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gold uppercase tracking-wider mb-1">{rq.proposedValue}</p>
                        <p className="text-xs text-text line-clamp-2">{item.new_value || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expanded diff */}
                {isExp && (
                  <div className="border-t border-border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-border">
                      <div className="p-4 sm:p-5">
                        <p className="text-[9px] font-bold text-muted uppercase tracking-wider mb-3">{rq.currentValue}</p>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap text-text wrap-break-word">
                          {(item.old_value ?? '').split('\n').map((line, i) => (
                            <p key={i} className={diff.removed.has(line) ? "bg-red-50 text-red-700 px-1.5 -mx-1.5 rounded" : ""}>{line || '\u00A0'}</p>
                          ))}
                        </div>
                      </div>
                      <div className="p-4 sm:p-5 border-t sm:border-t-0 border-border">
                        <p className="text-[9px] font-bold text-gold uppercase tracking-wider mb-3">{rq.proposedValue}</p>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap text-text wrap-break-word">
                          {(item.new_value ?? '').split('\n').map((line, i) => (
                            <p key={i} className={diff.added.has(line) ? "bg-emerald-50 text-emerald-700 px-1.5 -mx-1.5 rounded" : ""}>{line || '\u00A0'}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white sm:rounded-2xl rounded-t-2xl border border-border shadow-xl p-6 sm:p-8 w-full sm:max-w-md h-full sm:h-auto flex flex-col">
            <p className="text-sm font-bold text-text mb-4">{modal.action === "approve" ? rq.confirmApproval : rq.confirmRejection}</p>
            <div className="mb-4 flex-1 sm:flex-none">
              <label className="block text-xs font-medium text-muted mb-1.5">{rq.reviewNote}</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold sm:h-auto h-32"
                placeholder={modal.action === "approve" ? rq.notePlaceholderApprove : rq.notePlaceholderReject} />
            </div>
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
              <button onClick={handleAction} disabled={busy} className={`w-full sm:w-auto px-5 py-2 rounded-lg text-white text-sm font-semibold cursor-pointer disabled:opacity-50 ${modal.action === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                {busy ? rq.processing : modal.action === "approve" ? rq.confirmApproval : rq.confirmRejection}
              </button>
              <button onClick={() => setModal(null)} className="w-full sm:w-auto px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-text cursor-pointer">{t.common.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
