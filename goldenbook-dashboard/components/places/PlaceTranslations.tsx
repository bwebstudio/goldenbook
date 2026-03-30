"use client";

import { useEffect, useState, useCallback } from "react";
import { useT } from "@/lib/i18n";
import {
  fetchPlaceTranslations,
  updateEnTranslation,
  regenerateTranslation,
  type PlaceTranslation,
} from "@/lib/api/translations";

interface Props {
  placeId: string;
}

export default function PlaceTranslations({ placeId }: Props) {
  const t = useT();
  const pf = t.placeForm;
  const [en, setEn] = useState<PlaceTranslation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // EN form state
  const [enName, setEnName] = useState("");
  const [enShort, setEnShort] = useState("");
  const [enFull, setEnFull] = useState("");
  const [enNote, setEnNote] = useState("");
  const [enTip, setEnTip] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchPlaceTranslations(placeId);
      const enData = data.en ?? null;
      setEn(enData);
      if (enData) {
        setEnName(enData.name ?? "");
        setEnShort(enData.short_description ?? "");
        setEnFull(enData.full_description ?? "");
        setEnNote(enData.goldenbook_note ?? "");
        setEnTip(enData.insider_tip ?? "");
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [placeId]);

  useEffect(() => { load(); }, [load]);

  const handleSaveEn = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateEnTranslation(placeId, {
        name: enName || undefined,
        shortDescription: enShort || null,
        fullDescription: enFull || null,
        goldenbookNote: enNote || null,
        insiderTip: enTip || null,
      });
      setMessage(t.common.saved);
      await load();
      setTimeout(() => setMessage(null), 3000);
    } finally { setSaving(false); }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setMessage(null);
    try {
      await regenerateTranslation(placeId);
      setMessage(pf.regenerated);
      await load();
      setTimeout(() => setMessage(null), 3000);
    } finally { setRegenerating(false); }
  };

  if (loading) return <p className="text-sm text-muted py-3">{t.common.loading}</p>;

  const isOverride = en?.translation_override ?? false;

  const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold";

  return (
    <div className="flex flex-col gap-4">
      {/* Status indicator */}
      <div className={`rounded-lg px-3 py-2 text-xs ${isOverride ? "bg-amber-50 border border-amber-200 text-amber-700" : "bg-blue-50 border border-blue-200 text-blue-700"}`}>
        {isOverride ? pf.manualOverride : pf.autoTranslated}
      </div>

      {/* EN fields */}
      <div className="flex flex-col gap-3">
        <TransField label={pf.placeName} value={enName} onChange={setEnName} cls={inputCls} />
        <TransField label={pf.shortDescription} value={enShort} onChange={setEnShort} cls={inputCls} />
        <TransField label={pf.fullDescription} value={enFull} onChange={setEnFull} cls={inputCls} multiline rows={4} />
        <TransField label={pf.goldenbookNote} value={enNote} onChange={setEnNote} cls={inputCls} multiline rows={2} />
        <TransField label={pf.insiderTip} value={enTip} onChange={setEnTip} cls={inputCls} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={handleSaveEn} disabled={saving} className="px-4 py-2 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50">
          {saving ? t.common.saving : t.common.save}
        </button>
        <button onClick={handleRegenerate} disabled={regenerating} className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted hover:text-text transition-colors cursor-pointer disabled:opacity-50">
          {regenerating ? pf.regenerating : pf.regenerate}
        </button>
        {message && <span className="text-xs text-green-600 font-medium">{message}</span>}
      </div>
    </div>
  );
}

function TransField({ label, value, onChange, cls, multiline, rows }: {
  label: string; value: string; onChange: (v: string) => void; cls: string; multiline?: boolean; rows?: number;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-muted mb-1">{label} (EN)</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={cls} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}
