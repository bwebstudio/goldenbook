#!/usr/bin/env npx tsx
// ─── Import Portuguese editorial notes from batch1.txt ──────────────────────
//
// Parses docs/batch1.txt (hand-written PT-PT translations) and updates
// ONLY the PT locale goldenbook_note + insider_tip. Does NOT touch EN or ES.
//
// Usage:
//   npx tsx scripts/import-portuguese-editorial.ts
//   npx tsx scripts/import-portuguese-editorial.ts --dry-run

import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from '../api/src/db/postgres'

const DRY_RUN = process.argv.includes('--dry-run')

interface PtEntry {
  name: string
  goldenbook_note: string
  insider_tip: string
}

interface PlaceRow {
  id: string
  name: string
}

function parseBatch1(filePath: string): PtEntry[] {
  const raw = readFileSync(filePath, 'utf-8')
  const entries: PtEntry[] = []
  const blocks = raw.split(/^---$/m)

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('_')) continue

    const nameMatch = trimmed.match(/^Nome:\s*(.+)$/m)
    const noteMatch = trimmed.match(/^Nota Goldenbook:\s*\n(.+)$/m)
    const tipMatch = trimmed.match(/^Conselho Insider:\s*\n(.+)$/m)

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

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Import Portuguese Editorial (batch1.txt)')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  Target: locale = 'pt' ONLY`)
  console.log(`${'═'.repeat(60)}\n`)

  const dataPath = join(__dirname, '..', 'docs', 'batch1.txt')
  const entries = parseBatch1(dataPath)
  console.log(`Parsed ${entries.length} Portuguese entries\n`)

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
        console.log(`    PT note: ${entry.goldenbook_note.substring(0, 80)}...`)
      }
      updated++
      continue
    }

    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
      VALUES ($1, 'pt', $2, $3, $4)
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
  console.log(`  Updated (PT only):  ${updated}`)
  console.log(`  No match:           ${noMatch}`)
  console.log(`${'═'.repeat(60)}\n`)

  await db.end()
}

main().catch(async (err) => {
  console.error(err)
  await db.end()
  process.exit(1)
})
