"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useT } from "@/lib/i18n";
import {
  fetchPlaceTranslations,
  updateTranslationOverride,
  regenerateTranslation,
  type PlaceTranslation,
  type AutoLocale,
  type TranslationFields,
} from "@/lib/api/translations";

export interface PtSourceFields {
  name: string;
  shortDescription: string;
  fullDescription: string;
  goldenbookNote: string;
  insiderTip: string;
}

/**
 * Pure helper — exported so it can be unit-tested. Returns true when any
 * Portuguese source field has changed relative to the snapshot. The set of
 * fields here mirrors `PT_SOURCE_FIELDS` on the backend so the dashboard's
 * dirty signal and the API's translation source agree on what counts.
 */
export function arePtSourceFieldsDirty(
  initial: PtSourceFields,
  current: PtSourceFields,
): boolean {
  return (
    initial.name !== current.name ||
    initial.shortDescription !== current.shortDescription ||
    initial.fullDescription !== current.fullDescription ||
    initial.goldenbookNote !== current.goldenbookNote ||
    initial.insiderTip !== current.insiderTip
  );
}

interface Props {
  placeId: string;
  /**
   * Live getter for the current Portuguese form values from the parent.
   * Read on every regenerate so unsaved edits are picked up.
   */
  getPtSource: () => PtSourceFields;
  /**
   * Current Portuguese form values, passed reactively. Drives the regen
   * button's dirty state — when any source field differs from the
   * snapshot taken on mount (or right after a successful regenerate), the
   * button enables and switches to the "Portuguese content changed" copy.
   */
  ptSource: PtSourceFields;
}

interface LocaleFormState {
  name: string;
  shortDescription: string;
  fullDescription: string;
  goldenbookNote: string;
  insiderTip: string;
}

const EMPTY_FORM: LocaleFormState = {
  name: "",
  shortDescription: "",
  fullDescription: "",
  goldenbookNote: "",
  insiderTip: "",
};

function fromTranslation(t: PlaceTranslation | null | undefined): LocaleFormState {
  if (!t) return { ...EMPTY_FORM };
  return {
    name: t.name ?? "",
    shortDescription: t.short_description ?? "",
    fullDescription: t.full_description ?? "",
    goldenbookNote: t.goldenbook_note ?? "",
    insiderTip: t.insider_tip ?? "",
  };
}

function toBody(form: LocaleFormState): TranslationFields {
  return {
    name: form.name || undefined,
    shortDescription: form.shortDescription || null,
    fullDescription: form.fullDescription || null,
    goldenbookNote: form.goldenbookNote || null,
    insiderTip: form.insiderTip || null,
  };
}

function ptSourceToBody(pt: PtSourceFields): TranslationFields {
  return {
    name: pt.name || undefined,
    shortDescription: pt.shortDescription || null,
    fullDescription: pt.fullDescription || null,
    goldenbookNote: pt.goldenbookNote || null,
    insiderTip: pt.insiderTip || null,
  };
}

export default function PlaceTranslations({ placeId, getPtSource, ptSource }: Props) {
  const t = useT();
  const pf = t.placeForm;
  const ptName = ptSource.name;

  const [meta, setMeta] = useState<Record<AutoLocale, PlaceTranslation | null>>({ en: null, es: null });
  const [forms, setForms] = useState<Record<AutoLocale, LocaleFormState>>({ en: { ...EMPTY_FORM }, es: { ...EMPTY_FORM } });
  const [dirty, setDirty] = useState<Record<AutoLocale, boolean>>({ en: false, es: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Partial<Record<AutoLocale | "all", "save" | "regenerate">>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Snapshot of the PT source at "the last point translations were known
  // to be in sync with PT" — i.e. either component mount (fresh page load
  // → on-disk EN/ES match the on-disk PT) or right after a successful
  // regenerate. Anything different from this snapshot means the editor
  // has typed PT changes that haven't been propagated to EN/ES yet.
  //
  // We use a ref because the snapshot is mutated imperatively on success.
  // Wrapping it in state would cause an extra render with stale `dirty`
  // for one frame between the regen settle and the snapshot update.
  const ptSnapshotRef = useRef<PtSourceFields>(ptSource);
  // Force a re-render when we replace the snapshot — the ref change alone
  // doesn't trigger one. Bumping this counter is the cheapest way to do it.
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  const ptDirty = useMemo(
    () => arePtSourceFieldsDirty(ptSnapshotRef.current, ptSource),
    // `snapshotVersion` is in the dep list because the eslint-no-unused-deps
    // rule is OK with it and it's exactly the signal we want — recompute
    // whenever the snapshot moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ptSource, snapshotVersion],
  );

  const load = useCallback(async () => {
    try {
      const data = await fetchPlaceTranslations(placeId);
      const en = (data.en as PlaceTranslation | undefined) ?? null;
      const es = (data.es as PlaceTranslation | undefined) ?? null;
      setMeta({ en, es });
      setForms({ en: fromTranslation(en), es: fromTranslation(es) });
      setDirty({ en: false, es: false });
    } catch { /* ignore — translations may not exist yet */ }
    finally { setLoading(false); }
  }, [placeId]);

  // Reset the dirty-state baseline whenever the underlying place changes
  // (e.g. the editor navigates from one place edit page to another via
  // a client-side push) so the regenerate button doesn't carry a stale
  // dirty signal across places.
  useEffect(() => {
    ptSnapshotRef.current = getPtSource();
    setSnapshotVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  useEffect(() => { load(); }, [load]);

  const ptHasName = Boolean(ptName?.trim());

  function setField(locale: AutoLocale, key: keyof LocaleFormState, value: string) {
    setForms((prev) => ({ ...prev, [locale]: { ...prev[locale], [key]: value } }));
    setDirty((prev) => ({ ...prev, [locale]: true }));
  }

  async function handleSave(locale: AutoLocale) {
    setBusy((prev) => ({ ...prev, [locale]: "save" }));
    setMessage(null);
    try {
      await updateTranslationOverride(placeId, locale, toBody(forms[locale]));
      setMessage({ kind: "ok", text: pf.translationSaved });
      await load();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const text = err instanceof Error ? `${pf.translationSaveFailed} ${err.message}` : pf.translationSaveFailed;
      setMessage({ kind: "err", text });
    } finally {
      setBusy((prev) => ({ ...prev, [locale]: undefined }));
    }
  }

  async function handleRegenerate(targets: AutoLocale[]) {
    const pt = getPtSource();
    if (!pt.name?.trim()) {
      setMessage({ kind: "err", text: pf.regenerateNeedsPt });
      return;
    }

    const key = targets.length === 1 ? targets[0] : "all";
    setBusy((prev) => ({ ...prev, [key]: "regenerate" }));
    setMessage(null);

    try {
      // Use inline PT source so unsaved edits are honored. persist=true writes
      // the auto-translation rows; the UI reloads to pick them up.
      const res = await regenerateTranslation(placeId, {
        source: "pt",
        text: ptSourceToBody(pt),
        targets,
        persist: true,
      });

      const ok = res.succeeded.length;
      const fail = res.failed.length;
      // ── Build the per-cause notes ────────────────────────────────────
      // The backend distinguishes three outcomes per requested target:
      //   • succeeded          — wrote the row.
      //   • skippedOverridden  — left untouched because translation_override = true.
      //   • failed             — DeepL or upsert threw; no row was written.
      //
      // We surface each separately so the editor knows whether to
      // unlock an override, retry the regen later, or escalate (DeepL
      // outage). Older API responses may omit one or both arrays — the
      // `?? []` keeps the dashboard rendering even when the API hasn't
      // been redeployed.
      const skipped = ((res as unknown as { skippedOverridden?: string[] }).skippedOverridden) ?? [];
      const failedLocales = (res.failed as readonly string[]) ?? [];

      const skippedNote = skipped.length > 0
        ? ((pf as { regenerateSkippedOverridden?: string }).regenerateSkippedOverridden ??
            "Skipped: {{locales}} (manual override).")
            .replace("{{locales}}", skipped.join(", ").toUpperCase())
        : null;
      const failedNote = failedLocales.length > 0
        ? ((pf as { regenerateFailedLocales?: string }).regenerateFailedLocales ??
            "Failed: {{locales}}. The translation service may be temporarily unavailable.")
            .replace("{{locales}}", failedLocales.join(", ").toUpperCase())
        : null;

      if (fail === 0 && ok > 0) {
        setMessage({
          kind: "ok",
          text: [targets.length === 2 ? pf.regenerateAllSucceeded : pf.regenerated, skippedNote]
            .filter(Boolean)
            .join(" "),
        });
        // Successful regen → EN/ES are now in sync with the current PT
        // source. Move the snapshot forward so the regenerate button
        // disables until the editor types more PT changes. We snapshot
        // *the source we sent*, not getPtSource() at this instant, so a
        // race where the editor types between the request and this point
        // doesn't leave the button stuck-disabled — `arePtSourceFieldsDirty`
        // will see the new edits as dirty against the just-sent baseline.
        ptSnapshotRef.current = pt;
        setSnapshotVersion((v) => v + 1);
      } else if (ok === 0) {
        // Total failure — report it with the affected locales so the
        // editor knows whether to retry now or after a DeepL hiccup
        // settles. Skipped overrides also get appended so the editor
        // doesn't think the override is the cause of the failure.
        setMessage({
          kind: "err",
          text: [pf.regenerateFailed, failedNote, skippedNote].filter(Boolean).join(" "),
        });
      } else {
        // Partial success — at least one locale wrote, at least one
        // didn't. List both `failed` and `skippedOverridden` separately
        // so the editor can act on each.
        setMessage({
          kind: "err",
          text: [
            pf.regeneratePartial.replace("{{ok}}", String(ok)).replace("{{fail}}", String(fail)),
            failedNote,
            skippedNote,
          ].filter(Boolean).join(" "),
        });
      }

      await load();
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      const text = err instanceof Error ? `${pf.regenerateFailed} ${err.message}` : pf.regenerateFailed;
      setMessage({ kind: "err", text });
    } finally {
      setBusy((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  if (loading) {
    return <p className="text-sm text-muted py-3">{t.common.loading}</p>;
  }

  // ── Bulk regenerate gating ────────────────────────────────────────────────
  // The button has THREE states:
  //   1. ptHasName === false → disabled, "add a Portuguese name first" tooltip.
  //      We can't call DeepL with an empty source.
  //   2. ptDirty === false  → disabled, "no Portuguese changes to translate"
  //      copy. EN/ES already match the on-disk PT — there's nothing for the
  //      editor to push.
  //   3. ptDirty === true   → enabled, "Portuguese content changed — regenerate
  //      translations" copy. The editor has typed PT changes that haven't
  //      been propagated yet.
  const regenerateBlockedReason = !ptHasName
    ? pf.regenerateNeedsPt
    : !ptDirty
      ? ((pf as { regenerateAllDisabled?: string }).regenerateAllDisabled ?? "No Portuguese changes to translate")
      : null;
  const regenerateLabelDirty =
    (pf as { regenerateAllPending?: string }).regenerateAllPending ??
    "Portuguese content changed — regenerate translations";
  const regenerateLabel = busy.all === "regenerate"
    ? pf.regenerating
    : ptDirty
      ? regenerateLabelDirty
      : pf.regenerateAll;
  const regenerateDisabled =
    !ptHasName ||
    !ptDirty ||
    Boolean(busy.all) ||
    Boolean(busy.en) ||
    Boolean(busy.es);

  return (
    <div className="flex flex-col gap-5">
      {/* Header note + global regenerate */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="text-xs text-muted leading-relaxed max-w-md">
          {pf.regenerateNote}
        </p>
        <button
          type="button"
          onClick={() => handleRegenerate(["en", "es"])}
          disabled={regenerateDisabled}
          // When dirty + enabled the button gets a stronger visual treatment
          // (gold background, white text) so the editor reads it as "action
          // pending". When clean it stays subdued so they're not nagged.
          className={`self-start md:self-auto px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
            ptDirty && !regenerateDisabled
              ? "bg-gold text-white hover:bg-gold-dark"
              : "bg-surface text-muted border border-border hover:text-text"
          }`}
          title={regenerateBlockedReason ?? undefined}
          aria-disabled={regenerateDisabled}
        >
          {regenerateLabel}
        </button>
      </div>

      {/* Inline status message — visible right next to the actions */}
      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            message.kind === "ok"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LocaleBlock
          locale="en"
          title={pf.translationLanguageEn}
          meta={meta.en}
          form={forms.en}
          dirty={dirty.en}
          ptHasName={ptHasName}
          busy={busy.en}
          regenerateBusy={busy.all === "regenerate"}
          onChange={(k, v) => setField("en", k, v)}
          onSave={() => handleSave("en")}
          onRegenerate={() => handleRegenerate(["en"])}
        />
        <LocaleBlock
          locale="es"
          title={pf.translationLanguageEs}
          meta={meta.es}
          form={forms.es}
          dirty={dirty.es}
          ptHasName={ptHasName}
          busy={busy.es}
          regenerateBusy={busy.all === "regenerate"}
          onChange={(k, v) => setField("es", k, v)}
          onSave={() => handleSave("es")}
          onRegenerate={() => handleRegenerate(["es"])}
        />
      </div>
    </div>
  );
}

interface LocaleBlockProps {
  locale: AutoLocale;
  title: string;
  meta: PlaceTranslation | null;
  form: LocaleFormState;
  dirty: boolean;
  ptHasName: boolean;
  busy: "save" | "regenerate" | undefined;
  regenerateBusy: boolean;
  onChange: (key: keyof LocaleFormState, value: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
}

function LocaleBlock({
  locale,
  title,
  meta,
  form,
  dirty,
  ptHasName,
  busy,
  regenerateBusy,
  onChange,
  onSave,
  onRegenerate,
}: LocaleBlockProps) {
  const t = useT();
  const pf = t.placeForm;

  const isOverride = meta?.translation_override ?? false;
  const sourceCode = (meta?.translated_from ?? "").toLowerCase();
  const sourceName =
    sourceCode === "pt"
      ? pf.translationLanguagePt
      : sourceCode === "en"
        ? pf.translationLanguageEn
        : sourceCode === "es"
          ? pf.translationLanguageEs
          : pf.sourceUnknown;

  const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold";

  return (
    <div className="rounded-xl border border-border bg-white p-4 flex flex-col gap-3">
      {/* Header: language + status badges */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">{title}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted bg-surface border border-border rounded px-1.5 py-0.5">
              {locale}
            </span>
          </div>
          <p className="text-[11px] text-muted mt-1">
            {pf.sourceLabel}: <span className="font-medium text-text">{sourceName}</span>
            {sourceCode && ` · ${pf.fromSource.replace("{{source}}", sourceName)}`}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            isOverride
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
          }`}
        >
          {isOverride ? pf.statusManual : pf.statusAuto}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <TransField label={pf.fieldName} value={form.name} onChange={(v) => onChange("name", v)} cls={inputCls} />
        <TransField label={pf.shortDescription} value={form.shortDescription} onChange={(v) => onChange("shortDescription", v)} cls={inputCls} />
        <TransField label={pf.fullDescription} value={form.fullDescription} onChange={(v) => onChange("fullDescription", v)} cls={inputCls} multiline rows={4} />
        <TransField label={pf.goldenbookNote} value={form.goldenbookNote} onChange={(v) => onChange("goldenbookNote", v)} cls={inputCls} multiline rows={2} />
        <TransField label={pf.insiderTip} value={form.insiderTip} onChange={(v) => onChange("insiderTip", v)} cls={inputCls} />
      </div>

      <div className="flex items-center gap-2 flex-wrap pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || busy === "save"}
          className="px-3 py-1.5 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "save" ? t.common.saving : pf.saveTranslation}
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={!ptHasName || busy === "regenerate" || regenerateBusy}
          className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-text hover:border-gold/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title={ptHasName ? undefined : pf.regenerateNeedsPt}
        >
          {busy === "regenerate" ? pf.regenerating : pf.regenerateFromPt}
        </button>
      </div>
    </div>
  );
}

function TransField({
  label,
  value,
  onChange,
  cls,
  multiline,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  cls: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-muted mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={cls} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}
