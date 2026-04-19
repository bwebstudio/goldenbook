#!/usr/bin/env tsx
/**
 * apply-per-field-cleanup.ts
 *
 * Applies the per-field algorithm: for each (translation_id, field) flagged
 * in audit_translations_per_field.csv, move the text to the detected-locale
 * row for the same place (merging: existing content wins) and clear the
 * contaminated source field.
 *
 * Rules:
 *   • If the target-locale row already has non-empty content for that field,
 *     we DO NOT overwrite — we only clear the source field. Human review
 *     will re-translate later via the dashboard.
 *   • If the target row is missing entirely, we insert an empty one and
 *     fill just that field.
 *   • Only fields flagged confidence != 'low' are applied by default (the
 *     heuristic is too noisy on short strings).
 *   • Every row touched gets source='manual_fix', is_override=true, but
 *     per-field writes preserve the row's other fields untouched.
 *
 * Dry-run by default. Pass --apply to execute inside one transaction.
 *
 * Usage:
 *   cd goldenbook-backend/api
 *   npx tsx --env-file=../.env ../scripts/apply-per-field-cleanup.ts
 *   npx tsx --env-file=../.env ../scripts/apply-per-field-cleanup.ts --apply
 *   # optional: --include-low to apply low-confidence rows too
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool, PoolClient } from 'pg'

const APPLY       = process.argv.includes('--apply')
const INCLUDE_LOW = process.argv.includes('--include-low')
const CSV_PATH    = resolve(__dirname, '..', 'audit_translations_per_field.csv')

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

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let buf = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i+1] === '"') { buf += '"'; i++; continue }
      if (ch === '"') { inQuote = false; continue }
      buf += ch
    } else {
      if (ch === '"') { inQuote = true; continue }
      if (ch === ',') { out.push(buf); buf = ''; continue }
      buf += ch
    }
  }
  out.push(buf)
  return out
}

function parse(text: string): AuditRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  lines.shift()
  return lines.map(l => {
    const c = splitCsvLine(l)
    return {
      place_id:        c[0],
      translation_id:  c[1],
      stored_locale:   c[2] as Locale,
      field:           c[3] as Field,
      detected_locale: c[4] as Locale,
      confidence:      (c[5] as 'low' | 'medium' | 'high'),
      sample:          c[6],
    }
  })
}

async function readField(c: PoolClient, translationId: string, field: Field): Promise<string | null> {
  const { rows } = await c.query<Record<string, string | null>>(
    `SELECT ${field} AS v FROM place_translations WHERE id = $1`,
    [translationId],
  )
  return rows[0]?.v ?? null
}

async function readTargetField(
  c: PoolClient, placeId: string, locale: Locale, field: Field,
): Promise<string | null> {
  const { rows } = await c.query<Record<string, string | null>>(
    `SELECT ${field} AS v FROM place_translations WHERE place_id=$1 AND locale=$2`,
    [placeId, locale],
  )
  return rows[0]?.v ?? null
}

async function ensureEmptyRow(c: PoolClient, placeId: string, locale: Locale) {
  await c.query(
    `INSERT INTO place_translations (place_id, locale, name, source, is_override)
     VALUES ($1, $2, '', 'manual_fix', false)
     ON CONFLICT (place_id, locale) DO NOTHING`,
    [placeId, locale],
  )
}

async function setField(
  c: PoolClient, placeId: string, locale: Locale, field: Field, value: string | null,
) {
  const col = field
  await c.query(
    `UPDATE place_translations
        SET ${col} = $3,
            source = 'manual_fix',
            is_override = true,
            updated_at = now()
      WHERE place_id = $1 AND locale = $2`,
    [placeId, locale, value],
  )
}

async function main() {
  const csv = readFileSync(CSV_PATH, 'utf8')
  let audit = parse(csv).filter(r => r.field && r.stored_locale && r.detected_locale)
  if (!INCLUDE_LOW) audit = audit.filter(r => r.confidence !== 'low')
  console.log(`\n─ Loaded ${audit.length} field-level flags` +
              (INCLUDE_LOW ? '' : ' (low-confidence excluded)'))

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })
  const c = await pool.connect()

  type Plan = {
    a: AuditRow
    srcText: string | null
    tgtExists: boolean
    tgtEmpty: boolean
    action: 'move' | 'clear_only' | 'skip'
  }
  const plans: Plan[] = []

  try {
    if (APPLY) await c.query('BEGIN')

    for (const a of audit) {
      const srcText = await readField(c, a.translation_id, a.field)
      if (!srcText || srcText.trim() === '') { plans.push({ a, srcText, tgtExists: false, tgtEmpty: true, action: 'skip' }); continue }

      const tgt = await readTargetField(c, a.place_id, a.detected_locale, a.field)
      const tgtExists = tgt !== null
      const tgtEmpty  = (tgt ?? '').trim() === ''
      const action: Plan['action'] = tgtEmpty ? 'move' : 'clear_only'

      plans.push({ a, srcText, tgtExists, tgtEmpty, action })

      if (APPLY) {
        if (action === 'move') {
          if (!tgtExists) await ensureEmptyRow(c, a.place_id, a.detected_locale)
          await setField(c, a.place_id, a.detected_locale, a.field, srcText)
        }
        // In both 'move' and 'clear_only' cases we clear the contaminated source.
        // For `name` we use '' (NOT NULL); otherwise NULL.
        const cleared = a.field === 'name' ? '' : null
        await setField(c, a.place_id, a.stored_locale, a.field, cleared as any)
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
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(APPLY ? '  APPLIED' : '  DRY-RUN (no changes)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const counts: Record<string, number> = { move: 0, clear_only: 0, skip: 0 }
  for (const p of plans) counts[p.action]++
  for (const p of plans) {
    const a = p.a
    const arrow = `${a.stored_locale}.${a.field} → ${a.detected_locale}`
    console.log(`  [${p.action.padEnd(10)}] ${arrow.padEnd(42)} ${a.place_id.slice(0,8)}…  "${(p.srcText ?? '').slice(0, 70)}"`)
  }
  console.log(`\n  moved fields: ${counts.move}   cleared only: ${counts.clear_only}   skipped: ${counts.skip}`)
  console.log(APPLY ? '\n  Done.\n' : '\n  DRY-RUN. Re-run with --apply to execute.\n')
}

main().catch(err => { console.error(err); process.exit(1) })
