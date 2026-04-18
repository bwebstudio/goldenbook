#!/usr/bin/env ts-node
/**
 * audit-translation-locales.ts
 *
 * Scans every row in place_translations and flags rows whose stored `locale`
 * disagrees with the language actually detected in the text. Exports the
 * suspect rows to CSV so the editorial team can review and re-import.
 *
 * Detection is a two-pass funnel:
 *   1) Fast regex heuristics (stopwords / diacritics) to shortlist
 *      candidates — avoids running franc on every row.
 *   2) Franc language detection on the shortlisted rows to definitively
 *      classify the text language.
 *
 * Run:
 *   cd goldenbook-backend/api
 *   npx ts-node ../scripts/audit-translation-locales.ts > /tmp/audit.csv
 *
 * Requires:
 *   - DATABASE_URL in env (Supabase direct connection string)
 *   - `franc` installed: npm install --no-save franc
 */

import { Pool } from 'pg'
import { franc } from 'franc'

type Locale = 'en' | 'es' | 'pt'

interface Row {
  id: string
  place_id: string
  locale: string
  name: string | null
  short_description: string | null
  full_description: string | null
  goldenbook_note: string | null
  insider_tip: string | null
}

// ── Heuristic regex shortlists ────────────────────────────────────────────
// Matches *distinctive* stopwords/tokens that belong to each language and are
// unlikely to appear in the others. Not authoritative — used only to pick
// rows worth running franc on.

const RE = {
  // pt-specific: words that appear only in PT, not in ES/EN
  pt: /\b(não|você|está|melhor|perto|lugar|obrigado|onde|também|aqui|pequeno-almoço|autocarro|casa de banho|à|é)\b/i,
  // es-specific
  es: /\b(usted|mucho|mejor|cerca|gracias|dónde|también|aquí|desayuno|autobús|baño|está|más)\b/i,
  // en-specific: obvious English-only words
  en: /\b(the|and|with|which|from|where|about|between|local|taste|restaurant|bar|cafe|hotel)\b/i,
}

function concatText(r: Row): string {
  return [r.name, r.short_description, r.full_description, r.goldenbook_note, r.insider_tip]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join(' \n ')
}

function francToISO(code: string): Locale | 'und' {
  // franc emits ISO 639-3
  if (code === 'por') return 'pt'
  if (code === 'spa') return 'es'
  if (code === 'eng') return 'en'
  return 'und'
}

function heuristicSuspect(text: string, stored: string): boolean {
  const storedL = stored.split('-')[0].toLowerCase()
  if (storedL === 'pt') return RE.es.test(text) || RE.en.test(text)
  if (storedL === 'es') return RE.pt.test(text) || RE.en.test(text)
  if (storedL === 'en') return RE.pt.test(text) || RE.es.test(text)
  return false
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  const { rows } = await pool.query<Row>(`
    SELECT id, place_id, locale,
           name, short_description, full_description,
           goldenbook_note, insider_tip
      FROM place_translations
     WHERE locale IN ('en','es','pt')
  `)

  const suspects: Array<{
    place_id: string
    translation_id: string
    stored_locale: string
    detected_locale: string
    confidence: 'low' | 'medium' | 'high'
    sample: string
  }> = []

  for (const r of rows) {
    const text = concatText(r).slice(0, 4000)
    if (!text) continue
    if (!heuristicSuspect(text, r.locale)) continue

    const detected = francToISO(franc(text, { minLength: 10 }))
    if (detected === 'und') continue

    const storedFam = r.locale.split('-')[0].toLowerCase() as Locale
    if (detected === storedFam) continue

    // Short text → low confidence; long text → high
    const conf: 'low' | 'medium' | 'high' =
      text.length < 60 ? 'low' : text.length < 300 ? 'medium' : 'high'

    suspects.push({
      place_id:        r.place_id,
      translation_id:  r.id,
      stored_locale:   r.locale,
      detected_locale: detected,
      confidence:      conf,
      sample:          text.replace(/\s+/g, ' ').slice(0, 140),
    })
  }

  // CSV to stdout
  const header = ['place_id','translation_id','stored_locale','detected_locale','confidence','sample']
  console.log(header.join(','))
  for (const s of suspects) {
    const cells = [
      s.place_id, s.translation_id, s.stored_locale, s.detected_locale,
      s.confidence,
      `"${s.sample.replace(/"/g, '""')}"`,
    ]
    console.log(cells.join(','))
  }

  console.error(`\nScanned ${rows.length} rows; ${suspects.length} suspect rows flagged.`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
