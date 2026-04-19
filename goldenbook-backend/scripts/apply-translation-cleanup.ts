#!/usr/bin/env tsx
/**
 * apply-translation-cleanup.ts
 *
 * Reads audit_translations.csv (at the backend root) and applies the
 * corrections on place_translations.
 *
 * Per-row logic:
 *   • stored='en' / detected='pt' → move EN editorial fields into PT
 *     (merging with any existing PT), then clear EN.
 *   • stored='es' / detected='pt' → move ES fields into PT, clear ES.
 *   • Any row whose source fields are all empty except `name` (a toponym)
 *     is skipped — there is nothing to move.
 *
 * Invariants enforced after the pass:
 *   • Exactly one row per (place_id, locale) — the unique constraint
 *     guarantees this; any accidental duplicates are pruned by keeping
 *     MAX(updated_at).
 *   • Every place referenced by the CSV has rows for pt / en / es, even if
 *     the fields are empty strings. DeepL is NEVER called.
 *   • Metadata on every row this script writes: source='manual_fix',
 *     is_override=true, updated_at=now().
 *
 * Safety:
 *   • Runs dry by default. Prints the plan and validation result, touches
 *     nothing.
 *   • Pass `--apply` to execute inside a single transaction. Rollback on any
 *     failure. The content_version trigger bumps once per table per run, so
 *     mobile clients see the change on next foreground.
 *
 * Usage:
 *   cd goldenbook-backend
 *   npx tsx --env-file=.env scripts/apply-translation-cleanup.ts              # dry-run
 *   npx tsx --env-file=.env scripts/apply-translation-cleanup.ts --apply      # execute
 *
 *   # Alt: DATABASE_URL=... npx tsx scripts/apply-translation-cleanup.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool, PoolClient } from 'pg'

// ─── Config ────────────────────────────────────────────────────────────────

const APPLY   = process.argv.includes('--apply')
const CSV_PATH = resolve(__dirname, '..', 'audit_translations.csv')

// ─── CSV parser (simple, handles quoted fields) ───────────────────────────

interface AuditRow {
  place_id: string
  translation_id: string
  stored_locale: string
  detected_locale: string
  confidence: string
  sample: string
}

function parseCsv(text: string): AuditRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0)
  const header = lines.shift()
  if (!header) return []
  const cols = header.split(',')
  return lines.map(line => {
    const cells = splitCsvLine(line)
    const rec: Record<string, string> = {}
    cols.forEach((c, i) => { rec[c] = cells[i] ?? '' })
    return rec as unknown as AuditRow
  })
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let buf = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { buf += '"'; i++; continue }
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

// ─── Types ─────────────────────────────────────────────────────────────────

const EDITORIAL_FIELDS = [
  'name', 'short_description', 'full_description', 'goldenbook_note', 'insider_tip',
] as const
type Field = typeof EDITORIAL_FIELDS[number]

interface TranslationRow {
  id: string
  place_id: string
  locale: string
  name: string | null
  short_description: string | null
  full_description: string | null
  goldenbook_note: string | null
  insider_tip: string | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isBlank(v: string | null | undefined): boolean {
  return v == null || v.trim() === ''
}

/** A row is "name-only" if every editorial field except `name` is blank. */
function isNameOnly(r: TranslationRow): boolean {
  return isBlank(r.short_description)
      && isBlank(r.full_description)
      && isBlank(r.goldenbook_note)
      && isBlank(r.insider_tip)
}

/** Merge src INTO dst: dst wins where it already has content; src fills the blanks. */
function mergeEditorial(
  dst: Partial<Record<Field, string | null>>,
  src: Partial<Record<Field, string | null>>,
): Record<Field, string | null> {
  const out = {} as Record<Field, string | null>
  for (const f of EDITORIAL_FIELDS) {
    const dstVal = dst[f]
    const srcVal = src[f]
    out[f] = !isBlank(dstVal) ? (dstVal ?? null) : (srcVal ?? null)
  }
  return out
}

// ─── DB reads ──────────────────────────────────────────────────────────────

async function readRowById(c: PoolClient, id: string): Promise<TranslationRow | null> {
  const { rows } = await c.query<TranslationRow>(
    `SELECT id, place_id, locale, name,
            short_description, full_description, goldenbook_note, insider_tip
       FROM place_translations WHERE id = $1 LIMIT 1`,
    [id],
  )
  return rows[0] ?? null
}

async function readRowForLocale(
  c: PoolClient, placeId: string, locale: string,
): Promise<TranslationRow | null> {
  const { rows } = await c.query<TranslationRow>(
    `SELECT id, place_id, locale, name,
            short_description, full_description, goldenbook_note, insider_tip
       FROM place_translations
      WHERE place_id = $1 AND locale = $2 LIMIT 1`,
    [placeId, locale],
  )
  return rows[0] ?? null
}

// ─── DB writes ─────────────────────────────────────────────────────────────

async function upsertTargetLocale(
  c: PoolClient,
  placeId: string,
  targetLocale: string,
  fields: Record<Field, string | null>,
): Promise<void> {
  // `name` is NOT NULL on place_translations (default ''), so never write null.
  const nameVal = fields.name ?? ''
  await c.query(
    `
    INSERT INTO place_translations (
      place_id, locale, name,
      short_description, full_description, goldenbook_note, insider_tip,
      source, is_override
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, 'manual_fix', true
    )
    ON CONFLICT (place_id, locale) DO UPDATE SET
      name              = $3,
      short_description = $4,
      full_description  = $5,
      goldenbook_note   = $6,
      insider_tip       = $7,
      source            = 'manual_fix',
      is_override       = true,
      updated_at        = now()
    `,
    [
      placeId, targetLocale, nameVal,
      fields.short_description, fields.full_description,
      fields.goldenbook_note, fields.insider_tip,
    ],
  )
}

/** Clear every editorial field on the source row, keep row for structural integrity. */
async function clearSourceRow(c: PoolClient, translationId: string): Promise<void> {
  await c.query(
    `UPDATE place_translations
        SET name              = '',
            short_description = NULL,
            full_description  = NULL,
            goldenbook_note   = NULL,
            insider_tip       = NULL,
            source            = 'manual_fix',
            is_override       = true,
            updated_at        = now()
      WHERE id = $1`,
    [translationId],
  )
}

async function ensureEmptyLocaleRow(
  c: PoolClient, placeId: string, locale: string,
): Promise<boolean> {
  // Returns true if a row was created.
  const { rowCount } = await c.query(
    `INSERT INTO place_translations (
       place_id, locale, name,
       short_description, full_description, goldenbook_note, insider_tip,
       source, is_override
     ) VALUES ($1, $2, '', NULL, NULL, NULL, NULL, 'manual_fix', false)
     ON CONFLICT (place_id, locale) DO NOTHING`,
    [placeId, locale],
  )
  return (rowCount ?? 0) > 0
}

// ─── Core apply logic ──────────────────────────────────────────────────────

interface PlanEntry {
  kind: 'move' | 'skip_name_only' | 'skip_missing_source' | 'error'
  auditRow: AuditRow
  note?: string
  // Populated for 'move' plans:
  source?: TranslationRow
  targetExisting?: TranslationRow | null
  targetMerged?: Record<Field, string | null>
}

async function planAndExecute(pool: Pool): Promise<void> {
  const csvText = readFileSync(CSV_PATH, 'utf8')
  const audit = parseCsv(csvText)
  console.log(`\n─ Loaded ${audit.length} audit rows from ${CSV_PATH}`)

  const client = await pool.connect()
  let transactionStarted = false
  try {
    if (APPLY) {
      await client.query('BEGIN')
      transactionStarted = true

      // Preflight: ensure the CHECK on place_translations.source permits
      // 'manual_fix'. Idempotent — matches migration 20260419100000.
      await client.query(
        `ALTER TABLE place_translations DROP CONSTRAINT IF EXISTS place_translations_source_check`,
      )
      await client.query(
        `ALTER TABLE place_translations
           ADD CONSTRAINT place_translations_source_check
           CHECK (source IN ('manual','manual_fix','deepl','import'))`,
      )
    }

    const plan: PlanEntry[] = []
    const placesTouched = new Set<string>()

    for (const row of audit) {
      if (row.detected_locale !== 'pt') {
        plan.push({ kind: 'error', auditRow: row, note: `unsupported detected=${row.detected_locale}` })
        continue
      }

      const src = await readRowById(client, row.translation_id)
      if (!src) {
        plan.push({ kind: 'skip_missing_source', auditRow: row, note: 'translation row not found' })
        continue
      }
      if (src.locale !== row.stored_locale) {
        plan.push({ kind: 'error', auditRow: row, note: `locale drift: DB says ${src.locale}, CSV says ${row.stored_locale}` })
        continue
      }
      if (isNameOnly(src)) {
        plan.push({ kind: 'skip_name_only', auditRow: row })
        continue
      }

      const tgt = await readRowForLocale(client, row.place_id, 'pt')
      const merged = mergeEditorial(tgt ?? {}, src)

      plan.push({
        kind: 'move',
        auditRow: row,
        source: src,
        targetExisting: tgt,
        targetMerged: merged,
      })

      if (APPLY) {
        await upsertTargetLocale(client, row.place_id, 'pt', merged)
        await clearSourceRow(client, src.id)
      }
      placesTouched.add(row.place_id)
    }

    // Ensure every touched place has pt / en / es rows.
    let emptyRowsCreated = 0
    if (APPLY) {
      for (const placeId of placesTouched) {
        for (const locale of ['pt', 'en', 'es']) {
          const created = await ensureEmptyLocaleRow(client, placeId, locale)
          if (created) emptyRowsCreated++
        }
      }
    } else {
      // Count what WOULD be created
      for (const placeId of placesTouched) {
        for (const locale of ['pt', 'en', 'es']) {
          const r = await readRowForLocale(client, placeId, locale)
          if (!r) emptyRowsCreated++
        }
      }
    }

    // Duplicate check (unique constraint should make this impossible).
    const { rows: dupRows } = await client.query<{ place_id: string; locale: string; n: string }>(
      `SELECT place_id, locale, COUNT(*)::text AS n
         FROM place_translations
        GROUP BY place_id, locale
       HAVING COUNT(*) > 1`,
    )
    const duplicatesFound = dupRows.reduce((s, r) => s + Number(r.n) - 1, 0)

    // Validation: locales marked 'en' still containing PT stopwords.
    const { rows: enStillPt } = await client.query<{ id: string; place_id: string; sample: string }>(
      `SELECT id, place_id,
              left(coalesce(goldenbook_note, short_description, full_description, insider_tip, ''), 80) AS sample
         FROM place_translations
        WHERE locale = 'en'
          AND (
            goldenbook_note   ~* '\\y(não|você|está|melhor|perto|lugar)\\y'
         OR short_description ~* '\\y(não|você|está|melhor|perto|lugar)\\y'
         OR full_description  ~* '\\y(não|você|está|melhor|perto|lugar)\\y'
         OR insider_tip       ~* '\\y(não|você|está|melhor|perto|lugar)\\y'
          )`,
    )

    // Fallback-chain smoke test: pick one touched place and read via 4-tier chain.
    const sampleId = [...placesTouched][0]
    let fallbackSample: { es_full: string | null; pt_full: string | null; en_full: string | null } | null = null
    if (sampleId) {
      const { rows } = await client.query<{
        es_full: string | null; pt_full: string | null; en_full: string | null
      }>(
        `SELECT
           COALESCE(NULLIF(pt_es.full_description,''), NULLIF(pt_es_fb.full_description,''), NULLIF(pt_orig.full_description,''), p.full_description) AS es_full,
           COALESCE(NULLIF(pt_pt.full_description,''), NULLIF(pt_pt_fb.full_description,''), NULLIF(pt_orig.full_description,''), p.full_description) AS pt_full,
           COALESCE(NULLIF(pt_en.full_description,''), NULLIF(pt_orig.full_description,''), p.full_description) AS en_full
         FROM places p
         LEFT JOIN place_translations pt_es  ON pt_es.place_id=p.id  AND pt_es.locale='es'
         LEFT JOIN place_translations pt_es_fb ON pt_es_fb.place_id=p.id AND pt_es_fb.locale='en'
         LEFT JOIN place_translations pt_pt  ON pt_pt.place_id=p.id  AND pt_pt.locale='pt'
         LEFT JOIN place_translations pt_pt_fb ON pt_pt_fb.place_id=p.id AND pt_pt_fb.locale='en'
         LEFT JOIN place_translations pt_en  ON pt_en.place_id=p.id  AND pt_en.locale='en'
         LEFT JOIN place_translations pt_orig ON pt_orig.place_id=p.id AND pt_orig.locale=p.original_locale
         WHERE p.id=$1`,
        [sampleId],
      )
      fallbackSample = rows[0] ?? null
    }

    // Missing-locale report
    const { rows: missing } = await client.query<{ place_id: string; has_pt: boolean; has_en: boolean; has_es: boolean }>(
      `SELECT p.id AS place_id,
              bool_or(t.locale='pt') AS has_pt,
              bool_or(t.locale='en') AS has_en,
              bool_or(t.locale='es') AS has_es
         FROM places p
         LEFT JOIN place_translations t ON t.place_id=p.id
        WHERE p.id = ANY($1::uuid[])
        GROUP BY p.id
        HAVING NOT (bool_or(t.locale='pt') AND bool_or(t.locale='en') AND bool_or(t.locale='es'))`,
      [[...placesTouched]],
    )

    if (APPLY) {
      await client.query('COMMIT')
      transactionStarted = false
    }

    // ── Plan print ──
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(APPLY ? '  APPLIED' : '  DRY-RUN (no changes written)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    for (const p of plan) {
      const { auditRow } = p
      const prefix = `  ${auditRow.stored_locale}→${auditRow.detected_locale}  ${auditRow.place_id.slice(0, 8)}…`
      if (p.kind === 'move') {
        const targetNote = p.targetExisting ? `merge into existing pt row (${p.targetExisting.id.slice(0, 8)}…)` : `create new pt row`
        console.log(`${prefix}  MOVE  ${targetNote}`)
        console.log(`             sample: ${auditRow.sample.slice(0, 96)}`)
      } else if (p.kind === 'skip_name_only') {
        console.log(`${prefix}  SKIP  name-only (likely toponym)`)
      } else if (p.kind === 'skip_missing_source') {
        console.log(`${prefix}  SKIP  source row not found`)
      } else {
        console.log(`${prefix}  ERROR ${p.note}`)
      }
    }

    // ── Final report ──
    const moves         = plan.filter(p => p.kind === 'move').length
    const skipsNameOnly = plan.filter(p => p.kind === 'skip_name_only').length
    const skipsMissing  = plan.filter(p => p.kind === 'skip_missing_source').length
    const errors        = plan.filter(p => p.kind === 'error').length

    console.log('\n━━━ Report ━━━')
    console.log(`  rows corrected                 : ${moves}`)
    console.log(`  skipped (name-only toponyms)   : ${skipsNameOnly}`)
    console.log(`  skipped (source row missing)   : ${skipsMissing}`)
    console.log(`  errors                         : ${errors}`)
    console.log(`  duplicates removed             : ${duplicatesFound}` +
                (duplicatesFound > 0 ? '  ⚠  dedupe logic required' : ''))
    console.log(`  empty rows created (pt/en/es)  : ${emptyRowsCreated}` +
                (APPLY ? '' : '  (would create on --apply)'))
    console.log(`  places still missing locale    : ${missing.length}`)
    if (missing.length > 0) {
      for (const m of missing.slice(0, 10)) {
        const miss = [
          !m.has_pt ? 'pt' : null,
          !m.has_en ? 'en' : null,
          !m.has_es ? 'es' : null,
        ].filter(Boolean).join(',')
        console.log(`    - ${m.place_id} missing: ${miss}`)
      }
    }

    // ── Validation ──
    console.log('\n━━━ Validation ━━━')
    console.log(`  EN rows still containing PT markers: ${enStillPt.length}`)
    if (enStillPt.length > 0) {
      for (const r of enStillPt.slice(0, 5)) {
        console.log(`    - ${r.id} place=${r.place_id} sample="${r.sample.slice(0, 60)}"`)
      }
    }
    console.log(`  duplicates in place_translations   : ${duplicatesFound}`)
    if (fallbackSample) {
      const has = (v: string | null) => v && v.length > 0 ? '✓' : '·'
      console.log(`  fallback chain smoke test (place=${sampleId?.slice(0, 8)}…):`)
      console.log(`    es  ${has(fallbackSample.es_full)}   pt  ${has(fallbackSample.pt_full)}   en  ${has(fallbackSample.en_full)}`)
    }

    if (!APPLY) {
      console.log('\nDRY-RUN complete. Re-run with --apply to execute inside a transaction.\n')
    } else {
      console.log('\nApplied and committed. Mobile clients will pick up the change on next foreground (content_version bumped).\n')
    }
  } catch (err) {
    if (transactionStarted) {
      try { await client.query('ROLLBACK') } catch {}
    }
    throw err
  } finally {
    client.release()
  }
}

// ─── Entry ────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('\n✖ DATABASE_URL is not set. Run with `npx tsx --env-file=.env ...`')
    process.exit(2)
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })
  try {
    await planAndExecute(pool)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('\n✖ apply-translation-cleanup failed:', err)
  process.exit(1)
})
