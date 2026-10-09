import { env } from '../config/env'
import { toStorageObjectKey } from '../lib/storage/storage-path'

export interface MediaAsset {
  bucket: string | null
  path: string | null
}

// Strips a leading '<bucket>/' (legacy rows) and stray slashes; see
// lib/storage/storage-path.ts.
const normalisePath = toStorageObjectKey

/**
 * Resolve a Supabase storage media asset to a public URL.
 *
 * Uses STORAGE_BASE_URL if set (allows custom CDN), otherwise falls back to
 * SUPABASE_URL. Returns null when bucket or path are missing/empty so callers
 * can degrade gracefully without crashing.
 *
 * Final URL shape:
 *   {base}/storage/v1/object/public/{bucket}/{normalisedPath}
 */
export function resolveImageUrl(asset: MediaAsset): string | null {
  const { bucket, path: rawPath } = asset

  if (!bucket || !bucket.trim()) return null
  if (!rawPath || !rawPath.trim()) return null

  const base = (env.STORAGE_BASE_URL ?? env.SUPABASE_URL).replace(/\/$/, '')
  const normPath = normalisePath(bucket.trim(), rawPath)

  if (!normPath) return null

  return `${base}/storage/v1/object/public/${bucket}/${normPath}`
}
