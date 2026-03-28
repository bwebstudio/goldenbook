const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/**
 * Builds a public Supabase Storage URL from a MediaAsset { bucket, path }.
 * The migrated data stores path WITH the bucket prefix (e.g. "establishments/foo.jpg"),
 * so we strip it to avoid duplication in the final URL.
 */
export function getStorageUrl(bucket: string | null, path: string | null): string | null {
  if (!bucket || !path) return null;
  const cleanPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}
