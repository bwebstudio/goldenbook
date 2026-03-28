// Supabase Storage URL builder.
//
// The backend returns images as { bucket, path } pairs.
// The database stores `path` as "{bucket}/{object-key}" — i.e. the bucket name
// is already the first segment of the path.  Naively combining them produces:
//
//   …/public/{bucket}/{bucket}/{object-key}   ← WRONG (400 from Supabase)
//
// We strip the bucket prefix from path before building the URL so the result is:
//
//   {STORAGE_BASE_URL}/storage/v1/object/public/{bucket}/{object-key}   ← correct
//
// Set NEXT_PUBLIC_STORAGE_BASE_URL in .env.local to your Supabase project URL,
// e.g. https://ltdhyshuhkvicsvtssjm.supabase.co

const STORAGE_BASE_URL = process.env.NEXT_PUBLIC_STORAGE_BASE_URL ?? "";

export function getStorageUrl(
  bucket: string | null | undefined,
  path: string | null | undefined
): string | null {
  if (!bucket || !path || !STORAGE_BASE_URL) return null;

  // Strip the leading "{bucket}/" segment if the DB path already includes it.
  const prefix = `${bucket}/`;
  const objectKey = path.startsWith(prefix) ? path.slice(prefix.length) : path;

  return `${STORAGE_BASE_URL}/storage/v1/object/public/${bucket}/${objectKey}`;
}
