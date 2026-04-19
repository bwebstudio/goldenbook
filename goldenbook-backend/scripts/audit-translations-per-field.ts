#!/usr/bin/env tsx
/**
 * audit-translations-per-field.ts
 *
 * Stricter successor to audit-translation-locales.ts.
 *
 * The per-row audit misses rows whose MOST fields are in the correct locale
 * but a single field was contaminated by a partial DeepL translation (e.g.
 * ES row with ES short/note/tip but PT full_description).
 *
 * This pass feeds EACH editorial field through franc INDEPENDENTLY so a
 * single poisoned field is caught.
 *
 * Output: CSV of (place_id, translation_id, stored_locale, field,
 *                 detected_locale, confidence, sample).
 *
 * Run:
 *   cd goldenbook-backend
 *   npm install --no-save franc
 *   DATABASE_URL=... npx tsx scripts/audit-translations-per-field.ts \
 *     > audit_translations_per_field.csv
 */

import { Pool } from 'pg'
import { franc } from 'franc'

type Locale = 'en' | 'es' | 'pt'
const FIELDS = ['name', 'short_description', 'full_description', 'goldenbook_note', 'insider_tip'] as const

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

function francToIso(code: string): Locale | 'und' {
  if (code === 'por') return 'pt'
  if (code === 'spa') return 'es'
  if (code === 'eng') return 'en'
  return 'und'
}

// A field must be meaningfully long before we trust franc's verdict. Very
// short strings (single words, toponyms) are unreliable and would spray
// false positives.
const MIN_FIELD_LEN = 40

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })

  const { rows } = await pool.query<Row>(
    `SELECT id, place_id, locale,
            name, short_description, full_description, goldenbook_note, insider_tip
       FROM place_translations
      WHERE locale IN ('en','es','pt')`,
  )

  const header = ['place_id','translation_id','stored_locale','field','detected_locale','confidence','sample']
  console.log(header.join(','))

  let flagged = 0
  for (const r of rows) {
    const stored = r.locale.split('-')[0].toLowerCase() as Locale
    for (const f of FIELDS) {
      const text = (r[f] ?? '').trim()
      if (text.length < MIN_FIELD_LEN) continue
      const detected = francToIso(franc(text, { minLength: 10 }))
      if (detected === 'und' || detected === stored) continue

      // Only flag when the wrong-language content is the majority of the
      // visible snippet. franc already returns the top match — we use length
      // as a coarse confidence proxy.
      const conf = text.length < 80 ? 'low' : text.length < 300 ? 'medium' : 'high'

      const sample = text.replace(/\s+/g, ' ').slice(0, 140)
      console.log([
        r.place_id, r.id, stored, f, detected, conf,
        `"${sample.replace(/"/g, '""')}"`,
      ].join(','))
      flagged++
    }
  }

  console.error(`\nScanned ${rows.length} translation rows, ${flagged} field-level issues flagged.`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
