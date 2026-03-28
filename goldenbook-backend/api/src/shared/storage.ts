import { env } from '../config/env'

export interface MediaAsset {
  bucket: string | null
  path: string | null
}

/**
 * Normalise a raw storage path so it never duplicates the bucket segment.
 *
 * Some rows in media_assets store the path with the bucket prepended:
 *   bucket = "establishments", path = "establishments/fashion-clinic/main.jpg"
 * Others store it without:
 *   bucket = "locations",      path = "lisboa.jpg"
 *
 * This function always returns the path segment that belongs AFTER the bucket
 * in the public URL, with no leading slash and no double slashes.
 *
 * Examples (all return the value shown after "=>"):
 *   ("locations",      "locations/lisboa.jpg")             => "lisboa.jpg"
 *   ("establishments", "establishments/clinic/main.jpg")   => "clinic/main.jpg"
 *   ("establishments", "fashion-clinic/main.jpg")          => "fashion-clinic/main.jpg"
 *   ("media",          "/media/photo.jpg")                 => "photo.jpg"
 *   ("media",          "photo.jpg")                        => "photo.jpg"
 */
function normalisePath(bucket: string, rawPath: string): string {
  // 1. Trim surrounding whitespace and leading slashes
  let p = rawPath.trim().replace(/^\/+/, '')

  // 2. If path starts with "<bucket>/", strip that prefix
  const prefix = `${bucket}/`
  if (p.startsWith(prefix)) {
    p = p.slice(prefix.length)
  }

  // 3. Collapse any remaining double slashes
  p = p.replace(/\/\/+/g, '/')

  return p
}

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
