#!/usr/bin/env npx tsx
// ─── Import Editorial Notes from TXT ────────────────────────────────────────
//
// Parses docs/new_editorial_notes.txt and imports goldenbook_note + insider_tip
// into place_translations for EN, PT, and ES locales.
//
// This is the AUTHORITATIVE editorial dataset — it overwrites auto-generated
// content for all matching places.
//
// Usage:
//   npx tsx scripts/import-editorial-notes-txt.ts
//   npx tsx scripts/import-editorial-notes-txt.ts --dry-run

import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from '../api/src/db/postgres'
import { translateText } from '../api/src/lib/translation/deepl'

const DRY_RUN = process.argv.includes('--dry-run')

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

// ─── Parser ─────────────────────────────────────────────────────────────────

function parseTxtFile(filePath: string): EditorialEntry[] {
  const raw = readFileSync(filePath, 'utf-8')
  const entries: EditorialEntry[] = []

  // Split by --- separator
  const blocks = raw.split(/^---$/m)

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('_')) continue

    const nameMatch = trimmed.match(/^Name:\s*(.+)$/m)
    const noteMatch = trimmed.match(/^Goldenbook Note:\s*\n(.+)$/m)
    const tipMatch = trimmed.match(/^Insider Tip:\s*\n(.+)$/m)

    if (nameMatch && noteMatch && tipMatch) {
      entries.push({
        name: nameMatch[1].trim(),
        goldenbook_note: noteMatch[1].trim(),
        insider_tip: tipMatch[1].trim(),
      })
    }
  }

  return entries
}

// ─── Normalization ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Import Editorial Notes (TXT)')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`${'═'.repeat(60)}\n`)

  // 1. Parse dataset
  const dataPath = join(__dirname, '..', 'docs', 'new_editorial_notes.txt')
  const entries = parseTxtFile(dataPath)
  console.log(`Parsed ${entries.length} editorial entries\n`)

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

  // Build lookup: normalized name → place
  const placeByName = new Map<string, PlaceRow>()
  for (const p of places) {
    const key = p.name_normalized.trim()
    if (!placeByName.has(key)) {
      placeByName.set(key, p)
    }
  }
  console.log(`Loaded ${places.length} places (${placeByName.size} unique names)\n`)

  // 3. Process entries
  let updated = 0
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

    if (DRY_RUN) {
      console.log(`  [${i + 1}/${entries.length}] ✓ MATCH: ${place.name}`)
      console.log(`    Note: ${entry.goldenbook_note.substring(0, 80)}...`)
      console.log(`    Tip:  ${entry.insider_tip.substring(0, 80)}...`)
      updated++
      continue
    }

    // Translate EN → PT and ES
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

    // Upsert EN — overwrite existing
    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
      VALUES ($1, 'en', $2, $3, $4)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        goldenbook_note = EXCLUDED.goldenbook_note,
        insider_tip = EXCLUDED.insider_tip,
        updated_at = now()
    `, [place.id, place.name, entry.goldenbook_note, entry.insider_tip])

    // Upsert PT — overwrite note/tip only
    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
      VALUES ($1, 'pt', $2, $3, $4)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        goldenbook_note = EXCLUDED.goldenbook_note,
        insider_tip = EXCLUDED.insider_tip,
        updated_at = now()
    `, [place.id, place.name, notePt, tipPt])

    // Upsert ES — overwrite note/tip only
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

  // Report
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  IMPORT REPORT')
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Total entries:              ${entries.length}`)
  console.log(`  Places updated (EN/PT/ES):  ${updated}`)
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
