#!/usr/bin/env tsx
// Read-only probe for one place's translation rows across pt/en/es.
// Usage:
//   npx tsx --env-file=.env scripts/inspect-place.ts seapleasure
//   npx tsx --env-file=.env scripts/inspect-place.ts <slug-or-uuid>

import { Pool } from 'pg'

async function main() {
  const target = process.argv[2]
  if (!target) { console.error('Usage: inspect-place <slug-or-uuid>'); process.exit(2) }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })

  const isUuid = /^[0-9a-f]{8}-/.test(target)
  const { rows: places } = await pool.query<{
    id: string; slug: string; name: string; original_locale: string;
    short_description: string | null; full_description: string | null;
  }>(
    isUuid
      ? `SELECT id, slug, name, original_locale, short_description, full_description FROM places WHERE id = $1`
      : `SELECT id, slug, name, original_locale, short_description, full_description FROM places WHERE slug ILIKE $1 OR name ILIKE $1 LIMIT 5`,
    [isUuid ? target : `%${target}%`],
  )

  if (!places.length) { console.error('No place matched.'); process.exit(1) }

  for (const p of places) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`place_id:        ${p.id}`)
    console.log(`slug:            ${p.slug}`)
    console.log(`name:            ${p.name}`)
    console.log(`original_locale: ${p.original_locale}`)
    console.log(`base.short_desc: ${(p.short_description ?? '∅').slice(0, 140)}`)
    console.log(`base.full_desc:  ${(p.full_description  ?? '∅').slice(0, 140)}`)

    const { rows: t } = await pool.query<{
      locale: string; name: string | null;
      short_description: string | null; full_description: string | null;
      goldenbook_note: string | null; insider_tip: string | null;
      source: string; is_override: boolean; updated_at: string;
    }>(
      `SELECT locale, name, short_description, full_description, goldenbook_note, insider_tip,
              source, is_override, updated_at
         FROM place_translations
        WHERE place_id = $1
        ORDER BY locale`,
      [p.id],
    )

    for (const row of t) {
      console.log(`\n  [${row.locale}]  source=${row.source}  is_override=${row.is_override}  updated=${row.updated_at}`)
      console.log(`  name: ${(row.name ?? '∅').slice(0, 120)}`)
      console.log(`  short_description: ${(row.short_description ?? '∅').slice(0, 180)}`)
      console.log(`  full_description:  ${(row.full_description  ?? '∅').slice(0, 220)}`)
      console.log(`  goldenbook_note:   ${(row.goldenbook_note   ?? '∅').slice(0, 180)}`)
      console.log(`  insider_tip:       ${(row.insider_tip       ?? '∅').slice(0, 180)}`)
    }
  }
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
