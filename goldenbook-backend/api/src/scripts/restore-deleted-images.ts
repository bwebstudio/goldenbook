#!/usr/bin/env tsx
// ─── Restore the place images lost on 2026-09-20 ────────────────────────────
//
// Context: the orphan cleanup that freed 1.19 GB also deleted 79 objects that
// WERE referenced. `media_assets.path` is stored in two formats — 476 rows
// hold the bare object key, 79 hold it prefixed with '<bucket>/' — and
// `storage.objects.name` never carries the prefix. Comparing the raw column
// classified every prefixed row as unreferenced. Both scripts now normalise
// the prefix; this one puts the images back.
//
// Sources, in descending fidelity:
//
//   firebase — the pre-migration originals. The Firestore export under
//              data-migration/firestore-export/establishments.json still holds
//              signed URLs into goldenbook-a1cd1.firebasestorage.app (they
//              expire in the year 2500) and the bucket is live. These are
//              GoldenBook's own editorial photos. 28 of them are ALSO already
//              in the Supabase `establishments` bucket, in which case we link
//              to that copy instead of uploading anything.
//
//   google   — Places API photos, for the 10 places created after the Firebase
//              migration that therefore have no original to recover. Generic
//              venue photography, not GoldenBook's own. Opt in explicitly.
//
// Order of operations per place is deliberate: restore first, prune the dead
// rows second, fix the cover last. A place is never left with fewer images
// than it started with, even if a download fails halfway.
//
// Usage:
//   npx tsx api/src/scripts/restore-deleted-images.ts                    # dry run, firebase
//   npx tsx api/src/scripts/restore-deleted-images.ts --confirm
//   npx tsx api/src/scripts/restore-deleted-images.ts --source=google --confirm
//   npx tsx api/src/scripts/restore-deleted-images.ts --place=coquine-porto --confirm

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

// The repo keeps two env files: goldenbook-backend/.env (DATABASE_URL,
// Supabase) and goldenbook-backend/api/.env (GOOGLE_MAPS_API_KEY). `dotenv`
// resolves relative to the working directory, so which one gets picked up
// depends on where the script is run from. Load the api one by absolute path
// as well — dotenv does not overwrite variables that are already set, so this
// only fills the gaps.
loadEnv({ path: resolve(__dirname, '../../.env') })
import { db } from '../db/postgres'
import { env } from '../config/env'
import { addImageToPlace } from '../modules/admin/places/admin-images.query'

const CONFIRM = process.argv.includes('--confirm')
const SOURCE = (process.argv.find((a) => a.startsWith('--source='))?.slice('--source='.length) ?? 'firebase') as 'firebase' | 'google'
/**
 * Drop the rows pointing at missing objects without restoring anything.
 *
 * For a place that kept most of its own photography, a slightly shorter
 * gallery of GoldenBook's images beats one padded with generic Google stock.
 * The rows have no bytes behind them, so removing them only stops the
 * dashboard rendering broken thumbnails.
 */
const PRUNE_ONLY = process.argv.includes('--prune-only')
const ONLY_PLACE = process.argv.find((a) => a.startsWith('--place='))?.slice('--place='.length)
/**
 * Cap on images restored per place. Defaults to no cap for `firebase` (those
 * are GoldenBook's own photos, so more is better) and is worth setting low for
 * `google`, whose photos are a stopgap to be replaced once the originals turn
 * up — a small set is easier for an editor to swap out than a full gallery.
 */
const MAX_PER_PLACE = (() => {
  const raw = process.argv.find((a) => a.startsWith('--max='))?.slice('--max='.length)
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : Infinity
})()

const PLACE_BUCKET = 'place-images'
const LEGACY_BUCKET = 'establishments'
/** Matches admin-images.query.ts. Restoring must not push a place over it. */
const MAX_IMAGES_PER_PLACE = 10

const EXPORT_PATH = resolve(
  __dirname,
  '../../../data-migration/firestore-export/establishments.json',
)
const MAPPING_PATH = resolve(
  __dirname,
  '../../../data-migration/mappings/places-id-mapping.json',
)

// ─── Types ──────────────────────────────────────────────────────────────────

interface Dangling { place_id: string; slug: string; name: string; asset_id: string; path: string; image_role: string }
interface Candidate { url: string; legacyKey: string | null }

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Rows whose storage object no longer exists. The prefix normalisation here is
 * the fix for the bug that caused the loss — comparing `m.path` raw against
 * `o.name` is what made 79 live images look unreferenced.
 */
async function findDangling(): Promise<Dangling[]> {
  const { rows } = await db.query<Dangling>(`
    SELECT pi.place_id, p.slug, p.name, m.id AS asset_id, m.path, pi.image_role
    FROM media_assets m
    JOIN place_images pi ON pi.asset_id = m.id
    JOIN places p ON p.id = pi.place_id
    LEFT JOIN storage.objects o
      ON o.bucket_id = m.bucket
     AND o.name = CASE WHEN m.path LIKE m.bucket || '/%'
                       THEN substring(m.path from length(m.bucket) + 2)
                       ELSE m.path END
    WHERE o.name IS NULL
    ORDER BY p.slug
  `)
  return ONLY_PLACE ? rows.filter((r) => r.slug === ONLY_PLACE) : rows
}

async function countLiveImages(placeId: string): Promise<number> {
  const { rows: [r] } = await db.query<{ n: string }>(`
    SELECT count(*)::text AS n
    FROM place_images pi
    JOIN media_assets m ON m.id = pi.asset_id
    JOIN storage.objects o
      ON o.bucket_id = m.bucket
     AND o.name = CASE WHEN m.path LIKE m.bucket || '/%'
                       THEN substring(m.path from length(m.bucket) + 2)
                       ELSE m.path END
    WHERE pi.place_id = $1
  `, [placeId])
  return Number(r.n)
}

/**
 * Every place_images row, live or dead. This is what addImageToPlace's cap
 * counts, so it is what "how many more fit" must be derived from — counting
 * only the live ones overshot the cap and threw mid-run.
 */
async function countAllRows(placeId: string): Promise<number> {
  const { rows: [r] } = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM place_images WHERE place_id = $1`, [placeId],
  )
  return Number(r.n)
}

/** Already attached to this place? Keeps re-runs from duplicating rows. */
async function alreadyAttached(placeId: string, bucket: string, path: string): Promise<boolean> {
  const { rows } = await db.query(`
    SELECT 1 FROM place_images pi
    JOIN media_assets m ON m.id = pi.asset_id
    WHERE pi.place_id = $1 AND m.bucket = $2 AND m.path = $3 LIMIT 1
  `, [placeId, bucket, path])
  return rows.length > 0
}

// ─── Firebase source ────────────────────────────────────────────────────────

/**
 * Derive the Supabase `establishments` object key from a signed Firebase URL.
 *
 * The export holds two URL shapes, and the bucket holds both naming styles to
 * match:
 *
 *   …/<host>/establishments/<slug>/mainImage.jpg   → key '<slug>/mainImage.jpg'
 *   …/<host>/o/establishments%2F<file>.jpg         → key '<file>.jpg'
 *
 * The second form percent-encodes its slashes, so the path must be decoded
 * before any prefix is stripped — decoding after a naive split is what made
 * an earlier pass derive keys like 's%2F1757…jpg' and find no matches.
 *
 * Returns null when the URL does not point into the legacy bucket, in which
 * case the caller transfers the file from Firebase instead of linking.
 */
function legacyKeyFromUrl(url: string): string | null {
  const afterHost = url.split('.app/')[1]?.split('?')[0]
  if (!afterHost) return null
  let key = decodeURIComponent(afterHost)
  if (key.startsWith('o/')) key = key.slice(2)
  if (!key.startsWith(`${LEGACY_BUCKET}/`)) return null
  key = key.slice(LEGACY_BUCKET.length + 1)
  return key || null
}

/** supabase place uuid → the signed Firebase URLs recorded for it at migration. */
function loadFirebaseCandidates(): Map<string, Candidate[]> {
  const raw = JSON.parse(readFileSync(EXPORT_PATH, 'utf8')) as unknown
  const records = (Array.isArray(raw) ? raw : Object.values(raw as object)) as {
    id: string; mainImage?: string; gallery?: string[]
  }[]
  const mapping = (JSON.parse(readFileSync(MAPPING_PATH, 'utf8')) as { places: Record<string, string> }).places

  const out = new Map<string, Candidate[]>()
  for (const rec of records) {
    const placeId = mapping[rec.id]
    if (!placeId) continue
    const urls = [...(rec.mainImage ? [rec.mainImage] : []), ...(rec.gallery ?? [])]
    if (urls.length === 0) continue
    out.set(placeId, urls.map((url) => ({ url, legacyKey: legacyKeyFromUrl(url) })))
  }
  return out
}

/** True when the Supabase legacy bucket already holds this object. */
async function existsInLegacyBucket(key: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM storage.objects WHERE bucket_id = $1 AND name = $2 LIMIT 1`,
    [LEGACY_BUCKET, key],
  )
  return rows.length > 0
}

// ─── Google source ──────────────────────────────────────────────────────────

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

async function googlePhotoNames(googlePlaceId: string, want: number): Promise<string[]> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'photos' },
  })
  if (!res.ok) return []
  const body = await res.json() as { photos?: { name: string }[] }
  return (body.photos ?? []).slice(0, want).map((p) => p.name)
}

// ─── Upload ─────────────────────────────────────────────────────────────────

async function uploadToStorage(path: string, data: ArrayBuffer, mimeType: string): Promise<boolean> {
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const res = await fetch(`${base}/storage/v1/object/${PLACE_BUCKET}/${encoded}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': mimeType,
      'x-upsert': 'false',
    },
    body: Buffer.from(data),
  })
  if (!res.ok) {
    console.error(`      upload failed: ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`)
    return false
  }
  return true
}

/** What the app can actually render. Anything else must not enter the bucket. */
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function downloadAndAttach(placeId: string, url: string, index: number): Promise<boolean> {
  // Some `gallery` entries in the Firestore export are Google Drive FOLDER
  // links rather than images (6 places carry one). Drive answers those with
  // 200 and an HTML page, so status alone is not evidence of an image — an
  // earlier pass stored four such pages as .jpg files. Check what actually
  // came back before writing it.
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) { console.error(`      download failed: ${res.status}`); return false }
  const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!ACCEPTED_MIME.has(mimeType)) {
    console.error(`      not an image (${mimeType || 'unknown type'}), skipping`)
    return false
  }
  const data = await res.arrayBuffer()
  if (data.byteLength === 0) { console.error('      empty response, skipping'); return false }
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const path = `places/${placeId}/restored-${Date.now()}-${index}.${ext}`

  if (!await uploadToStorage(path, data, mimeType)) return false
  await addImageToPlace(placeId, {
    bucket: PLACE_BUCKET, path, mimeType,
    width: null, height: null, sizeBytes: data.byteLength,
  })
  return true
}

/** Attach an object that already lives in the legacy bucket. No transfer. */
async function attachLegacy(placeId: string, key: string): Promise<boolean> {
  if (await alreadyAttached(placeId, LEGACY_BUCKET, key)) return false
  await addImageToPlace(placeId, {
    bucket: LEGACY_BUCKET, path: key, mimeType: null,
    width: null, height: null, sizeBytes: null,
  })
  return true
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/** Drop the rows that point at objects which no longer exist. */
async function pruneDangling(rows: Dangling[]): Promise<void> {
  for (const r of rows) {
    await db.query(`DELETE FROM place_images WHERE asset_id = $1 AND place_id = $2`, [r.asset_id, r.place_id])
    // Only remove the asset once nothing else references it.
    await db.query(`
      DELETE FROM media_assets m
      WHERE m.id = $1
        AND NOT EXISTS (SELECT 1 FROM place_images pi WHERE pi.asset_id = m.id)
        AND NOT EXISTS (SELECT 1 FROM destinations d WHERE d.hero_image_asset_id = m.id)
        AND NOT EXISTS (SELECT 1 FROM routes ro WHERE ro.cover_asset_id = m.id)
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.avatar_asset_id = m.id)
    `, [r.asset_id])
  }
}

/** A place whose cover was among the deleted images needs a new one. */
async function ensureCover(placeId: string): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(`
    SELECT id FROM place_images
    WHERE place_id = $1 AND image_role IN ('hero', 'cover') LIMIT 1
  `, [placeId])
  if (rows.length > 0) return false

  const { rows: promote } = await db.query<{ id: string }>(`
    SELECT id FROM place_images
    WHERE place_id = $1 ORDER BY sort_order, created_at LIMIT 1
  `, [placeId])
  if (promote.length === 0) return false

  await db.query(
    `UPDATE place_images SET image_role = 'cover', is_primary = true WHERE id = $1`,
    [promote[0].id],
  )
  return true
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!CONFIRM) console.log('\nDRY RUN — nothing is written. Re-run with --confirm.')
  console.log(`Source: ${SOURCE}${ONLY_PLACE ? `   Place: ${ONLY_PLACE}` : ''}\n`)

  if (SOURCE === 'google' && !GOOGLE_KEY) {
    console.error('GOOGLE_MAPS_API_KEY is not set (it lives in api/.env). Aborting.')
    process.exit(1)
  }

  const dangling = await findDangling()
  if (dangling.length === 0) { console.log('No dangling image rows. Nothing to restore.\n'); return }

  const byPlace = new Map<string, Dangling[]>()
  for (const d of dangling) {
    if (!byPlace.has(d.place_id)) byPlace.set(d.place_id, [])
    byPlace.get(d.place_id)!.push(d)
  }
  console.log(`${dangling.length} dead image rows across ${byPlace.size} places\n`)

  const firebase = SOURCE === 'firebase' ? loadFirebaseCandidates() : new Map<string, Candidate[]>()
  let restored = 0, linked = 0, skipped = 0, pruned = 0, covers = 0, failures = 0

  for (const [placeId, rows] of byPlace) {
    const { slug, name } = rows[0]
    const live = await countLiveImages(placeId)
    // The dangling rows are removed before anything is added, so the space
    // they occupy against the cap is space we get back.
    const room = Math.min(
      MAX_PER_PLACE,
      Math.max(0, MAX_IMAGES_PER_PLACE - (await countAllRows(placeId)) + rows.length),
    )

    let sources: Candidate[] = []
    if (PRUNE_ONLY) {
      console.log(`${name}  (${slug})`)
      console.log(`  ${rows.length} dead rows, ${live} live images kept`)
      if (CONFIRM) {
        await pruneDangling(rows)
        pruned += rows.length
        if (await ensureCover(placeId)) covers++
      }
      console.log(`  → ${CONFIRM ? 'pruned' : 'would prune'} ${rows.length}\n`)
      continue
    }
    if (SOURCE === 'firebase') {
      sources = (firebase.get(placeId) ?? []).slice(0, room)
    } else {
      const { rows: [pl] } = await db.query<{ google_place_id: string | null }>(
        `SELECT google_place_id FROM places WHERE id = $1`, [placeId],
      )
      if (pl?.google_place_id) {
        // Google photo names are fetched but ingested through the same
        // download path, so the two sources share all the write logic.
        const names = await googlePhotoNames(pl.google_place_id, room)
        sources = names.map((n) => ({
          url: `https://places.googleapis.com/v1/${n}/media?maxWidthPx=1600&key=${GOOGLE_KEY}`,
          legacyKey: null,
        }))
      }
    }

    console.log(`${name}  (${slug})`)
    console.log(`  lost ${rows.length}, still live ${live}, available from ${SOURCE}: ${sources.length}`)

    if (sources.length === 0) {
      console.log('  → no source, leaving the dead rows in place for now\n')
      skipped++
      continue
    }

    if (!CONFIRM) {
      const reused = (await Promise.all(sources.map((s) => s.legacyKey ? existsInLegacyBucket(s.legacyKey) : Promise.resolve(false)))).filter(Boolean).length
      console.log(`  → would restore ${sources.length} (${reused} by linking the existing Supabase copy, ${sources.length - reused} by transfer)\n`)
      continue
    }

    let okHere = 0
    try {
      // Prune first. These rows point at objects that no longer exist, so
      // removing them destroys nothing — and it frees their slots against the
      // per-place cap, which an earlier ordering did not account for.
      await pruneDangling(rows)
      pruned += rows.length

      for (let i = 0; i < sources.length; i++) {
        const src = sources[i]
        if (src.legacyKey && await existsInLegacyBucket(src.legacyKey)) {
          if (await attachLegacy(placeId, src.legacyKey)) { linked++; okHere++ }
        } else if (await downloadAndAttach(placeId, src.url, i)) {
          restored++; okHere++
        }
      }
      if (await ensureCover(placeId)) covers++
    } catch (err) {
      // One bad place must not abort the pass over the rest.
      console.error(`  ! ${err instanceof Error ? err.message : err}`)
      failures++
    }
    console.log(`  → ${okHere} restored, ${rows.length} dead rows removed\n`)
  }

  console.log('── Summary ──────────────────────────────────────────────────')
  console.log(`  transferred        ${restored}`)
  console.log(`  linked in place    ${linked}`)
  console.log(`  dead rows removed  ${pruned}`)
  console.log(`  covers reassigned  ${covers}`)
  console.log(`  places with no source for this pass: ${skipped}`)
  if (failures) console.log(`  places that errored: ${failures}`)
  if (SOURCE === 'firebase' && skipped > 0) {
    console.log(`\n  Those ${skipped} postdate the Firebase migration. Re-run with`)
    console.log(`  --source=google, or get the originals from GoldenBook.`)
  }
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })
