#!/usr/bin/env tsx
/**
 * apply-retranslations.ts
 *
 * Reads retranslated_staging.csv and applies each (translation_id, field)
 * to place_translations. Row-level rules:
 *
 *   • Skip rows where verdict is 'wrong_lang' — LLM output didn't match the
 *     target locale. Those need manual review.
 *   • Apply rows where verdict is 'ok' or 'suspicious'. Most 'suspicious'
 *     are franc false positives on short pt-PT text.
 *   • If corrected_text is empty AND existing_text was also empty → no-op.
 *   • If corrected_text is empty AND existing_text had content → the LLM
 *     decided to clear the field (rare, but valid when content was garbage).
 *     Apply as NULL.
 *   • Stamp source='llm_rewrite', is_override=false (leaves room for future
 *     editorial overrides while marking the rows as LLM-generated).
 *
 * Dry-run by default. --apply to execute inside one transaction.
 *
 * Usage:
 *   cd goldenbook-backend
 *   npx tsx --env-file=.env scripts/apply-retranslations.ts
 *   npx tsx --env-file=.env scripts/apply-retranslations.ts --apply
 *   npx tsx --env-file=.env scripts/apply-retranslations.ts --apply --include-wrong-lang
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool } from 'pg'

const APPLY = process.argv.includes('--apply')
const INCLUDE_WRONG = process.argv.includes('--include-wrong-lang')
const CSV_PATH = resolve(__dirname, '..', 'retranslated_staging.csv')

const ALLOWED_FIELDS = new Set([
  'short_description', 'full_description', 'goldenbook_note', 'insider_tip',
])

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

async function main() {
  const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'))
  console.log(`\n─ ${rows.length} rows in staging CSV`)

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })
  const c = await pool.connect()

  const counts = { applied: 0, skipped_wrong: 0, skipped_unchanged: 0, skipped_invalid: 0, cleared: 0 }

  try {
    if (APPLY) {
      await c.query('BEGIN')
      // Preflight: ensure source CHECK allows 'llm_rewrite'. Matches migration
      // 20260419200000. Idempotent.
      await c.query(`ALTER TABLE place_translations DROP CONSTRAINT IF EXISTS place_translations_source_check`)
      await c.query(
        `ALTER TABLE place_translations
           ADD CONSTRAINT place_translations_source_check
           CHECK (source IN ('manual','manual_fix','llm_rewrite','deepl','import'))`,
      )
    }

    for (const r of rows) {
      const verdict = r.verdict?.trim() ?? ''
      const field = r.field?.trim() ?? ''
      const translationId = r.translation_id?.trim() ?? ''
      const corrected = r.corrected_text ?? ''
      const existing = r.existing_text ?? ''

      if (!ALLOWED_FIELDS.has(field)) {
        counts.skipped_invalid++
        continue
      }
      if (!/^[0-9a-f-]{36}$/.test(translationId)) {
        counts.skipped_invalid++
        continue
      }
      if (verdict === 'wrong_lang' && !INCLUDE_WRONG) {
        counts.skipped_wrong++
        continue
      }
      // No change needed
      if (corrected === existing) {
        counts.skipped_unchanged++
        continue
      }

      const newValue = corrected.trim() === '' ? null : corrected
      if (newValue === null) counts.cleared++
      counts.applied++

      if (APPLY) {
        await c.query(
          `UPDATE place_translations
              SET ${field} = $1,
                  source = 'llm_rewrite',
                  is_override = false,
                  updated_at = now()
            WHERE id = $2`,
          [newValue, translationId],
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

  console.log(APPLY ? '\n━━━ APPLIED ━━━' : '\n━━━ DRY-RUN ━━━')
  console.log(`  fields written/would-write : ${counts.applied}`)
  console.log(`    of which cleared (null)  : ${counts.cleared}`)
  console.log(`  skipped — wrong_lang       : ${counts.skipped_wrong}${INCLUDE_WRONG ? ' (but --include-wrong-lang set, so applied)' : ''}`)
  console.log(`  skipped — no change        : ${counts.skipped_unchanged}`)
  console.log(`  skipped — invalid row      : ${counts.skipped_invalid}`)

  if (APPLY) {
    console.log('\n  Committed. content_version bumped; mobile invalidates on next foreground.\n')
  } else {
    console.log('\n  DRY-RUN. Re-run with --apply to write.\n')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
