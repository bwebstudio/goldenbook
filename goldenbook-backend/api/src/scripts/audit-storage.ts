#!/usr/bin/env tsx
// ─── Storage quota audit ────────────────────────────────────────────────────
//
// Written after the project tripped Supabase's `exceed_storage_size_quota` and
// the dashboard went read-only ("O serviço para este projeto é restrito…").
//
// The violation was widely assumed to be traffic-related. It is not: that
// quota counts BYTES AT REST in Storage buckets. Request volume and egress
// trip different violations entirely. At the time of the audit:
//
//   Postgres database       82 MB   (Free tier allows 500 MB — not the cause)
//   Storage, all buckets  1.44 GB   (Free tier allows 1 GB — this is the cause)
//
// and within Storage, 262 of the 717 objects in `place-images` — 1.19 GB of
// the 1.34 GB in that bucket — had no `place_images` row pointing at them.
// They were leaked by the delete endpoint, which removed the database rows
// and returned the object location to a caller that never deleted it.
//
// This script is READ-ONLY. It reports; it deletes nothing. Deleting
// production objects is a deliberate, authorised step — see the printed
// summary for what to hand to whoever runs it.
//
// Usage:
//   npx tsx api/src/scripts/audit-storage.ts
//   npx tsx api/src/scripts/audit-storage.ts --list-orphans > orphans.txt

import { db } from '../db/postgres'

const LIST_ORPHANS = process.argv.includes('--list-orphans')

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function main() {
  // ── 1. Where the bytes actually are ──────────────────────────────────────
  const { rows: buckets } = await db.query<{
    bucket: string; objects: string; bytes: string
  }>(`
    SELECT b.name AS bucket,
           count(o.id)::text AS objects,
           COALESCE(sum((o.metadata->>'size')::bigint), 0)::text AS bytes
    FROM storage.buckets b
    LEFT JOIN storage.objects o ON o.bucket_id = b.id
    GROUP BY b.name
    ORDER BY 3 DESC
  `)

  const { rows: [dbSize] } = await db.query<{ bytes: string }>(
    `SELECT pg_database_size(current_database())::text AS bytes`,
  )

  let storageTotal = 0
  console.log('\n── Where the bytes are ──────────────────────────────────────')
  console.log(`  postgres database        ${mb(Number(dbSize.bytes)).padStart(10)}`)
  for (const b of buckets) {
    storageTotal += Number(b.bytes)
    console.log(`  storage/${b.bucket.padEnd(16)} ${mb(Number(b.bytes)).padStart(10)}  (${b.objects} objects)`)
  }
  console.log(`  ${'storage TOTAL'.padEnd(24)} ${mb(storageTotal).padStart(10)}`)
  console.log(`  Free tier allows 1 GB of Storage; Pro allows 100 GB.`)

  // ── 2. Objects nothing points at ─────────────────────────────────────────
  // `media_assets` is the join between a bucket path and a place; an object
  // with no media_assets row reachable from place_images is unreachable from
  // the product and is pure quota cost.
  const { rows: [orphans] } = await db.query<{
    orphan_objects: string; orphan_bytes: string
    linked_objects: string; linked_bytes: string
  }>(`
    WITH used AS (
      -- media_assets.path is stored inconsistently: 79 of 555 rows carry a
      -- leading '<bucket>/' prefix (legacy) while the rest hold the bare
      -- object key. storage.objects.name NEVER carries the prefix, so
      -- comparing the raw column silently classified every prefixed row as
      -- unreferenced. Strip the prefix before comparing — this is the same
      -- normalisation the dashboard's getStorageUrl() does when it builds a
      -- public URL.
      SELECT DISTINCT
        CASE WHEN m.path LIKE m.bucket || '/%'
             THEN substring(m.path from length(m.bucket) + 2)
             ELSE m.path END AS path
      FROM media_assets m
      JOIN place_images pi ON pi.asset_id = m.id
      WHERE m.bucket = 'place-images'
    )
    SELECT
      count(*) FILTER (WHERE u.path IS NULL)::text AS orphan_objects,
      COALESCE(sum((o.metadata->>'size')::bigint) FILTER (WHERE u.path IS NULL), 0)::text AS orphan_bytes,
      count(*) FILTER (WHERE u.path IS NOT NULL)::text AS linked_objects,
      COALESCE(sum((o.metadata->>'size')::bigint) FILTER (WHERE u.path IS NOT NULL), 0)::text AS linked_bytes
    FROM storage.objects o
    LEFT JOIN used u ON u.path = o.name
    WHERE o.bucket_id = 'place-images'
  `)

  console.log('\n── place-images: referenced vs orphaned ─────────────────────')
  console.log(`  referenced by a place  ${orphans.linked_objects.padStart(5)} objects  ${mb(Number(orphans.linked_bytes)).padStart(10)}`)
  console.log(`  orphaned (no place)    ${orphans.orphan_objects.padStart(5)} objects  ${mb(Number(orphans.orphan_bytes)).padStart(10)}  ← recoverable`)

  // ── 3. Oversized originals still in use ──────────────────────────────────
  // Nothing in the upload path resizes or transcodes, so print-resolution
  // originals land in the bucket untouched. These are referenced, so they
  // cannot simply be deleted — they need re-encoding.
  const { rows: big } = await db.query<{
    path: string; bytes: string; mimetype: string | null; place_name: string | null
  }>(`
    SELECT o.name AS path,
           (o.metadata->>'size')::text AS bytes,
           o.metadata->>'mimetype' AS mimetype,
           p.name AS place_name
    FROM storage.objects o
    LEFT JOIN media_assets m ON m.path = o.name AND m.bucket = 'place-images'
    LEFT JOIN place_images pi ON pi.asset_id = m.id
    LEFT JOIN places p ON p.id = pi.place_id
    WHERE o.bucket_id = 'place-images'
      AND (o.metadata->>'size')::bigint >= 5 * 1024 * 1024
    ORDER BY (o.metadata->>'size')::bigint DESC
    LIMIT 25
  `)

  const { rows: [bigTotal] } = await db.query<{ n: string; bytes: string }>(`
    SELECT count(*)::text AS n,
           COALESCE(sum((o.metadata->>'size')::bigint), 0)::text AS bytes
    FROM storage.objects o
    WHERE o.bucket_id = 'place-images'
      AND (o.metadata->>'size')::bigint >= 5 * 1024 * 1024
  `)

  console.log('\n── Oversized originals (>5 MB) ──────────────────────────────')
  console.log(`  ${bigTotal.n} objects hold ${mb(Number(bigTotal.bytes))}. Nothing in the upload path`)
  console.log(`  resizes or transcodes, so camera/print originals are stored as-is.`)
  console.log(`  Largest:`)
  for (const r of big.slice(0, 10)) {
    const label = r.place_name ?? '(orphan — no place)'
    console.log(`    ${mb(Number(r.bytes)).padStart(9)}  ${(r.mimetype ?? '?').padEnd(12)}  ${label}`)
  }

  // ── 4. What to do ────────────────────────────────────────────────────────
  console.log('\n── Recoverable, in order of safety ──────────────────────────')
  console.log(`  1. Delete the ${orphans.orphan_objects} orphaned objects → frees ${mb(Number(orphans.orphan_bytes))}.`)
  console.log(`     Nothing in the product references them. Take a bucket listing first.`)
  console.log(`  2. Re-encode the oversized originals that ARE referenced`)
  console.log(`     (long edge ~2560px, WebP/JPEG q80) → typically 90%+ of ${mb(Number(bigTotal.bytes))}.`)
  console.log(`  3. Resize on upload so this does not rebuild.`)
  console.log(`\n  Deleting client records does NOT help: the whole database is`)
  console.log(`  ${mb(Number(dbSize.bytes))}, which is not the quota being exceeded.\n`)

  if (LIST_ORPHANS) {
    const { rows } = await db.query<{ path: string; bytes: string }>(`
      WITH used AS (
      -- media_assets.path is stored inconsistently: 79 of 555 rows carry a
      -- leading '<bucket>/' prefix (legacy) while the rest hold the bare
      -- object key. storage.objects.name NEVER carries the prefix, so
      -- comparing the raw column silently classified every prefixed row as
      -- unreferenced. Strip the prefix before comparing — this is the same
      -- normalisation the dashboard's getStorageUrl() does when it builds a
      -- public URL.
      SELECT DISTINCT
        CASE WHEN m.path LIKE m.bucket || '/%'
             THEN substring(m.path from length(m.bucket) + 2)
             ELSE m.path END AS path
        FROM media_assets m
        JOIN place_images pi ON pi.asset_id = m.id
        WHERE m.bucket = 'place-images'
      )
      SELECT o.name AS path, (o.metadata->>'size')::text AS bytes
      FROM storage.objects o
      LEFT JOIN used u ON u.path = o.name
      WHERE o.bucket_id = 'place-images' AND u.path IS NULL
      ORDER BY (o.metadata->>'size')::bigint DESC
    `)
    console.log('── Orphaned object paths ────────────────────────────────────')
    for (const r of rows) console.log(`${r.path}\t${r.bytes}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })
