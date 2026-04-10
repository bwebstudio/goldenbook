#!/usr/bin/env npx tsx
// ─── Import Spanish editorial notes from batch1.txt ─────────────────────────
//
// Parses docs/batch1.txt (hand-written Spanish translations) and updates
// ONLY the ES locale goldenbook_note + insider_tip. Does NOT touch EN or PT.
//
// Usage:
//   npx tsx scripts/import-spanish-editorial.ts
//   npx tsx scripts/import-spanish-editorial.ts --dry-run

import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from '../api/src/db/postgres'

const DRY_RUN = process.argv.includes('--dry-run')

interface SpanishEntry {
  name: string
  goldenbook_note: string
  insider_tip: string
}

interface PlaceRow {
  id: string
  name: string
}

// ─── Parser ─────────────────────────────────────────────────────────────────

function parseBatch1(filePath: string): SpanishEntry[] {
  const raw = readFileSync(filePath, 'utf-8')
  const entries: SpanishEntry[] = []
  const blocks = raw.split(/^---$/m)

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('_')) continue

    const nameMatch = trimmed.match(/^Nombre:\s*(.+)$/m)
    const noteMatch = trimmed.match(/^Nota Goldenbook:\s*\n(.+)$/m)
    const tipMatch = trimmed.match(/^Consejo Insider:\s*\n(.+)$/m)

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
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/-\s*/g, '- ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Import Spanish Editorial (batch1.txt)')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  Target: locale = 'es' ONLY`)
  console.log(`${'═'.repeat(60)}\n`)

  const dataPath = join(__dirname, '..', 'docs', 'batch1.txt')
  const entries = parseBatch1(dataPath)
  console.log(`Parsed ${entries.length} Spanish entries\n`)

  // Load all places
  const { rows: places } = await db.query<PlaceRow>(`
    SELECT id, name FROM places
    WHERE status = 'published' AND is_active = true
  `)

  const placeByNorm = new Map<string, PlaceRow>()
  for (const p of places) {
    placeByNorm.set(normalize(p.name), p)
  }
  console.log(`Loaded ${places.length} places (${placeByNorm.size} normalized)\n`)

  let updated = 0
  let noMatch = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const norm = normalize(entry.name)
    const place = placeByNorm.get(norm)

    if (!place) {
      noMatch++
      if (noMatch <= 10) console.log(`  [${i + 1}/${entries.length}] ✗ NO MATCH: "${entry.name}"`)
      continue
    }

    if (DRY_RUN) {
      if (updated < 10) {
        console.log(`  [${i + 1}/${entries.length}] ✓ ${place.name}`)
        console.log(`    ES note: ${entry.goldenbook_note.substring(0, 80)}...`)
        console.log(`    ES tip:  ${entry.insider_tip.substring(0, 80)}...`)
      }
      updated++
      continue
    }

    // Upsert ES locale ONLY
    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
      VALUES ($1, 'es', $2, $3, $4)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        goldenbook_note = EXCLUDED.goldenbook_note,
        insider_tip = EXCLUDED.insider_tip,
        updated_at = now()
    `, [place.id, place.name, entry.goldenbook_note, entry.insider_tip])

    updated++
    console.log(`  [${i + 1}/${entries.length}] ✓ ${place.name}`)
  }

  if (noMatch > 10) console.log(`  ... y ${noMatch - 10} más sin match`)

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  IMPORT REPORT')
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Total entries:      ${entries.length}`)
  console.log(`  Updated (ES only):  ${updated}`)
  console.log(`  No match:           ${noMatch}`)
  console.log(`${'═'.repeat(60)}\n`)

  await db.end()
}

main().catch(async (err) => {
  console.error(err)
  await db.end()
  process.exit(1)
})
