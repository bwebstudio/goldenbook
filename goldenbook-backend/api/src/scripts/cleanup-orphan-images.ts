#!/usr/bin/env tsx
// ─── Delete orphaned objects from the place-images bucket ───────────────────
//
// Companion to audit-storage.ts. This one DELETES, so it is deliberately
// awkward to run: it refuses to do anything without --confirm, and it always
// writes a manifest of what it is about to remove first.
//
// "Orphan" means: an object in the `place-images` bucket whose path is not
// reachable from any of the four columns that can point at a media_asset.
// All four are checked, not just place_images.asset_id — `destinations`,
// `routes` and `users` also hold asset references, and treating an object
// used as a destination hero as an orphan would delete a live image.
//
// These objects were leaked by the delete endpoint, which removed the
// database rows and returned the object location to a caller that never acted
// on it (fixed in admin-places.route.ts). They are unreachable from the
// product and are pure Supabase storage-quota cost.
//
// Recovery: there is none. Supabase Storage has no undelete. The manifest is
// the only record of what existed, so it is written before the first delete
// and the run aborts if it cannot be written.
//
// Usage:
//   npx tsx api/src/scripts/cleanup-orphan-images.ts              # dry run
//   npx tsx api/src/scripts/cleanup-orphan-images.ts --confirm    # deletes

import { db } from '../db/postgres'
import { env } from '../config/env'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CONFIRM = process.argv.includes('--confirm')
const BUCKET = 'place-images'
// Supabase's bulk delete takes a list of paths per call. Keep batches modest
// so one failure costs little and the progress line stays meaningful.
const BATCH_SIZE = 50

interface Orphan { path: string; size: number; created_at: string }

async function findOrphans(): Promise<Orphan[]> {
  const { rows } = await db.query<{ path: string; size: string; created_at: string }>(`
    WITH referenced_assets AS (
      SELECT asset_id AS id            FROM place_images  WHERE asset_id            IS NOT NULL
      UNION SELECT hero_image_asset_id FROM destinations  WHERE hero_image_asset_id IS NOT NULL
      UNION SELECT cover_asset_id      FROM routes        WHERE cover_asset_id      IS NOT NULL
      UNION SELECT avatar_asset_id     FROM users         WHERE avatar_asset_id     IS NOT NULL
      -- Business-portal uploads awaiting editorial review: the asset exists
      -- but is only linked to place_images once approved. Without this the
      -- sweeper would delete every image still in the review queue.
      UNION SELECT ma.id FROM place_change_requests cr
            JOIN media_assets ma ON ma.id::text = cr.new_value
            WHERE cr.field_name = 'new_image' AND cr.status = 'pending'
    ),
    used_paths AS (
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
      JOIN referenced_assets r ON r.id = m.id
      WHERE m.bucket = $1
    )
    SELECT o.name AS path,
           COALESCE((o.metadata->>'size')::bigint, 0)::text AS size,
           to_char(o.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
    FROM storage.objects o
    LEFT JOIN used_paths u ON u.path = o.name
    WHERE o.bucket_id = $1 AND u.path IS NULL
    ORDER BY (o.metadata->>'size')::bigint DESC NULLS LAST
  `, [BUCKET])
  return rows.map((r) => ({ path: r.path, size: Number(r.size), created_at: r.created_at }))
}

/** Bulk-delete a batch of paths. Returns the paths Supabase reports removed. */
async function deleteBatch(paths: string[]): Promise<string[]> {
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const res = await fetch(`${base}/storage/v1/object/${encodeURIComponent(BUCKET)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: paths }),
  })
  if (!res.ok) {
    throw new Error(`storage delete failed: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`)
  }
  const body = (await res.json().catch(() => [])) as { name?: string }[]
  return Array.isArray(body) ? body.map((o) => o.name ?? '').filter(Boolean) : []
}

function mb(bytes: number): string { return `${(bytes / 1024 / 1024).toFixed(1)} MB` }

async function main() {
  const orphans = await findOrphans()
  const total = orphans.reduce((sum, o) => sum + o.size, 0)

  console.log(`\n${orphans.length} orphaned objects in ${BUCKET}, ${mb(total)}`)
  if (orphans.length === 0) { console.log('Nothing to do.\n'); return }

  // Derive the date range explicitly: `orphans` is ordered by size, not date,
  // so indexing into it would report the wrong range — and the age of the
  // newest orphan is exactly what tells us no in-flight upload is at risk.
  const dates = orphans.map((o) => o.created_at).sort()
  console.log(`  oldest ${dates[0]}, newest ${dates[dates.length - 1]}`)

  if (!CONFIRM) {
    console.log('\nDRY RUN — nothing deleted. Largest 10:')
    for (const o of orphans.slice(0, 10)) console.log(`  ${mb(o.size).padStart(9)}  ${o.created_at}  ${o.path}`)
    console.log('\nRe-run with --confirm to delete. This cannot be undone.\n')
    return
  }

  // Manifest first, always. If we cannot record what we are deleting, we do
  // not delete: there is no other way back.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const manifestPath = resolve(process.cwd(), `orphan-images-deleted-${stamp}.tsv`)
  try {
    writeFileSync(
      manifestPath,
      ['path\tsize_bytes\tcreated_at', ...orphans.map((o) => `${o.path}\t${o.size}\t${o.created_at}`)].join('\n') + '\n',
      'utf8',
    )
    console.log(`\nManifest written: ${manifestPath}`)
  } catch (err) {
    console.error('Could not write the manifest, aborting before any delete:', err)
    process.exit(1)
  }

  let deleted = 0
  let freed = 0
  const failed: string[] = []

  for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
    const batch = orphans.slice(i, i + BATCH_SIZE)
    try {
      const removed = await deleteBatch(batch.map((o) => o.path))
      // Supabase echoes the objects it actually removed. Anything missing
      // from the echo is reported rather than counted as freed.
      const removedSet = new Set(removed)
      for (const o of batch) {
        if (removedSet.size === 0 || removedSet.has(o.path)) { deleted++; freed += o.size }
        else failed.push(o.path)
      }
    } catch (err) {
      console.error(`  batch ${i / BATCH_SIZE + 1} failed:`, err instanceof Error ? err.message : err)
      failed.push(...batch.map((o) => o.path))
    }
    console.log(`  ${Math.min(i + BATCH_SIZE, orphans.length)}/${orphans.length} processed, ${mb(freed)} freed`)
  }

  console.log(`\nDeleted ${deleted} objects, freed ${mb(freed)}.`)
  if (failed.length) {
    console.log(`${failed.length} could not be deleted and are still in the bucket:`)
    for (const p of failed.slice(0, 20)) console.log(`  ${p}`)
  }
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })
