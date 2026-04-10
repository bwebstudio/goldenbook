#!/usr/bin/env npx tsx
// ─── Backfill Editorial Translations ────────────────────────────────────────
//
// Translates ONLY goldenbook_note + insider_tip from EN → PT and EN → ES.
// Does NOT touch name, short_description, or full_description — those
// may contain original owner-submitted Portuguese text that should not
// be overwritten with machine re-translations.
//
// Safe to re-run: overwrites existing editorial translations with fresh ones.
//
// Usage:
//   npx tsx scripts/backfill-editorial-translations.ts
//   npx tsx scripts/backfill-editorial-translations.ts --dry-run

import { db } from '../api/src/db/postgres'
import { translateText } from '../api/src/lib/translation/deepl'

const DRY_RUN = process.argv.includes('--dry-run')

type TargetLocale = 'pt' | 'es'
const TARGET_LOCALES: TargetLocale[] = ['pt', 'es']

interface EditorialSource {
  place_id: string
  name: string
  goldenbook_note: string | null
  insider_tip: string | null
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Editorial Translation Backfill')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  Fields: goldenbook_note, insider_tip only`)
  console.log(`  Targets: PT, ES`)
  console.log(`${'═'.repeat(60)}\n`)

  // Load all EN editorial fields
  const { rows } = await db.query<EditorialSource>(`
    SELECT
      pt.place_id,
      COALESCE(pt.name, p.name) AS name,
      pt.goldenbook_note,
      pt.insider_tip
    FROM place_translations pt
    JOIN places p ON p.id = pt.place_id
    WHERE pt.locale = 'en'
      AND (pt.goldenbook_note IS NOT NULL AND pt.goldenbook_note != ''
           OR pt.insider_tip IS NOT NULL AND pt.insider_tip != '')
  `)

  console.log(`Found ${rows.length} places with editorial content to translate\n`)

  let translated = 0
  let failed = 0
  let skipped = 0

  for (const place of rows) {
    if (!place.goldenbook_note && !place.insider_tip) {
      skipped++
      continue
    }

    try {
      for (const locale of TARGET_LOCALES) {
        const noteTranslated = place.goldenbook_note
          ? await translateText(place.goldenbook_note, locale, 'en')
          : null
        const tipTranslated = place.insider_tip
          ? await translateText(place.insider_tip, locale, 'en')
          : null

        if (DRY_RUN) {
          if (noteTranslated) console.log(`  [${locale}] note: ${noteTranslated.substring(0, 80)}...`)
          if (tipTranslated) console.log(`  [${locale}] tip:  ${tipTranslated.substring(0, 80)}...`)
        } else {
          // Upsert only editorial fields — COALESCE preserves existing name/desc
          await db.query(`
            INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (place_id, locale) DO UPDATE SET
              goldenbook_note = COALESCE(EXCLUDED.goldenbook_note, place_translations.goldenbook_note),
              insider_tip = COALESCE(EXCLUDED.insider_tip, place_translations.insider_tip),
              updated_at = now()
          `, [place.place_id, locale, place.name, noteTranslated, tipTranslated])
        }
      }

      translated++
      if (translated % 20 === 0) {
        console.log(`  Processed ${translated}/${rows.length}`)
      }
    } catch (error) {
      failed++
      console.error(`  Failed place ${place.place_id}:`, error)
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  TRANSLATION BACKFILL REPORT')
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Total:       ${rows.length}`)
  console.log(`  Translated:  ${translated}`)
  console.log(`  Skipped:     ${skipped}`)
  console.log(`  Failed:      ${failed}`)
  console.log(`${'═'.repeat(60)}\n`)

  await db.end()
  if (failed > 0) process.exit(1)
}

main().catch(async (error) => {
  console.error(error)
  await db.end()
  process.exit(1)
})
