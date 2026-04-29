// ─── Translation Policy Tests ──────────────────────────────────────────────
//
// These tests verify the canonical-locale switch (PT-first) at the level of
// the pure decision functions. They do NOT touch the database or DeepL — the
// query module composes these helpers with side-effecting upserts that are
// covered by integration tests elsewhere.
//
// Specifically:
//   1. `resolveRegenerateTargets` skips locales whose `translation_override`
//      flag is set, regardless of which targets the caller asked for.
//   2. The same function never tries to regenerate the source locale onto
//      itself (that would be a no-op and a footgun if a future caller passes
//      `pt` through `targets` while `source = pt`).
//   3. `resolveCanonicalPortuguese` returns the input untouched when the
//      source is already 'pt' (no DeepL call), and runs the supplied
//      translator only when the source is 'en'. This is the contract that
//      the EN-import path on `createPlace` relies on.

import { describe, it, expect } from 'vitest'
import {
  AUTO_TARGET_LOCALES,
  CANONICAL_LOCALE,
  resolveCanonicalPortuguese,
  resolveRegenerateTargets,
  type EditorialFields,
} from '../translation-policy'

describe('canonical locale', () => {
  it('is Portuguese', () => {
    // The whole product depends on this constant being 'pt'. If it ever
    // changes, every consumer (dashboard form labels, mobile reads,
    // `fetchPlaceBySlug` default) breaks in lockstep — the tests below
    // assume PT in their fixtures, so this assertion makes the contract
    // visible at the top of the file.
    expect(CANONICAL_LOCALE).toBe('pt')
  })

  it('auto-translates exactly EN and ES from PT', () => {
    expect([...AUTO_TARGET_LOCALES].sort()).toEqual(['en', 'es'])
  })
})

describe('resolveRegenerateTargets', () => {
  it('regenerates EN and ES when no overrides are set', () => {
    const result = resolveRegenerateTargets({
      source: 'pt',
      targets: ['en', 'es'],
      overrides: {},
    })

    expect(result.toRegenerate).toEqual(['en', 'es'])
    expect(result.skippedOverridden).toEqual([])
    expect(result.skippedSameAsSource).toEqual([])
  })

  it('skips a target whose translation_override is true (EN locked)', () => {
    // Spec: "if place_translations.en.translation_override = true, do not
    // overwrite EN". The bulk regenerate button still asks for both EN and
    // ES — the policy must transparently drop EN.
    const result = resolveRegenerateTargets({
      source: 'pt',
      targets: ['en', 'es'],
      overrides: { en: true, es: false },
    })

    expect(result.toRegenerate).toEqual(['es'])
    expect(result.skippedOverridden).toEqual(['en'])
  })

  it('skips a target whose translation_override is true (ES locked)', () => {
    const result = resolveRegenerateTargets({
      source: 'pt',
      targets: ['en', 'es'],
      overrides: { en: false, es: true },
    })

    expect(result.toRegenerate).toEqual(['en'])
    expect(result.skippedOverridden).toEqual(['es'])
  })

  it('skips both when both EN and ES are overridden', () => {
    // Editor curated both manual translations and clicks regenerate. The
    // spec is unambiguous — both must be left alone, even though the
    // request explicitly asked for them. The dashboard surfaces this back
    // to the editor via `skippedOverridden`.
    const result = resolveRegenerateTargets({
      source: 'pt',
      targets: ['en', 'es'],
      overrides: { en: true, es: true },
    })

    expect(result.toRegenerate).toEqual([])
    expect(result.skippedOverridden).toEqual(['en', 'es'])
  })

  it('never regenerates the source locale onto itself', () => {
    // Belt-and-suspenders: if a caller mistakenly passes `pt` in `targets`
    // while `source = pt`, the policy drops it. Translating PT → PT would
    // either be a no-op or (in DeepL's case) fail with "same source and
    // target locale". Either way, not what the caller meant.
    const result = resolveRegenerateTargets({
      source: 'pt',
      targets: ['pt', 'en', 'es'],
      overrides: {},
    })

    expect(result.toRegenerate).toEqual(['en', 'es'])
    expect(result.skippedSameAsSource).toEqual(['pt'])
  })

  it('does not treat undefined override as "skip"', () => {
    // A missing key in `overrides` means the row either doesn't exist yet
    // or the editor never set the flag. Both cases mean "go ahead and
    // overwrite" — only `true` gates the skip. This guards against the
    // common bug of `if (overrides[locale])` flipping behavior on empty
    // objects.
    const result = resolveRegenerateTargets({
      source: 'pt',
      targets: ['en', 'es'],
      overrides: { en: undefined },
    })

    expect(result.toRegenerate).toEqual(['en', 'es'])
  })
})

describe('resolveCanonicalPortuguese', () => {
  const sample: EditorialFields = {
    name: 'Pastéis de Belém',
    short_description: 'A iconic pastry shop',
    full_description: 'Long form description',
    goldenbook_note: 'Editorial note',
    insider_tip: 'Insider tip',
  }

  it('passes PT input through unchanged (no translator call)', async () => {
    // When the dashboard form posts PT content, we must NOT invoke the
    // translator — that would burn DeepL quota and risk altering the
    // editor's exact wording. The translator argument here throws if
    // called so the test fails loudly on regression.
    const translator = async (): Promise<EditorialFields> => {
      throw new Error('translator should not be called when source is already PT')
    }

    const result = await resolveCanonicalPortuguese('pt', sample, translator)

    expect(result).toEqual(sample)
  })

  it('translates EN input to PT before returning the canonical row', async () => {
    // Simulates the Google import path: the caller hands us EN content
    // (sourceLocale='en' on createPlace) and the canonical row written to
    // place_translations.locale='pt' is the translated version.
    let calledWith: { fields: EditorialFields; sourceLocale: string } | null = null
    const translator = async (
      fields: EditorialFields,
      sourceLocale: 'pt' | 'en' | 'es',
    ): Promise<EditorialFields> => {
      calledWith = { fields, sourceLocale }
      return { ...fields, name: 'Pastéis de Belém [PT]' }
    }

    const result = await resolveCanonicalPortuguese('en', sample, translator)

    expect(calledWith).not.toBeNull()
    expect(calledWith!.sourceLocale).toBe('en')
    expect(result.name).toBe('Pastéis de Belém [PT]')
  })
})
