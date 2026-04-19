#!/usr/bin/env tsx
// Dump the 23 rows that apply-chatgpt-corrections SKIPPED, with full context,
// so I can translate them by hand.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Row IDs skipped in the last apply run. Keep in sync if it changes.
const SKIP_IDS = new Set(['4','5','9','13','14','15','16','17','18','19','20','21','22','23','24','25','26','29','30','31','32','33','34'])

type Row = Record<string, string>
function parseCsv(text: string): Row[] {
  const rows: string[][] = []; let cur: string[] = []; let f = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i+1] === '"') { f += '"'; i++; continue }
      if (ch === '"') { q = false; continue }
      f += ch
    } else {
      if (ch === '"') { q = true; continue }
      if (ch === ',') { cur.push(f); f = ''; continue }
      if (ch === '\n') { cur.push(f); rows.push(cur); cur = []; f = ''; continue }
      if (ch === '\r') continue
      f += ch
    }
  }
  if (f.length || cur.length) { cur.push(f); rows.push(cur) }
  const nonEmpty = rows.filter(r => r.some(c => c.length))
  const header = nonEmpty.shift()!
  return nonEmpty.map(r => {
    const o: Row = {}; header.forEach((h, i) => o[h] = r[i] ?? '')
    return o
  })
}

const rows = parseCsv(readFileSync(resolve(__dirname, '..', 'translations_for_chatgpt_filled.csv'), 'utf8'))
for (const r of rows) {
  if (!SKIP_IDS.has(r.row_id)) continue
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`row ${r.row_id}  ·  ${r.place_slug}  ·  ${r.field}  ·  target=${r.target_locale}  detected=${r.detected_locale}`)
  console.log(`translation_id: ${r.translation_id}`)
  console.log(`\nSOURCE TEXT (currently stored, in wrong locale):`)
  console.log(`  ${r.source_text || '∅'}`)
  console.log(`\nREFERENCES:`)
  if (r.reference_pt) console.log(`  [pt] ${r.reference_pt}`)
  if (r.reference_en) console.log(`  [en] ${r.reference_en}`)
  if (r.reference_es) console.log(`  [es] ${r.reference_es}`)
  if (r.corrected_text) console.log(`\nCHATGPT CORRECTED (rejected):\n  ${r.corrected_text}`)
}
