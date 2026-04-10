#!/usr/bin/env npx tsx
// ─── Import remaining 58 editorial notes ────────────────────────────────────
//
// Reads docs/remaining_editorial_notes.json and imports into DB.
// Uses fuzzy name matching (normalizes quotes, dashes, accents).
//
// Usage:
//   npx tsx scripts/import-remaining-editorial.ts
//   npx tsx scripts/import-remaining-editorial.ts --dry-run

import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from '../api/src/db/postgres'
import { translateText } from '../api/src/lib/translation/deepl'

const DRY_RUN = process.argv.includes('--dry-run')

interface EditorialEntry {
  name: string
  goldenbook_note: string
  insider_tip: string
}

interface PlaceRow {
  id: string
  name: string
}

/** Aggressive normalization: lowercase, strip accents, normalize all quotes/dashes/spaces */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')           // accents
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'") // smart quotes → straight
    .replace(/[\u2013\u2014]/g, '-')           // en/em dash → hyphen
    .replace(/-\s*/g, '- ')                    // normalize dash spacing
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Import Remaining Editorial Notes (58)')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`${'═'.repeat(60)}\n`)

  const dataPath = join(__dirname, '..', 'docs', 'remaining_editorial_notes.json')
  const entries: EditorialEntry[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
  console.log(`Loaded ${entries.length} entries\n`)

  // Load all places
  const { rows: places } = await db.query<PlaceRow>(`
    SELECT id, name FROM places
    WHERE status = 'published' AND is_active = true
  `)

  // Build fuzzy lookup
  const placeByNorm = new Map<string, PlaceRow>()
  for (const p of places) {
    placeByNorm.set(normalize(p.name), p)
  }
  console.log(`Loaded ${places.length} places (${placeByNorm.size} normalized)\n`)

  let updated = 0
  let noMatch = 0
  let failed = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const norm = normalize(entry.name)
    const place = placeByNorm.get(norm)

    if (!place) {
      noMatch++
      console.log(`  [${i + 1}/${entries.length}] ✗ NO MATCH: "${entry.name}" (norm: "${norm}")`)
      continue
    }

    if (DRY_RUN) {
      console.log(`  [${i + 1}/${entries.length}] ✓ ${place.name}`)
      console.log(`    Note: ${entry.goldenbook_note.substring(0, 80)}...`)
      updated++
      continue
    }

    // Translate
    let notePt: string, noteEs: string, tipPt: string, tipEs: string
    try {
      ;[notePt, noteEs, tipPt, tipEs] = await Promise.all([
        translateText(entry.goldenbook_note, 'pt', 'en'),
        translateText(entry.goldenbook_note, 'es', 'en'),
        translateText(entry.insider_tip, 'pt', 'en'),
        translateText(entry.insider_tip, 'es', 'en'),
      ])
    } catch (err) {
      failed++
      console.error(`  [${i + 1}/${entries.length}] ✗ TRANSLATION FAILED: ${place.name}`, err)
      continue
    }

    // Upsert EN
    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
      VALUES ($1, 'en', $2, $3, $4)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        goldenbook_note = EXCLUDED.goldenbook_note,
        insider_tip = EXCLUDED.insider_tip,
        updated_at = now()
    `, [place.id, place.name, entry.goldenbook_note, entry.insider_tip])

    // Upsert PT
    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
      VALUES ($1, 'pt', $2, $3, $4)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        goldenbook_note = EXCLUDED.goldenbook_note,
        insider_tip = EXCLUDED.insider_tip,
        updated_at = now()
    `, [place.id, place.name, notePt, tipPt])

    // Upsert ES
    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
      VALUES ($1, 'es', $2, $3, $4)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        goldenbook_note = EXCLUDED.goldenbook_note,
        insider_tip = EXCLUDED.insider_tip,
        updated_at = now()
    `, [place.id, place.name, noteEs, tipEs])

    updated++
    console.log(`  [${i + 1}/${entries.length}] ✓ ${place.name}`)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  IMPORT REPORT')
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Total entries:      ${entries.length}`)
  console.log(`  Updated (EN/PT/ES): ${updated}`)
  console.log(`  No match:           ${noMatch}`)
  console.log(`  Failed:             ${failed}`)
  console.log(`${'═'.repeat(60)}\n`)

  await db.end()
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error(err)
  await db.end()
  process.exit(1)
})
