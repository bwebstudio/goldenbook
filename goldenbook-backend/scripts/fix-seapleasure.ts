#!/usr/bin/env tsx
// One-shot surgical fix: clear ES.full_description of Seapleasure which
// contains Portuguese text (partial DeepL failure). The other ES fields
// (short_description, goldenbook_note, insider_tip) are correct — leave them.
// Runs inside a transaction.

import { Pool } from 'pg'

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 1,
  })
  const c = await pool.connect()
  try {
    await c.query('BEGIN')

    const placeId = '15e2337a-2645-4cb1-85eb-f2349b82313b'
    const { rows: before } = await c.query<{ full_description: string | null }>(
      `SELECT full_description FROM place_translations WHERE place_id=$1 AND locale='es'`,
      [placeId],
    )
    console.log('ES.full_description BEFORE:')
    console.log(' ', (before[0]?.full_description ?? '∅').slice(0, 180))

    await c.query(
      `UPDATE place_translations
          SET full_description = NULL,
              source = 'manual_fix',
              is_override = true,
              updated_at = now()
        WHERE place_id = $1 AND locale = 'es'`,
      [placeId],
    )

    const { rows: after } = await c.query<{ full_description: string | null }>(
      `SELECT full_description FROM place_translations WHERE place_id=$1 AND locale='es'`,
      [placeId],
    )
    console.log('\nES.full_description AFTER:')
    console.log(' ', after[0]?.full_description ?? 'NULL (será resuelto por fallback → pt_orig)')

    await c.query('COMMIT')
    console.log('\nCommitted. content_version bumped via trigger.\n')
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    c.release()
    await pool.end()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
