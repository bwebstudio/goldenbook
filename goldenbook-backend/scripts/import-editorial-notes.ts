#!/usr/bin/env npx tsx
// ─── Import Editorial Notes ──────────────────────────────────────────────────
//
// Reads docs/new_editorial_notes.json and imports goldenbook_note + insider_tip
// into place_translations for EN, PT, and ES locales.
//
// Safety:
//   - Skips places that already have goldenbook_note OR insider_tip in EN
//   - Matches by normalized name (lowercase, no accents, trimmed)
//   - Idempotent: safe to run multiple times
//
// Usage:
//   npx tsx scripts/import-editorial-notes.ts
//   npx tsx scripts/import-editorial-notes.ts --dry-run

import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from '../api/src/db/postgres'
import { translateText } from '../api/src/lib/translation/deepl'

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')

// ─── Types ──────────────────────────────────────────────────────────────────

interface EditorialEntry {
  name: string
  goldenbook_note: string
  insider_tip: string
}

interface PlaceRow {
  id: string
  name: string
  name_normalized: string
}

interface ExistingEditorial {
  place_id: string
  goldenbook_note: string | null
  insider_tip: string | null
}

// ─── Normalization ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove accents
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Import Editorial Notes')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${FORCE ? ' (FORCE — overwrite auto-generated)' : ''}`)
  console.log(`${'═'.repeat(60)}\n`)

  // 1. Load dataset
  const dataPath = join(__dirname, '..', 'docs', 'new_editorial_notes.json')
  const entries: EditorialEntry[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
  console.log(`Loaded ${entries.length} editorial entries\n`)

  // 2. Load all published places with normalized names
  const { rows: places } = await db.query<PlaceRow>(`
    SELECT
      id,
      name,
      lower(
        translate(
          name,
          'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäåéèêëíìîïóòôõöúùûüçñ',
          'AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiioooooouuuucn'
        )
      ) AS name_normalized
    FROM places
    WHERE status = 'published' AND is_active = true
  `)

  // Build lookup: normalized name → place (first match wins for exact)
  const placeByName = new Map<string, PlaceRow>()
  for (const p of places) {
    const key = p.name_normalized.trim()
    if (!placeByName.has(key)) {
      placeByName.set(key, p)
    }
  }
  console.log(`Loaded ${places.length} places from DB (${placeByName.size} unique normalized names)\n`)

  // 3. Load existing editorial content (EN locale)
  // Default mode: skip any place that already has editorial content.
  // --force mode: overwrite all (this dataset is hand-written, higher quality than auto-generated).
  let existingEditorial = new Set<string>()
  if (!FORCE) {
    const { rows: existingRows } = await db.query<ExistingEditorial>(`
      SELECT place_id, goldenbook_note, insider_tip
      FROM place_translations
      WHERE locale = 'en'
        AND (goldenbook_note IS NOT NULL AND goldenbook_note != ''
             OR insider_tip IS NOT NULL AND insider_tip != '')
    `)
    existingEditorial = new Set(existingRows.map(r => r.place_id))
    console.log(`Found ${existingEditorial.size} places with existing editorial content (protected)\n`)
  } else {
    console.log(`FORCE mode: will overwrite auto-generated content\n`)
  }

  // 4. Process entries
  let updated = 0
  let skippedExisting = 0
  let skippedNoMatch = 0
  let failed = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const normalizedName = normalize(entry.name)

    // Find matching place
    const place = placeByName.get(normalizedName)
    if (!place) {
      skippedNoMatch++
      console.log(`  [${i + 1}/${entries.length}] ✗ NO MATCH: "${entry.name}"`)
      continue
    }

    // Check if already has editorial content
    if (existingEditorial.has(place.id)) {
      skippedExisting++
      if (i < 20 || DRY_RUN) { // Only log first 20 to avoid noise
        console.log(`  [${i + 1}/${entries.length}] ⊘ SKIP (existing): ${place.name}`)
      }
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

    console.log(`  [${i + 1}/${entries.length}] ✓ ${place.name}`)
    if (DRY_RUN) {
      console.log(`    EN note: ${entry.goldenbook_note.substring(0, 70)}...`)
      console.log(`    PT note: ${notePt.substring(0, 70)}...`)
      console.log(`    ES note: ${noteEs.substring(0, 70)}...`)
      console.log(`    EN tip:  ${entry.insider_tip.substring(0, 70)}...`)
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
        goldenbook_note = COALESCE(EXCLUDED.goldenbook_note, place_translations.goldenbook_note),
        insider_tip = COALESCE(EXCLUDED.insider_tip, place_translations.insider_tip),
        updated_at = now()
    `, [place.id, place.name, notePt, tipPt])

    // Upsert ES
    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
      VALUES ($1, 'es', $2, $3, $4)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        goldenbook_note = COALESCE(EXCLUDED.goldenbook_note, place_translations.goldenbook_note),
        insider_tip = COALESCE(EXCLUDED.insider_tip, place_translations.insider_tip),
        updated_at = now()
    `, [place.id, place.name, noteEs, tipEs])

    updated++
  }

  // 5. Report
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  IMPORT REPORT')
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Total entries processed:    ${entries.length}`)
  console.log(`  Places updated:             ${updated}`)
  console.log(`  Skipped (already had notes): ${skippedExisting}`)
  console.log(`  Skipped (no matching place): ${skippedNoMatch}`)
  console.log(`  Failed (translation error):  ${failed}`)
  console.log(`${'═'.repeat(60)}\n`)

  await db.end()
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error(err)
  await db.end()
  process.exit(1)
})
