// ─── Storage object key normalisation ───────────────────────────────────────
//
// `media_assets.path` is stored in two forms: the bare object key
// (`lisboa/foo.jpg`) and, for legacy rows, the key with the bucket prepended
// (`place-images/lisboa/foo.jpg`). Storage object names never carry the
// bucket, so every caller that turns a row into a Storage URL must strip it.
// Kept free of `env` so it stays a pure, testable function.

/**
 * Return the object key inside `bucket` for a raw `media_assets.path`:
 * no leading slashes, no leading `<bucket>/`, no double slashes.
 *
 *   ("place-images", "place-images/lisboa/a.jpg") => "lisboa/a.jpg"
 *   ("place-images", "lisboa/a.jpg")              => "lisboa/a.jpg"
 *   ("media",        "/media/photo.jpg")          => "photo.jpg"
 */
export function toStorageObjectKey(bucket: string, rawPath: string): string {
  // 1. Trim surrounding whitespace and leading slashes
  let p = rawPath.trim().replace(/^\/+/, '')

  // 2. If path starts with "<bucket>/", strip that prefix
  const prefix = `${bucket}/`
  if (p.startsWith(prefix)) {
    p = p.slice(prefix.length)
  }

  // 3. Collapse any remaining double slashes
  return p.replace(/\/\/+/g, '/')
}
