// Supabase Storage URL builder for the dashboard.
//
// The backend returns images as { bucket, path } pairs. The DB stores
// `path` as "{bucket}/{object-key}" (legacy), so the bucket name is already
// the first segment of the path. Naively combining them would produce
// `…/public/{bucket}/{bucket}/{object-key}` (400 from Supabase) — we strip
// the duplicated prefix before building the URL.
//
// Set NEXT_PUBLIC_STORAGE_BASE_URL in .env.local to your Supabase project
// URL, e.g. https://ltdhyshuhkvicsvtssjm.supabase.co
//
// ─── Image variants ──────────────────────────────────────────────────────
//
// Variant presets for the Supabase Image Transformation API. The originals
// at /object/public/ ship with `Cache-Control: no-cache`, so the CDN
// re-fetches them on every request — that was the root cause of the
// Cached Egress overage. URLs under /render/image/public/ come back with
// `Cache-Control: max-age=31536000` (1 year) and are CDN-cacheable.
//
// Sizes target the actual visual width × 1.5–2× for retina screens.
// Quality kept ≥ 70 to preserve premium editorial look (NYT / Conde Nast
// use a similar gradient).

const STORAGE_BASE_URL = process.env.NEXT_PUBLIC_STORAGE_BASE_URL ?? "";

export type ImageVariant = "thumb" | "card" | "detail" | "hero";

const VARIANT_PRESETS: Record<ImageVariant, { width: number; quality: number }> = {
  thumb:  { width: 160,  quality: 70 }, // small avatars, stop rows
  card:   { width: 480,  quality: 75 }, // list rows, place cards
  detail: { width: 900,  quality: 80 }, // gallery items, editor cover
  hero:   { width: 1400, quality: 82 }, // full-bleed heroes
};

/**
 * Builds a Supabase Storage URL from a { bucket, path } pair.
 *
 * Backward-compatible:
 *   - getStorageUrl(bucket, path)           → original URL (no transform).
 *   - getStorageUrl(bucket, path, variant)  → transformed + CDN-cacheable
 *     for 1 year. Use the variant whose width is closest to the actual
 *     rendered width × pixel-density.
 */
export function getStorageUrl(
  bucket: string | null | undefined,
  path: string | null | undefined,
  variant?: ImageVariant,
): string | null {
  if (!bucket || !path || !STORAGE_BASE_URL) return null;

  const prefix = `${bucket}/`;
  const objectKey = path.startsWith(prefix) ? path.slice(prefix.length) : path;

  if (!variant) {
    return `${STORAGE_BASE_URL}/storage/v1/object/public/${bucket}/${objectKey}`;
  }

  const preset = VARIANT_PRESETS[variant];
  const qs = `width=${preset.width}&quality=${preset.quality}&resize=cover`;
  return `${STORAGE_BASE_URL}/storage/v1/render/image/public/${bucket}/${objectKey}?${qs}`;
}
