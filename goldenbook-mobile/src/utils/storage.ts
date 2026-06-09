const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// ─── Image variants ──────────────────────────────────────────────────────────
//
// Variant presets for the Supabase Image Transformation API. Every variant
// keeps editorial-grade quality (q ≥ 70) — we only shrink to the actual
// display size of the surface that consumes the image, not below.
//
// Why this exists: Supabase serves objects at /object/public/ with
// `Cache-Control: no-cache`, so the CDN re-fetches the original on every
// request — that was the root cause of the Cached Egress overage. URLs
// generated under /render/image/public/ come back with
// `Cache-Control: max-age=31536000` (1 year), making them a CDN-friendly
// derivative that pays a download cost once per (path × variant) and is
// free from then on.
//
// Sizes were chosen against the actual visual width of each surface
// (multiplied by ~1.5–2× to cover retina scaling). Quality steps mirror
// the gradient the rest of the editorial industry uses (NYT / Conde Nast).

export type ImageVariant = 'thumb' | 'card' | 'detail' | 'hero';

const VARIANT_PRESETS: Record<ImageVariant, { width: number; quality: number }> = {
  thumb:  { width: 160,  quality: 70 }, // search rows, tiny avatars
  card:   { width: 480,  quality: 75 }, // discover cards, list items
  detail: { width: 900,  quality: 80 }, // gallery on place detail
  hero:   { width: 1400, quality: 82 }, // full-bleed heroes / NOW
};

/**
 * Builds a Supabase Storage URL from a MediaAsset { bucket, path }.
 *
 * Backward-compatible:
 *   - Called as `getStorageUrl(bucket, path)`            → returns the
 *     untransformed /object/public/ URL exactly like before.
 *   - Called as `getStorageUrl(bucket, path, variant)`   → returns the
 *     transformed /render/image/public/ URL with the variant preset
 *     applied. CDN-cacheable for 1 year.
 *
 * The DB stores `path` as "{bucket}/{object-key}" (legacy), so we strip
 * the bucket prefix when present to avoid producing duplicate segments.
 */
export function getStorageUrl(
  bucket: string | null | undefined,
  path: string | null | undefined,
  variant?: ImageVariant,
): string | null {
  if (!bucket || !path || !SUPABASE_URL) return null;

  const cleanPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;

  // No variant → original URL, identical to the previous behaviour. Any
  // call site that hasn't been migrated keeps working unchanged.
  if (!variant) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }

  const preset = VARIANT_PRESETS[variant];
  const qs = `width=${preset.width}&quality=${preset.quality}&resize=cover`;
  return `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${cleanPath}?${qs}`;
}
