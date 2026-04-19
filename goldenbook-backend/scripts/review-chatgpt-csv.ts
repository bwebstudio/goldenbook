#!/usr/bin/env tsx
// review-chatgpt-csv.ts — validates the structure and content of the filled
// CSV returned by ChatGPT. Runs every sanity check we care about before
// importing and prints a concise report.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { franc } from 'franc'

const ORIG_PATH   = resolve(__dirname, '..', 'translations_for_chatgpt.csv')
const FILLED_PATH = resolve(__dirname, '..', 'translations_for_chatgpt_filled.csv')

const EXPECTED_COLS = [
  'row_id','place_id','translation_id','place_slug','place_name',
  'field','target_locale','detected_locale','confidence',
  'source_text','reference_pt','reference_en','reference_es',
  'corrected_text','notes',
]

type Row = Record<string, string>
type Locale = 'en' | 'es' | 'pt'

function parseCsv(text: string): { header: string[]; rows: Row[] } {
  // Proper CSV parser: handles quoted fields containing newlines and commas.
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; continue }
      if (ch === '"') { inQuote = false; continue }
      field += ch
    } else {
      if (ch === '"') { inQuote = true; continue }
      if (ch === ',') { cur.push(field); field = ''; continue }
      if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; continue }
      if (ch === '\r') continue
      field += ch
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur) }
  const nonEmpty = rows.filter(r => r.some(c => c.length > 0))
  const header = nonEmpty.shift() ?? []
  const recs = nonEmpty.map(r => {
    const o: Row = {}
    header.forEach((h, i) => { o[h] = r[i] ?? '' })
    return o
  })
  return { header, rows: recs }
}

function francToIso(code: string): Locale | 'und' {
  if (code === 'por') return 'pt'
  if (code === 'spa') return 'es'
  if (code === 'eng') return 'en'
  return 'und'
}

function main() {
  const orig   = parseCsv(readFileSync(ORIG_PATH, 'utf8'))
  const filled = parseCsv(readFileSync(FILLED_PATH, 'utf8'))

  console.log('\n━━━ Structural checks ━━━')
  const headerMatches = JSON.stringify(filled.header) === JSON.stringify(EXPECTED_COLS)
  console.log(`  header columns identical             : ${headerMatches ? '✓' : '✖  ' + JSON.stringify(filled.header)}`)
  console.log(`  row count orig → filled              : ${orig.rows.length} → ${filled.rows.length} ${orig.rows.length === filled.rows.length ? '✓' : '✖'}`)

  // Identifier + reference preservation
  const origById = new Map(orig.rows.map(r => [r.row_id, r]))
  const identifierDrift: string[] = []
  const refDrift: string[] = []

  for (const r of filled.rows) {
    const o = origById.get(r.row_id)
    if (!o) { identifierDrift.push(`row_id ${r.row_id} not in orig`); continue }
    for (const c of ['place_id','translation_id','place_slug','field','target_locale','detected_locale']) {
      if (r[c] !== o[c]) identifierDrift.push(`row_id=${r.row_id} ${c} drifted: "${o[c]}" → "${r[c]}"`)
    }
    for (const c of ['source_text','reference_pt','reference_en','reference_es']) {
      if (r[c] !== o[c]) refDrift.push(`row_id=${r.row_id} ${c} modified (should be untouched)`)
    }
  }
  console.log(`  identifier / field columns preserved : ${identifierDrift.length === 0 ? '✓' : '✖  ' + identifierDrift.length + ' drifts'}`)
  if (identifierDrift.length) for (const d of identifierDrift.slice(0, 5)) console.log('      - ' + d)
  console.log(`  source/reference columns preserved   : ${refDrift.length === 0 ? '✓' : '✖  ' + refDrift.length + ' drifts'}`)
  if (refDrift.length) for (const d of refDrift.slice(0, 5)) console.log('      - ' + d)

  // Per-row content checks
  console.log('\n━━━ Content checks (per row) ━━━')
  let filled_count = 0
  let false_positive_count = 0
  let empty_both = 0
  const lengthWarnings: string[] = []
  const localeWarnings: string[] = []
  const issueRows: string[] = []

  for (const r of filled.rows) {
    const note = (r.notes ?? '').trim().toUpperCase()
    const corrected = (r.corrected_text ?? '').trim()
    const target = (r.target_locale ?? '').trim() as Locale

    const isFP = note.includes('FALSE_POSITIVE')
    if (isFP) {
      false_positive_count++
      if (corrected.length > 0) {
        issueRows.push(`row ${r.row_id}: FALSE_POSITIVE but corrected_text is non-empty (should be empty)`)
      }
      continue
    }

    if (corrected.length === 0) {
      empty_both++
      issueRows.push(`row ${r.row_id}: empty corrected_text AND not flagged FALSE_POSITIVE`)
      continue
    }

    filled_count++

    // Language check on the corrected text — does it look like the target locale?
    if (corrected.length >= 40) {
      const detected = francToIso(franc(corrected, { minLength: 10 }))
      if (detected !== 'und' && detected !== target) {
        localeWarnings.push(
          `row ${r.row_id} [${r.place_slug} / ${r.field}] target=${target} but franc says ${detected}`,
        )
      }
    }

    // Length sanity: compare to reference in target locale if available.
    const refCol = 'reference_' + target as 'reference_en' | 'reference_es' | 'reference_pt'
    const ref = (r[refCol] ?? '').trim()
    if (ref.length > 0) {
      const ratio = corrected.length / ref.length
      if (ratio > 2.2 || ratio < 0.45) {
        lengthWarnings.push(
          `row ${r.row_id} [${r.place_slug} / ${r.field}] length ratio=${ratio.toFixed(2)} (ref=${ref.length}ch, corrected=${corrected.length}ch)`,
        )
      }
    }
  }

  console.log(`  rows filled                          : ${filled_count}`)
  console.log(`  rows flagged FALSE_POSITIVE          : ${false_positive_count}`)
  console.log(`  rows empty AND not flagged           : ${empty_both}${empty_both ? '  ✖' : '  ✓'}`)
  console.log(`  language mismatch (franc vs target)  : ${localeWarnings.length}${localeWarnings.length ? '  ⚠' : '  ✓'}`)
  if (localeWarnings.length) for (const w of localeWarnings.slice(0, 8)) console.log('      - ' + w)
  console.log(`  length ratio outside 0.45–2.2        : ${lengthWarnings.length}${lengthWarnings.length ? '  ⚠' : '  ✓'}`)
  if (lengthWarnings.length) for (const w of lengthWarnings.slice(0, 8)) console.log('      - ' + w)
  if (issueRows.length) { console.log('\n  issues:'); for (const w of issueRows) console.log('      - ' + w) }

  // Preview — show first 3 filled corrections so we can eyeball tone
  console.log('\n━━━ Preview (first 3 corrections) ━━━')
  let shown = 0
  for (const r of filled.rows) {
    if (shown >= 3) break
    const corrected = (r.corrected_text ?? '').trim()
    if (!corrected) continue
    const tgt = r.target_locale
    const orig = (r.source_text ?? '').trim()
    console.log(`\n  [row ${r.row_id}] ${r.place_slug} / ${r.field} → ${tgt}`)
    console.log(`    was  (${r.detected_locale}): ${orig.slice(0, 140)}${orig.length > 140 ? '…' : ''}`)
    console.log(`    now  (${tgt}):              ${corrected.slice(0, 140)}${corrected.length > 140 ? '…' : ''}`)
    shown++
  }

  console.log()
}

main()
