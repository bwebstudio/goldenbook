// ─── Supabase Storage object removal ────────────────────────────────────────
//
// Deleting a place image used to remove the `place_images` and `media_assets`
// rows and then hand the caller `{ bucket, path }` "so the caller can delete
// from storage" — but no caller ever did. Every image the team deleted or
// replaced stayed in the bucket forever, unreferenced and uncounted.
//
// That leak is what filled the project's Storage quota: at the time of the
// audit 262 of the 717 objects in `place-images` (1.19 GB of 1.34 GB) had no
// row pointing at them, while the whole Postgres database was 82 MB. Supabase
// counts stored bytes, not referenced ones, so the project tripped
// `exceed_storage_size_quota` and the dashboard went read-only.
//
// We talk to the Storage REST API with plain `fetch` rather than pulling in
// @supabase/supabase-js: this is the only Storage call the API makes, and the
// service-role key is already in the environment.

import { env } from '../../config/env'
import { toStorageObjectKey } from './storage-path'

/**
 * Delete a single object from a Supabase Storage bucket.
 *
 * Returns `true` when the object is gone (including when it was already
 * absent — a 404 means the desired end state holds). Returns `false` on any
 * other failure, leaving it to the caller to decide whether that should
 * surface to the user.
 *
 * Never throws: the database rows have already been deleted by the time this
 * runs, so an unreachable Storage API must not turn a completed delete into a
 * 500. A failure here re-creates the orphan the function exists to prevent,
 * so it is logged loudly for the sweeper to pick up later.
 */
export async function deleteStorageObject(bucket: string, path: string): Promise<boolean> {
  if (!bucket || !path) return false

  // Legacy media_assets rows store `place-images/<key>`; sending that as-is
  // requested `place-images/place-images/<key>`, got a 404 and was reported
  // as deleted while the object stayed in the bucket.
  const key = toStorageObjectKey(bucket, path)
  if (!key) return false

  const base = env.SUPABASE_URL.replace(/\/$/, '')
  // Each path segment is encoded separately so the "/" separators survive.
  const encodedPath = key.split('/').map(encodeURIComponent).join('/')
  const url = `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    })

    if (res.ok || res.status === 404) return true

    const body = await res.text().catch(() => '')
    console.error(
      `[storage] failed to delete ${bucket}/${key}: ${res.status} ${body.slice(0, 200)} ` +
      `— object is now orphaned and still counts against the storage quota`,
    )
    return false
  } catch (err) {
    console.error(
      `[storage] error deleting ${bucket}/${key}:`, err,
      '— object is now orphaned and still counts against the storage quota',
    )
    return false
  }
}
