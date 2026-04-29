// ─── Translation policy for place editorial fields ──────────────────────────
//
// Portuguese is the canonical editorial source. EN and ES rows are auto-
// translated from PT and may be overridden by editors via the dedicated
// translations editor. The functions here encode the *decisions* (no DB
// access, no DeepL calls) so they can be unit-tested in isolation.

export type TranslationLocale = 'pt' | 'en' | 'es'

export const CANONICAL_LOCALE: TranslationLocale = 'pt'

export const AUTO_TARGET_LOCALES: ReadonlyArray<Exclude<TranslationLocale, 'pt'>> =
  ['en', 'es'] as const

/**
 * Given the set of locales the caller wants to regenerate and the per-locale
 * override flags currently on disk, return the locales that should actually
 * be touched.
 *
 * Manual overrides MUST be protected — an editor who explicitly curated EN
 * or ES copy never wants the bulk regenerate button to clobber it. The
 * source locale is also dropped (translating PT → PT is a no-op and would
 * be a foot-gun if a future caller ever passes the source in `targets`).
 */
export function resolveRegenerateTargets(input: {
  source: TranslationLocale
  targets: ReadonlyArray<TranslationLocale>
  overrides: Partial<Record<TranslationLocale, boolean>>
}): {
  toRegenerate: TranslationLocale[]
  skippedOverridden: TranslationLocale[]
  skippedSameAsSource: TranslationLocale[]
} {
  const toRegenerate: TranslationLocale[] = []
  const skippedOverridden: TranslationLocale[] = []
  const skippedSameAsSource: TranslationLocale[] = []

  for (const target of input.targets) {
    if (target === input.source) {
      skippedSameAsSource.push(target)
      continue
    }
    if (input.overrides[target]) {
      skippedOverridden.push(target)
      continue
    }
    toRegenerate.push(target)
  }
  return { toRegenerate, skippedOverridden, skippedSameAsSource }
}

/**
 * Pick the canonical PT fields to write given the source locale of the
 * incoming data. When the caller hands us EN content we still need a PT row
 * to write — `translateEn` is invoked to produce it. The function lets
 * callers thread DeepL through without this module knowing about it.
 */
export interface EditorialFields {
  name: string
  short_description: string | null
  full_description: string | null
  goldenbook_note: string | null
  insider_tip: string | null
}

export async function resolveCanonicalPortuguese(
  source: TranslationLocale,
  fields: EditorialFields,
  translateToPortuguese: (f: EditorialFields, sourceLocale: TranslationLocale) => Promise<EditorialFields>,
): Promise<EditorialFields> {
  if (source === 'pt') return fields
  return translateToPortuguese(fields, source)
}

/**
 * The set of editorial source fields whose changes should mark the
 * Portuguese-source dirty state on the dashboard. Kept here so the
 * dashboard and the API agree on what "PT changed" means.
 */
export const PT_SOURCE_FIELDS = [
  'name',
  'short_description',
  'full_description',
  'goldenbook_note',
  'insider_tip',
] as const

export type PtSourceFieldKey = typeof PT_SOURCE_FIELDS[number]
