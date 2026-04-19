#!/usr/bin/env tsx
/**
 * export-for-chatgpt.ts
 *
 * Reads audit_translations_per_field.csv, filters to confidence >= medium,
 * and writes a translation-ready CSV with:
 *   - the FULL contaminated text (not the 140-char sample)
 *   - the correct reference text for each of the other two locales
 *   - an empty `corrected_text` column for ChatGPT to fill in
 *
 * Also writes CHATGPT_PROMPT.md with the instructions to paste alongside
 * the CSV.
 *
 * Output files (next to the input CSV):
 *   translations_for_chatgpt.csv
 *   CHATGPT_PROMPT.md
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool } from 'pg'

type Locale = 'en' | 'es' | 'pt'
const FIELDS = ['name','short_description','full_description','goldenbook_note','insider_tip'] as const
type Field = typeof FIELDS[number]

interface AuditRow {
  place_id: string
  translation_id: string
  stored_locale: Locale
  field: Field
  detected_locale: Locale
  confidence: 'low' | 'medium' | 'high'
  sample: string
}

const FIELD_LABEL: Record<Field, string> = {
  name:              'Name',
  short_description: 'Short description',
  full_description:  'Long description',
  goldenbook_note:   'Goldenbook editor note ("why we love it")',
  insider_tip:       'Insider tip',
}

const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English (international)',
  es: 'Spanish (neutral, editorial tone — NOT literal, NOT Latin-American idioms)',
  pt: 'Portuguese (European — pt-PT, NOT Brazilian, NOT literal)',
}

function splitCsv(line: string): string[] {
  const out: string[] = []; let buf = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) { if (ch === '"' && line[i+1] === '"') { buf+='"'; i++; continue } if (ch === '"') { q=false; continue } buf+=ch }
    else   { if (ch === '"') { q=true; continue } if (ch === ',') { out.push(buf); buf=''; continue } buf+=ch }
  }
  out.push(buf); return out
}

function csvQuote(v: string | null): string {
  if (v == null) return ''
  const needs = /[",\r\n]/.test(v)
  const s = v.replace(/"/g, '""')
  return needs ? `"${s}"` : s
}

async function main() {
  const IN  = resolve(__dirname, '..', 'audit_translations_per_field.csv')
  const OUT_CSV = resolve(__dirname, '..', 'translations_for_chatgpt.csv')
  const OUT_MD  = resolve(__dirname, '..', 'CHATGPT_PROMPT.md')

  const raw = readFileSync(IN, 'utf8').split(/\r?\n/).filter(Boolean)
  raw.shift() // header
  const audit = raw.map((l): AuditRow => {
    const c = splitCsv(l)
    return {
      place_id:        c[0],
      translation_id:  c[1],
      stored_locale:   c[2] as Locale,
      field:           c[3] as Field,
      detected_locale: c[4] as Locale,
      confidence:      c[5] as 'low' | 'medium' | 'high',
      sample:          c[6],
    }
  }).filter(a =>
    a.confidence !== 'low'
    && /^[0-9a-f-]{36}$/.test(a.place_id)
    && /^[0-9a-f-]{36}$/.test(a.translation_id)
    && !!a.field,
  )

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })

  const OUT_HEADER = [
    'row_id','place_id','translation_id','place_slug','place_name',
    'field','target_locale','detected_locale','confidence',
    'source_text','reference_pt','reference_en','reference_es',
    'corrected_text','notes',
  ]
  const lines: string[] = [OUT_HEADER.join(',')]

  let i = 1
  for (const a of audit) {
    const { rows: placeRows } = await pool.query<{ slug: string; name: string }>(
      `SELECT slug, name FROM places WHERE id = $1`, [a.place_id],
    )
    const place = placeRows[0]
    if (!place) continue

    const { rows: srcRows } = await pool.query<Record<string, string | null>>(
      `SELECT ${a.field} AS v FROM place_translations WHERE id = $1`, [a.translation_id],
    )
    const sourceText = srcRows[0]?.v ?? ''

    const { rows: allLocales } = await pool.query<{
      locale: Locale
      name: string | null
      short_description: string | null
      full_description: string | null
      goldenbook_note: string | null
      insider_tip: string | null
    }>(
      `SELECT locale, name, short_description, full_description, goldenbook_note, insider_tip
         FROM place_translations
        WHERE place_id = $1 AND locale IN ('pt','en','es')`,
      [a.place_id],
    )
    const byLocale = new Map<Locale, typeof allLocales[number]>()
    for (const r of allLocales) byLocale.set(r.locale, r)

    const ref = (loc: Locale) => {
      // For 'name' we include name; otherwise the same field in that locale.
      const row = byLocale.get(loc)
      if (!row) return ''
      const v = (row as any)[a.field] as string | null
      return v ?? ''
    }

    lines.push([
      i,
      csvQuote(a.place_id),
      csvQuote(a.translation_id),
      csvQuote(place.slug),
      csvQuote(place.name),
      csvQuote(FIELD_LABEL[a.field]),
      csvQuote(a.stored_locale),
      csvQuote(a.detected_locale),
      csvQuote(a.confidence),
      csvQuote(sourceText),
      csvQuote(ref('pt')),
      csvQuote(ref('en')),
      csvQuote(ref('es')),
      '',  // corrected_text — ChatGPT fills this
      '',  // notes
    ].join(','))
    i++
  }

  writeFileSync(OUT_CSV, lines.join('\n') + '\n', 'utf8')

  const prompt = `# Translation cleanup — Goldenbook

You are an editorial translator for Goldenbook, a premium travel guide for Portugal. A data-quality audit found ${audit.length} places where one editorial field was saved under the wrong language label. You will correct them.

## Input

A CSV named \`translations_for_chatgpt.csv\` with one row per field-to-fix. Columns:

| Column | Meaning |
|---|---|
| \`row_id\` | Row number, for your output to match back |
| \`place_slug\`, \`place_name\` | Human context so you know what the place is |
| \`field\` | Which editorial field this text belongs to (Name / Short description / Long description / Goldenbook editor note / Insider tip) |
| \`target_locale\` | **The locale you must write in.** \`en\` → English, \`es\` → Spanish, \`pt\` → European Portuguese |
| \`detected_locale\` | The language the current text actually is (so you know what to translate FROM) |
| \`source_text\` | The current (wrong-language) text, full length |
| \`reference_pt\`, \`reference_en\`, \`reference_es\` | What the same field looks like in each of the three locales — use these as tone references |
| \`corrected_text\` | **Empty. You fill this in.** |
| \`notes\` | Optional — flag anything unusual you noticed |

## Output

Fill the \`corrected_text\` column **only**. Do NOT modify any other column. Export the same CSV preserving all other columns exactly. No extra columns, no re-ordering.

## Translation rules

**Per locale:**

- **English** — international, travel-guide register. Neutral tone, no contractions in long-form copy, avoid Americanisms *and* Britishisms. Keep Portuguese place names, street names, and dish names untranslated (e.g. "pastéis de nata", not "custard tarts"). Measurements in metric.
- **Spanish** — **editorial, neutral, NOT literal**. Avoid calques from English ("una dirección ideal para…" → "un imprescindible para…"; "ubicado en" → "en pleno…"; "a lo largo de la costa" → "a lo largo del litoral"). Use peninsular Spanish vocabulary; do not use Latin-American-only words. No regional slang.
- **Portuguese** — **European Portuguese (pt-PT)**. NOT Brazilian. Use "casa de banho" (not "banheiro"), "autocarro" (not "ônibus"), "pequeno-almoço" (not "café da manhã"). Avoid heavy gerunds. Tone is refined and concise.

**All locales:**
- Preserve proper nouns, venue names, product names, addresses, phone numbers, URLs unchanged.
- Preserve the editorial voice from \`reference_*\` columns — those are the correct tone for this brand. If the references feel flat or literal, improve them in your output.
- Do NOT machine-translate literally. Rewrite naturally in the target language as if a native editor wrote it from scratch using the reference text as a brief.
- Keep length proportional to the reference in the same field. A 40-word short description should stay ~40 words, not 120.

## False positives

The audit that produced this CSV is a heuristic. Some rows are **false positives** — \`source_text\` is already in the correct \`target_locale\`. In those cases:
- Leave \`corrected_text\` **empty**.
- Write \`FALSE_POSITIVE\` in \`notes\`.

Examples of false-positive signals:
- \`source_text\` contains pt-PT diacritics (ç, ã, õ, ê, etc.) when target is \`pt\` → probably already correct, detector confused it.
- \`source_text\` is mostly proper nouns and brand names with few function words → not really translatable, leave empty.

## Empty source_text

Some rows have \`source_text\` empty because we already cleared a contaminated field. In those cases use the best available reference (usually \`reference_pt\`) as the brief and write a fresh \`target_locale\` translation from it.

## Notes column

Use it sparingly. Flag:
- \`FALSE_POSITIVE\` (see above).
- When the reference in another locale seems to contradict itself and you had to pick an interpretation.
- When a fact in \`source_text\` is unverifiable and you chose to soften the claim (e.g. "the oldest bar in Lisbon" → "one of Lisbon's oldest bars").
- Otherwise leave empty.

## Return

Send back \`translations_for_chatgpt_filled.csv\` (rename to anything you prefer) with \`corrected_text\` populated for every row. We will re-import the corrected column directly into the database under \`source='manual_fix'\`, \`is_override=true\`.
`

  writeFileSync(OUT_MD, prompt, 'utf8')

  console.log(`Wrote:`)
  console.log(`  ${OUT_CSV}  (${lines.length - 1} rows)`)
  console.log(`  ${OUT_MD}`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
