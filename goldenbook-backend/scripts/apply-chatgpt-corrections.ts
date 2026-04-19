#!/usr/bin/env tsx
/**
 * apply-chatgpt-corrections.ts
 *
 * Reads translations_for_chatgpt_filled.csv and writes each non-empty
 * `corrected_text` into the corresponding (translation_id, field) cell.
 *
 * Rules:
 *   • Write only rows where `corrected_text` is non-empty AND `notes` is
 *     NOT "FALSE_POSITIVE".
 *   • Do NOT touch other fields on the same row. Only the one `field`
 *     named in the CSV.
 *   • Every write stamps source='manual_fix', is_override=true,
 *     updated_at=now(). The STATEMENT-level trigger bumps content_version
 *     once at commit; mobile clients pick it up on next foreground.
 *
 * Safety:
 *   • Dry-run by default. Prints the full plan, touches nothing.
 *   • Pass --apply to execute inside a single transaction. Rollback on any
 *     failure.
 *
 * Usage:
 *   cd goldenbook-backend/api
 *   npx tsx --env-file=../.env ../scripts/apply-chatgpt-corrections.ts
 *   npx tsx --env-file=../.env ../scripts/apply-chatgpt-corrections.ts --apply
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool } from 'pg'
import { franc } from 'franc'

const APPLY = process.argv.includes('--apply')
const CSV_PATH = resolve(__dirname, '..', 'translations_for_chatgpt_filled.csv')

type Locale = 'en' | 'es' | 'pt'

function francToIso(code: string): Locale | 'und' {
  if (code === 'por') return 'pt'
  if (code === 'spa') return 'es'
  if (code === 'eng') return 'en'
  return 'und'
}

// pt-PT-specific diacritics (never appear in Spanish).
const PT_MARKERS = /[ãõâêôç]/
// Spanish-specific markers.
const ES_MARKERS = /[ñ¿¡]/

/**
 * Decides whether to import a ChatGPT correction. Defensive — when in doubt,
 * skip and let the editorial team handle it manually. The known failure
 * mode is ChatGPT writing the translation in the WRONG locale; we detect
 * that here.
 */
function verdict(
  corrected: string,
  target: Locale,
  detected: Locale,
  refs: { pt: string; en: string; es: string },
  notes: string,
): { apply: boolean; reason: string } {
  if (notes.toUpperCase().includes('FALSE_POSITIVE')) {
    return { apply: false, reason: 'flagged FALSE_POSITIVE' }
  }
  if (!corrected) return { apply: false, reason: 'corrected_text empty' }

  // Catch verbatim copy-paste from another-locale reference.
  for (const l of ['pt', 'en', 'es'] as const) {
    if (l !== target && refs[l].trim() && refs[l].trim() === corrected.trim()) {
      return { apply: false, reason: `verbatim copy of reference_${l}` }
    }
  }

  const hasPt = PT_MARKERS.test(corrected)
  const hasEs = ES_MARKERS.test(corrected)

  // Strong-marker override of franc (franc is unreliable on short pt-PT
  // text with shared romance vocabulary).
  if (target === 'pt') {
    if (hasEs && !hasPt) return { apply: false, reason: 'es-only markers in pt target' }
    if (hasPt && !hasEs) return { apply: true, reason: 'pt-PT markers present' }
  }
  if (target === 'es') {
    if (hasPt && !hasEs) return { apply: false, reason: 'pt-only markers in es target' }
    if (hasEs && !hasPt) return { apply: true, reason: 'es markers present' }
  }
  if (target === 'en' && (hasPt || hasEs)) {
    return { apply: false, reason: 'pt/es markers in en target' }
  }

  // Fall back to franc for everything else.
  if (corrected.length < 20) {
    return { apply: false, reason: 'text too short to verify language' }
  }
  const iso = francToIso(franc(corrected, { minLength: 10 }))
  if (iso === 'und')       return { apply: false, reason: 'franc: undetermined' }
  if (iso === detected)    return { apply: false, reason: `still in ${detected} (wrong language)` }
  if (iso !== target)      return { apply: false, reason: `franc: ${iso} ≠ target ${target}` }
  return { apply: true, reason: `franc confirms ${target}` }
}

const ALLOWED_FIELDS = new Set([
  'Name',
  'Short description',
  'Long description',
  'Goldenbook editor note ("why we love it")',
  'Insider tip',
])

const FIELD_TO_COLUMN: Record<string, string> = {
  'Name':                                         'name',
  'Short description':                            'short_description',
  'Long description':                             'full_description',
  'Goldenbook editor note ("why we love it")':    'goldenbook_note',
  'Insider tip':                                  'insider_tip',
}

type Row = Record<string, string>

function parseCsv(text: string): { header: string[]; rows: Row[] } {
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

async function main() {
  const csv = parseCsv(readFileSync(CSV_PATH, 'utf8'))
  const rows = csv.rows

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })
  const c = await pool.connect()

  type Plan = {
    rowId: string
    placeSlug: string
    translationId: string
    targetLocale: string
    column: string
    oldValue: string | null
    newValue: string
  }
  const plan: Plan[] = []
  const skipped: { rowId: string; reason: string }[] = []

  try {
    if (APPLY) await c.query('BEGIN')

    for (const r of rows) {
      const corrected = (r.corrected_text ?? '').trim()
      const field = r.field
      const translationId = r.translation_id
      const targetLocale = r.target_locale as Locale
      const detectedLocale = r.detected_locale as Locale

      if (!ALLOWED_FIELDS.has(field)) {
        skipped.push({ rowId: r.row_id, reason: `unknown field label "${field}"` })
        continue
      }
      if (!/^[0-9a-f-]{36}$/.test(translationId)) {
        skipped.push({ rowId: r.row_id, reason: `invalid translation_id "${translationId}"` })
        continue
      }

      const v = verdict(corrected, targetLocale, detectedLocale, {
        pt: r.reference_pt ?? '',
        en: r.reference_en ?? '',
        es: r.reference_es ?? '',
      }, r.notes ?? '')
      if (!v.apply) {
        skipped.push({ rowId: r.row_id, reason: v.reason })
        continue
      }

      const column = FIELD_TO_COLUMN[field]

      // Read current value for the report, and confirm the row still exists.
      const { rows: cur } = await c.query<Record<string, string | null>>(
        `SELECT ${column} AS v FROM place_translations WHERE id = $1`,
        [translationId],
      )
      if (cur.length === 0) {
        skipped.push({ rowId: r.row_id, reason: `translation_id ${translationId} not found in DB` })
        continue
      }

      plan.push({
        rowId: r.row_id,
        placeSlug: r.place_slug,
        translationId,
        targetLocale,
        column,
        oldValue: cur[0].v,
        newValue: corrected,
      })

      if (APPLY) {
        await c.query(
          `UPDATE place_translations
              SET ${column}     = $1,
                  source        = 'manual_fix',
                  is_override   = true,
                  updated_at    = now()
            WHERE id = $2`,
          [corrected, translationId],
        )
      }
    }

    if (APPLY) await c.query('COMMIT')
  } catch (err) {
    if (APPLY) await c.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    c.release()
    await pool.end()
  }

  // ── Report ──
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(APPLY ? '  APPLIED' : '  DRY-RUN (no changes written)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  for (const p of plan) {
    const oldSnip = (p.oldValue ?? '∅').slice(0, 110).replace(/\s+/g, ' ')
    const newSnip = p.newValue.slice(0, 110).replace(/\s+/g, ' ')
    console.log(`\n  [row ${p.rowId.padStart(2)}] ${p.placeSlug}  ·  ${p.column}  →  ${p.targetLocale}`)
    console.log(`    from: ${oldSnip}${(p.oldValue ?? '').length > 110 ? '…' : ''}`)
    console.log(`    to  : ${newSnip}${p.newValue.length > 110 ? '…' : ''}`)
  }

  console.log('\n━━━ Report ━━━')
  console.log(`  fields to update : ${plan.length}`)
  console.log(`  skipped          : ${skipped.length}`)
  for (const s of skipped) console.log(`    - row ${s.rowId}: ${s.reason}`)

  if (APPLY) {
    console.log('\n  Done. content_version bumped via statement trigger; mobile invalidates on next foreground.\n')
  } else {
    console.log('\n  DRY-RUN. Re-run with --apply to execute inside a transaction.\n')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
