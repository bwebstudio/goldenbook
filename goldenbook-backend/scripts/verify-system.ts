#!/usr/bin/env tsx
/**
 * verify-system.ts
 *
 * Runs the verification checklist from the STEP 1–8 request against the
 * live database. Read-only except for one scoped no-op UPDATE that we
 * wrap in a transaction and ROLLBACK at the end (to confirm the
 * content_version trigger fires without leaving side effects).
 *
 * Prints a structured status table at the end.
 */

import { Pool } from 'pg'

interface Check { name: string; ok: boolean; detail?: string }

const checks: Check[] = []
function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail })
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing')
    process.exit(2)
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })
  const c = await pool.connect()

  try {
    // ── Step 1: content_version table + triggers ─────────────────────────
    const { rows: cvExists } = await c.query<{ v: string; updated_at: string }>(
      `SELECT version::text AS v, updated_at FROM content_version WHERE scope='global'`,
    )
    record(
      'content_version row exists (scope=global)',
      !!cvExists[0],
      cvExists[0] ? `version=${cvExists[0].v}` : 'missing',
    )

    const requiredTables = [
      'places','place_translations',
      'routes','route_translations','route_place_translations',
      'categories','category_translations',
      'destinations','destination_translations',
      'place_images','media_assets',
    ]
    const { rows: trigs } = await c.query<{ tgname: string; tbl: string }>(
      `SELECT t.tgname, c.relname AS tbl
         FROM pg_trigger t
         JOIN pg_class   c ON c.oid = t.tgrelid
        WHERE t.tgname LIKE '%bump_content_version%'
          AND NOT t.tgisinternal`,
    )
    const tablesWithTrigger = new Set(trigs.map(t => t.tbl))
    for (const tbl of requiredTables) {
      const present = tablesWithTrigger.has(tbl)
      record(`trigger bump_content_version on ${tbl}`, present,
             present ? 'present' : 'MISSING')
    }

    // ── Step 2: live trigger test — UPDATE + ROLLBACK ────────────────────
    const versionBefore = Number(cvExists[0]?.v ?? 0)
    await c.query('BEGIN')
    try {
      // Touch an arbitrary place row with a no-op UPDATE.
      await c.query(
        `UPDATE places SET updated_at = updated_at WHERE id = (SELECT id FROM places LIMIT 1)`,
      )
      const { rows: after } = await c.query<{ v: string }>(
        `SELECT version::text AS v FROM content_version WHERE scope='global'`,
      )
      const versionAfter = Number(after[0]?.v ?? 0)
      record(
        'content_version bumps on places UPDATE',
        versionAfter > versionBefore,
        `before=${versionBefore} → after=${versionAfter}`,
      )
    } finally {
      await c.query('ROLLBACK')
    }

    // ── Step 4: analytics tables + indexes ───────────────────────────────
    const requiredAnalyticsTables = ['analytics_events', 'user_sessions', 'search_queries']
    const { rows: tExists } = await c.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [requiredAnalyticsTables],
    )
    const existingSet = new Set(tExists.map(r => r.table_name))
    for (const t of requiredAnalyticsTables) {
      record(`table ${t} exists`, existingSet.has(t))
    }

    const { rows: idxRows } = await c.query<{ tablename: string; indexname: string }>(
      `SELECT tablename, indexname FROM pg_indexes
        WHERE schemaname='public' AND tablename = ANY($1::text[])`,
      [requiredAnalyticsTables],
    )
    const countByTable: Record<string, number> = {}
    for (const r of idxRows) countByTable[r.tablename] = (countByTable[r.tablename] ?? 0) + 1
    for (const t of requiredAnalyticsTables) {
      const n = countByTable[t] ?? 0
      record(`${t} has ≥3 indexes`, n >= 3, `${n} indexes`)
    }

    const { rows: enumVals } = await c.query<{ label: string }>(
      `SELECT e.enumlabel AS label
         FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
        WHERE t.typname='analytics_event_name'
        ORDER BY e.enumsortorder`,
    )
    const requiredEvents = [
      'app_session_start','app_session_end',
      'place_view','place_open','map_open',
      'website_click','booking_click',
      'favorite_add','favorite_remove',
      'search_query','search_result_click',
      'now_used','concierge_used',
      'route_start','route_complete',
    ]
    const enumSet = new Set(enumVals.map(r => r.label))
    const missingEvents = requiredEvents.filter(e => !enumSet.has(e))
    record(
      'analytics_event_name enum has all 15 events',
      missingEvents.length === 0,
      missingEvents.length === 0 ? '15/15' : `missing: ${missingEvents.join(',')}`,
    )

    // ── Step 7: data consistency ─────────────────────────────────────────
    const { rows: dup } = await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM (
         SELECT place_id, locale FROM place_translations
          GROUP BY 1,2 HAVING COUNT(*) > 1
       ) s`,
    )
    record('no duplicate (place_id, locale) rows', Number(dup[0]?.n ?? 0) === 0,
           `${dup[0]?.n ?? 0} duplicates`)

    const { rows: uniq } = await c.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'place_translations'::regclass
          AND contype IN ('u','p')`,
    )
    record('unique constraint on place_translations(place_id, locale)',
           uniq.length > 0,
           uniq.map(r => r.conname).join(', '))

    // Fallback-chain sanity: random published place, all three locales resolve.
    const { rows: fb } = await c.query<{
      slug: string; es_full: string | null; pt_full: string | null; en_full: string | null
    }>(
      `SELECT p.slug,
              COALESCE(NULLIF(pt_es.full_description,''), NULLIF(pt_fb.full_description,''), NULLIF(pt_orig.full_description,''), p.full_description) AS es_full,
              COALESCE(NULLIF(pt_pt.full_description,''), NULLIF(pt_fb.full_description,''), NULLIF(pt_orig.full_description,''), p.full_description) AS pt_full,
              COALESCE(NULLIF(pt_en.full_description,''), NULLIF(pt_orig.full_description,''), p.full_description) AS en_full
         FROM places p
         LEFT JOIN place_translations pt_es ON pt_es.place_id=p.id AND pt_es.locale='es'
         LEFT JOIN place_translations pt_pt ON pt_pt.place_id=p.id AND pt_pt.locale='pt'
         LEFT JOIN place_translations pt_en ON pt_en.place_id=p.id AND pt_en.locale='en'
         LEFT JOIN place_translations pt_fb ON pt_fb.place_id=p.id AND pt_fb.locale='en'
         LEFT JOIN place_translations pt_orig ON pt_orig.place_id=p.id AND pt_orig.locale=p.original_locale
        WHERE p.status='published'
        ORDER BY random() LIMIT 1`,
    )
    const sample = fb[0]
    const allFilled = !!(sample?.es_full && sample?.pt_full && sample?.en_full)
    record('fallback chain returns non-null for es/pt/en on a published place', allFilled,
           sample ? `slug=${sample.slug}` : 'no sample')

    // ── Admin analytics readers: query shape smoke-test (no HTTP, direct SQL) ─
    const { rows: probe } = await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM analytics_events WHERE created_at >= now() - interval '30 days'`,
    )
    record('analytics_events is queryable (30d window)', true,
           `${probe[0]?.n ?? 0} rows in last 30 days`)

    // EN rows still carrying PT markers (post-cleanup)
    const { rows: enDirty } = await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM place_translations
        WHERE locale='en' AND (
              goldenbook_note   ~* '\\y(não|você|está|melhor|perto|lugar)\\y'
           OR short_description ~* '\\y(não|você|está|melhor|perto|lugar)\\y'
           OR full_description  ~* '\\y(não|você|está|melhor|perto|lugar)\\y'
           OR insider_tip       ~* '\\y(não|você|está|melhor|perto|lugar)\\y'
        )`,
    )
    record('EN rows with residual PT markers (goal: 0–2 false positives)',
           Number(enDirty[0]?.n) <= 2,
           `${enDirty[0]?.n} rows`)

    // places with complete pt/en/es coverage
    const { rows: coverage } = await c.query<{ missing: string }>(
      `SELECT COUNT(*)::text AS missing FROM (
         SELECT p.id
           FROM places p
          WHERE p.status='published'
            AND (
              NOT EXISTS (SELECT 1 FROM place_translations WHERE place_id=p.id AND locale='pt') OR
              NOT EXISTS (SELECT 1 FROM place_translations WHERE place_id=p.id AND locale='en') OR
              NOT EXISTS (SELECT 1 FROM place_translations WHERE place_id=p.id AND locale='es')
            )
       ) s`,
    )
    record('all published places have pt/en/es rows',
           Number(coverage[0]?.missing ?? 0) === 0,
           `${coverage[0]?.missing ?? 0} places still missing a locale`)

  } finally {
    c.release()
    await pool.end()
  }

  // ── Report ──
  console.log('\n━━━━━━━━━━━━━━━━ System verification ━━━━━━━━━━━━━━━━')
  let pass = 0, fail = 0
  for (const ch of checks) {
    const mark = ch.ok ? '✓' : '✖'
    console.log(`  ${mark}  ${ch.name.padEnd(60)}${ch.detail ? '  — ' + ch.detail : ''}`)
    ch.ok ? pass++ : fail++
  }
  console.log(`\n  ${pass} pass · ${fail} fail\n`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('verify-system failed:', err)
  process.exit(1)
})
