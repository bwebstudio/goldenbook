// ─── Supabase Storage object upload (server side) ───────────────────────────
//
// Companion to supabase-storage.ts. Used where the API, not the browser,
// owns the upload: the business portal sends image bytes to the API so that
// the object and its database rows are created in the same request, and the
// object can be removed again if the database write fails.
//
// Plain `fetch` against the Storage REST API with the service-role key, for
// the same reason as deleteStorageObject: no extra dependency.

import { env } from '../../config/env'
import { toStorageObjectKey } from './storage-path'

export class StorageUploadError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'StorageUploadError'
  }
}

/**
 * Upload `body` to `bucket` at `key`. Never overwrites (x-upsert: false), so a
 * key collision fails instead of replacing someone else's image.
 * Throws StorageUploadError on any non-2xx response.
 */
export async function uploadStorageObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const objectKey = toStorageObjectKey(bucket, key)
  if (!objectKey) throw new StorageUploadError(400, 'Empty storage key')

  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const encodedPath = objectKey.split('/').map(encodeURIComponent).join('/')
  const url = `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': contentType,
      'x-upsert': 'false',
      'cache-control': 'max-age=31536000',
    },
    body: new Uint8Array(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new StorageUploadError(res.status, `Storage upload failed for ${bucket}/${objectKey}: ${res.status} ${text.slice(0, 200)}`)
  }
}
