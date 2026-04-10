#!/usr/bin/env npx tsx
// ─── Import remaining 22 editorial notes with manual ID mapping ─────────────
//
// These entries didn't match by normalized name due to:
//   - Smart quotes vs straight quotes (75'80 vs 75'80)
//   - Parenthetical location hints (Porto – Matosinhos)
//   - Multi-location entries → applied to all matching DB places
//
// Usage:
//   npx tsx scripts/import-editorial-remaining.ts
//   npx tsx scripts/import-editorial-remaining.ts --dry-run

import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from '../api/src/db/postgres'
import { translateText } from '../api/src/lib/translation/deepl'

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Manual mapping: TXT name → DB place IDs ───────────────────────────────

interface ManualEntry {
  txtName: string
  placeIds: string[]
}

// Resolved from DB search: name + address + city
const MANUAL_MAP: ManualEntry[] = [
  // WILLIE'S — smart quote mismatch
  { txtName: "WILLIE'S", placeIds: ['8dcd5464-d157-17cb-e82b-832d03203996'] },

  // DAVID ROSAS (Lisboa – Zona 31) → El Corte Inglés, Av. Augusto Aguiar 31
  { txtName: 'DAVID ROSAS (Lisboa – Zona 31)', placeIds: ['5cef726b-9ebc-bb02-ba47-138faa027631'] },

  // DAVID ROSAS (Lisboa – second location) → Av. Liberdade 69A
  { txtName: 'DAVID ROSAS (Lisboa – second location)', placeIds: ['4dcd7eb9-2926-b7a7-170f-3e2a41954926'] },

  // ELEMENTS 75'80 LISBOA — curly quote mismatch
  { txtName: "ELEMENTS 75'80 LISBOA", placeIds: ['5cc082ec-5cc0-c90f-518b-956762b9d2d4'] },

  // LOJA DAS MEIAS (first) → Cascais, (second) → Lisboa
  { txtName: 'LOJA DAS MEIAS (first location)', placeIds: ['ecd51a1c-b96b-5454-325b-c797ec789268'] },
  { txtName: 'LOJA DAS MEIAS (second location)', placeIds: ['4ef8832c-57c1-a7e1-75ab-76393b6177cd'] },

  // TUDOR (Lisboa) → Av. Liberdade
  { txtName: 'TUDOR (Lisboa)', placeIds: ['70e985bc-570f-9a90-3d67-69e7dd84dded'] },

  // XERJOFF – Boutique Lisboa — dash mismatch
  { txtName: 'XERJOFF – Boutique Lisboa', placeIds: ['c04152de-c905-b5c7-0fc9-2d9fe25391f0'] },

  // JACARANDÁ – CHAFARIZ — dash mismatch (DB has "- " not " – ")
  { txtName: 'JACARANDÁ – CHAFARIZ', placeIds: ['61f8c9f9-4aa8-1ccf-a7f2-5d098097b843'] },

  // JUSTINO'S MADEIRA WINES — curly quote
  { txtName: "JUSTINO'S MADEIRA WINES", placeIds: ['c04542d2-aa97-2fb3-53bd-35135925e2a3'] },

  // ALCINO (multiple Porto locations) → all 3 Porto Alcino stores
  { txtName: 'ALCINO (multiple Porto locations)', placeIds: [
    '45cff006-93e2-7a11-d389-06e3adf96373',  // Rua das Flores
    '3c72cf2e-f4ba-046c-add7-98bfca2b8b1f',  // Santos Pousada
    'e9b99655-779e-15ae-8f3f-1f07d29cd58a',  // Intercontinental
  ]},

  // BARBOUR (Porto – Matosinhos) → NorteShopping
  { txtName: 'BARBOUR (Porto – Matosinhos)', placeIds: ['af59046e-6698-1917-8212-d76052958a46'] },

  // BARBOUR (Porto – rated location) → Largo dos Lóios, Sé
  { txtName: 'BARBOUR (Porto – rated location)', placeIds: ['23934306-65fa-4375-f4d3-6b718313fbbf'] },

  // DAVID ROSAS (Porto – multiple locations) → all Porto locations
  { txtName: 'DAVID ROSAS (Porto – multiple locations)', placeIds: [
    '70aa9638-8614-ac9c-fa24-6059c94f0de3',  // NorteShopping
    'b0bf6d20-90e8-ec68-caa5-8ec9ce155591',  // Aliados
    'ff79e155-4004-b98e-ed87-e868e26a110a',  // Boavista
  ]},

  // ELEMENTS 75'80 — curly quotes, 3 Porto locations
  { txtName: "ELEMENTS 75'80 MATOSINHOS", placeIds: ['8c3f3c14-db4e-a0bc-c6b5-70f08b422b9f'] },
  { txtName: "ELEMENTS 75'80 PORTO", placeIds: ['189c7484-0ae0-51b9-3acc-4b99929bb080'] },
  { txtName: "ELEMENTS 75'80 SEDE/HEADQUARTERS", placeIds: ['61570384-e032-6b76-6d2d-c7befd7bfef0'] },

  // MACHADO JOALHEIRO (Porto) → Rua 31 de Janeiro
  { txtName: 'MACHADO JOALHEIRO (Porto)', placeIds: ['1e25cfd6-98a8-d995-4326-1e03bfa2a479'] },

  // PALATIAL RESTAURANT (Arcos) → the standalone restaurant (not & Suites)
  { txtName: 'PALATIAL RESTAURANT (Arcos)', placeIds: ['f143066e-95d9-24a8-e186-f0249533ce38'] },

  // ROLEX (Porto) → Rua de Santa Catarina
  { txtName: 'ROLEX (Porto)', placeIds: ['afef13d7-2150-5e87-0fba-820ac289d118'] },

  // THE (Porto – tienda) → THE, Avenida Brasil
  { txtName: 'THE (Porto – tienda)', placeIds: ['7160e0b2-d37d-5611-6471-392948381846'] },

  // TUDOR (Porto) → Senhora da Hora
  { txtName: 'TUDOR (Porto)', placeIds: ['d15b164d-dc2c-5c1d-a1e5-3cc912f065de'] },
]

// ─── Parser ─────────────────────────────────────────────────────────────────

interface EditorialEntry {
  name: string
  goldenbook_note: string
  insider_tip: string
}

function parseTxtFile(filePath: string): EditorialEntry[] {
  const raw = readFileSync(filePath, 'utf-8')
  const entries: EditorialEntry[] = []
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

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Import Remaining 22 Editorial Notes')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`${'═'.repeat(60)}\n`)

  const dataPath = join(__dirname, '..', 'docs', 'new_editorial_notes.txt')
  const allEntries = parseTxtFile(dataPath)

  // Build lookup: TXT name → editorial content
  const entryByName = new Map<string, EditorialEntry>()
  for (const e of allEntries) entryByName.set(e.name, e)

  let updated = 0
  let placeUpdates = 0
  let notFound = 0
  let failed = 0

  for (const mapping of MANUAL_MAP) {
    const entry = entryByName.get(mapping.txtName)
    if (!entry) {
      notFound++
      console.log(`  ✗ TXT entry not found: "${mapping.txtName}"`)
      continue
    }

    // Translate once, apply to all IDs
    let notePt: string, noteEs: string, tipPt: string, tipEs: string
    if (!DRY_RUN) {
      try {
        ;[notePt, noteEs, tipPt, tipEs] = await Promise.all([
          translateText(entry.goldenbook_note, 'pt', 'en'),
          translateText(entry.goldenbook_note, 'es', 'en'),
          translateText(entry.insider_tip, 'pt', 'en'),
          translateText(entry.insider_tip, 'es', 'en'),
        ])
      } catch (err) {
        failed++
        console.error(`  ✗ TRANSLATION FAILED: ${mapping.txtName}`, err)
        continue
      }
    }

    for (const placeId of mapping.placeIds) {
      // Get place name for the upsert
      const { rows } = await db.query<{ name: string }>('SELECT name FROM places WHERE id = $1', [placeId])
      const placeName = rows[0]?.name ?? mapping.txtName

      if (DRY_RUN) {
        console.log(`  ✓ ${mapping.txtName} → ${placeName} (${placeId.slice(0, 8)})`)
        placeUpdates++
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
      `, [placeId, placeName, entry.goldenbook_note, entry.insider_tip])

      // Upsert PT
      await db.query(`
        INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
        VALUES ($1, 'pt', $2, $3, $4)
        ON CONFLICT (place_id, locale) DO UPDATE SET
          goldenbook_note = EXCLUDED.goldenbook_note,
          insider_tip = EXCLUDED.insider_tip,
          updated_at = now()
      `, [placeId, placeName, notePt!, tipPt!])

      // Upsert ES
      await db.query(`
        INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
        VALUES ($1, 'es', $2, $3, $4)
        ON CONFLICT (place_id, locale) DO UPDATE SET
          goldenbook_note = EXCLUDED.goldenbook_note,
          insider_tip = EXCLUDED.insider_tip,
          updated_at = now()
      `, [placeId, placeName, noteEs!, tipEs!])

      placeUpdates++
      console.log(`  ✓ ${placeName} (${placeId.slice(0, 8)})`)
    }
    updated++
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  IMPORT REPORT')
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Mapping entries:    ${MANUAL_MAP.length}`)
  console.log(`  Entries processed:  ${updated}`)
  console.log(`  DB places updated:  ${placeUpdates}`)
  console.log(`  Not found in TXT:   ${notFound}`)
  console.log(`  Translation errors: ${failed}`)
  console.log(`${'═'.repeat(60)}\n`)

  await db.end()
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error(err)
  await db.end()
  process.exit(1)
})
