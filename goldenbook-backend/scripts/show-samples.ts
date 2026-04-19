#!/usr/bin/env tsx
// Pretty-prints samples from retranslated_staging.csv for human review.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  const non = rows.filter(r => r.some(c => c.length))
  const h = non.shift()!
  return non.map(r => { const o: Row = {}; h.forEach((col, i) => o[col] = r[i] ?? ''); return o })
}

const argN = Number(process.argv[2] ?? 0) || 0  // 0 = all
const rows = parseCsv(readFileSync(resolve(__dirname, '..', 'retranslated_staging.csv'), 'utf8'))

// Group by place + locale for nicer display
const byPlaceLocale = new Map<string, Row[]>()
for (const r of rows) {
  const k = `${r.place_slug}|${r.locale}`
  if (!byPlaceLocale.has(k)) byPlaceLocale.set(k, [])
  byPlaceLocale.get(k)!.push(r)
}

const keys = [...byPlaceLocale.keys()]
const picked = argN > 0 ? keys.sort(() => Math.random() - 0.5).slice(0, argN) : keys

for (const k of picked) {
  const group = byPlaceLocale.get(k)!
  const [slug, locale] = k.split('|')
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  ${slug}  →  ${locale.toUpperCase()}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  for (const r of group) {
    if (!r.corrected_text && !r.existing_text) continue
    const verdict = r.verdict === 'ok' ? '✓' : r.verdict === 'wrong_lang' ? '✖ WRONG LANG' : r.verdict === 'suspicious' ? '? SUSP' : '∅'
    console.log(`\n  [${r.field}]  ${verdict}`)
    if (r.existing_text) console.log(`    BEFORE: ${r.existing_text.replace(/\s+/g, ' ').slice(0, 300)}`)
    if (r.corrected_text) console.log(`    AFTER : ${r.corrected_text.replace(/\s+/g, ' ').slice(0, 300)}`)
    else if (r.existing_text) console.log(`    AFTER : (null — LLM removed content)`)
  }
}
console.log(`\n\n  Total samples shown: ${picked.length} place-locale pairs`)
