/**
 * Resolve a Supabase storage bucket/path pair to a public URL.
 * Ported from goldenbook-backend/api/src/shared/storage.ts
 */

interface MediaAsset {
  bucket: string | null
  path: string | null
}

function normalisePath(bucket: string, rawPath: string): string {
  let p = rawPath.trim().replace(/^\/+/, '')

  const prefix = `${bucket}/`
  if (p.startsWith(prefix)) {
    p = p.slice(prefix.length)
  }

  p = p.replace(/\/\/+/g, '/')
  return p
}

export function resolveImageUrl(asset: MediaAsset): string | null {
  const { bucket, path: rawPath } = asset

  if (!bucket || !bucket.trim()) return null
  if (!rawPath || !rawPath.trim()) return null

  const base = (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_STORAGE_URL ??
    ''
  ).replace(/\/$/, '')

  if (!base) return null

  const normPath = normalisePath(bucket.trim(), rawPath)
  if (!normPath) return null

  return `${base}/storage/v1/object/public/${bucket}/${normPath}`
}
