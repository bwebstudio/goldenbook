// ─── Business portal image rules ────────────────────────────────────────────
//
// Pure functions only (no db, no env) so the ownership and validation rules
// can be unit-tested without a database.
//
// Business clients never touch the place-images bucket or the admin image
// endpoints directly. They send the bytes to the API, which uploads them with
// the service role and records the change as a `place_change_requests` row,
// exactly like name and description edits. Nothing reaches `place_images`
// (and therefore the app) until an editor approves it in the review queue.

export const PORTAL_IMAGE_BUCKET = 'place-images'

/** Same cap the bucket enforces (file_size_limit = 10 MB). */
export const PORTAL_IMAGE_MAX_BYTES = 10 * 1024 * 1024

/** Base plan: cover + gallery images a business client can have. */
export const PORTAL_IMAGE_SLOTS = 4

/** Same list the bucket accepts (allowed_mime_types). */
export const PORTAL_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type PortalImageMime = (typeof PORTAL_IMAGE_MIME_TYPES)[number]

/** `place_change_requests.field_name` values used for image changes. */
export const IMAGE_ADD_FIELD = 'new_image'
export const IMAGE_REMOVE_FIELD = 'image_removal'
export const IMAGE_CHANGE_FIELDS = [IMAGE_ADD_FIELD, IMAGE_REMOVE_FIELD] as const

/** Image roles that are visible in the app and in the portal gallery. */
export const VISIBLE_IMAGE_ROLES = ['hero', 'cover', 'gallery'] as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isImageChangeField(fieldName: string): boolean {
  return (IMAGE_CHANGE_FIELDS as readonly string[]).includes(fieldName)
}

/**
 * Identify the real format from the file's magic bytes. The Content-Type
 * header is whatever the browser claimed; a HEIC or TIFF renamed to .jpg
 * would otherwise be stored and then render as a broken image everywhere.
 */
export function sniffImageMime(buf: Uint8Array): PortalImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png'
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50   // WEBP
  ) return 'image/webp'
  return null
}

const EXT_BY_MIME: Record<PortalImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Object key inside the bucket. Bare key, never `<bucket>/...`:
 * storage.objects.name has no bucket prefix and new media_assets rows should
 * match it (the prefixed form only survives in legacy rows).
 */
export function buildPortalImageKey(placeId: string, mime: PortalImageMime, now: number, rand: string): string {
  const safeRand = rand.replace(/[^a-z0-9]/gi, '').slice(0, 12) || '0'
  return `places/${placeId}/${now}-${safeRand}.${EXT_BY_MIME[mime]}`
}

/**
 * How many more images the client can submit. Pending uploads already hold a
 * slot so a client cannot queue 20 images while 4 are live; pending removals
 * do not free one until an editor approves them.
 */
export function portalImageSlotsLeft(visibleCount: number, pendingAdds: number): number {
  return Math.max(0, PORTAL_IMAGE_SLOTS - visibleCount - pendingAdds)
}

/** Does this business client hold a link to the place? */
export function clientOwnsPlace(linkedPlaceIds: readonly string[], placeId: string | null | undefined): boolean {
  return !!placeId && linkedPlaceIds.includes(placeId)
}

export interface ImageChangeRequestRef {
  place_id: string
  field_name: string
  status: string
}

export type CancelDecision = 'ok' | 'not_found' | 'not_pending'

/**
 * Can the client withdraw this change request? Requests on places the client
 * is not linked to are reported as not found, so ids from other businesses
 * cannot be probed.
 */
export function canCancelImageRequest(
  req: ImageChangeRequestRef | null | undefined,
  activePlaceId: string,
): CancelDecision {
  if (!req || req.place_id !== activePlaceId || !isImageChangeField(req.field_name)) return 'not_found'
  if (req.status !== 'pending') return 'not_pending'
  return 'ok'
}

export interface PlaceImageRef {
  place_id: string
  image_role: string
}

/** Only visible images of the client's active place can be put up for removal. */
export function canRequestImageRemoval(img: PlaceImageRef | null | undefined, activePlaceId: string): boolean {
  return !!img && img.place_id === activePlaceId &&
    (VISIBLE_IMAGE_ROLES as readonly string[]).includes(img.image_role)
}
