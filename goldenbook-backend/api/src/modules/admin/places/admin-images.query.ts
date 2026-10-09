import { db } from '../../../db/postgres'
import { toStorageObjectKey } from '../../../lib/storage/storage-path'

export interface PlaceImageRow {
  id: string
  asset_id: string
  image_role: string
  sort_order: number
  is_primary: boolean
  caption: string | null
  bucket: string
  path: string
  width: number | null
  height: number | null
}

export async function getPlaceImages(placeId: string): Promise<PlaceImageRow[]> {
  const { rows } = await db.query<PlaceImageRow>(`
    SELECT pi.id, pi.asset_id, pi.image_role, pi.sort_order, pi.is_primary, pi.caption,
           ma.bucket, ma.path, ma.width, ma.height
    FROM place_images pi
    JOIN media_assets ma ON ma.id = pi.asset_id
    WHERE pi.place_id = $1
    ORDER BY
      CASE pi.image_role WHEN 'hero' THEN 0 WHEN 'cover' THEN 1 WHEN 'gallery' THEN 2 ELSE 3 END,
      pi.is_primary DESC, pi.sort_order ASC
  `, [placeId])
  return rows
}

export async function setCoverImage(placeId: string, imageId: string): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    // Remove hero/cover role from all images of this place
    await client.query(`
      UPDATE place_images SET image_role = 'gallery', is_primary = false
      WHERE place_id = $1 AND image_role IN ('hero', 'cover')
    `, [placeId])
    // Set the chosen image as cover + primary
    await client.query(`
      UPDATE place_images SET image_role = 'cover', is_primary = true
      WHERE id = $1 AND place_id = $2
    `, [imageId, placeId])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function setGalleryOrder(placeId: string, imageIds: string[]): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < imageIds.length; i++) {
      await client.query(`
        UPDATE place_images SET sort_order = $1
        WHERE id = $2 AND place_id = $3 AND image_role = 'gallery'
      `, [i, imageIds[i], placeId])
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function moveImageToGallery(placeId: string, imageId: string): Promise<void> {
  await db.query(`
    UPDATE place_images SET image_role = 'gallery', is_primary = false
    WHERE id = $1 AND place_id = $2
  `, [imageId, placeId])
}

export async function removeImageFromGallery(placeId: string, imageId: string): Promise<void> {
  // Don't delete the media_asset — just unlink from gallery by setting a non-visible role
  await db.query(`
    UPDATE place_images SET image_role = 'thumbnail'
    WHERE id = $1 AND place_id = $2 AND image_role = 'gallery'
  `, [imageId, placeId])
}

export interface StorageObjectRef {
  bucket: string
  path: string
}

type Queryable = { query: typeof db.query }

/**
 * Pure: of the storage objects whose media_assets rows were just deleted,
 * keep only those whose normalised key no surviving row still points at.
 *
 * The same object can be registered twice, once as `lisboa/a.jpg` and once
 * with the legacy `<bucket>/` prefix, so keys are compared after
 * `toStorageObjectKey`. `stillUsed` holds the normalised keys of the rows
 * that survived the delete.
 */
export function selectObjectsSafeToRemove(
  removed: readonly StorageObjectRef[],
  stillUsed: ReadonlyArray<{ bucket: string; key: string }>,
): StorageObjectRef[] {
  const used = new Set(stillUsed.map((u) => `${u.bucket}\u0000${toStorageObjectKey(u.bucket, u.key)}`))
  const seen = new Set<string>()
  const out: StorageObjectRef[] = []
  for (const r of removed) {
    const id = `${r.bucket}\u0000${toStorageObjectKey(r.bucket, r.path)}`
    if (used.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(r)
  }
  return out
}

/**
 * Delete the given media_assets rows that nothing references any more and
 * return the storage objects that are now safe to remove from the bucket.
 *
 * "Referenced" is the full set of foreign keys into media_assets: another
 * place's (or this place's other) place_images row, a destination hero, a
 * route cover or a user avatar. Must run inside the caller's transaction, after
 * the caller has removed its own reference, so the NOT EXISTS checks see the
 * post-delete state. Shared by `deleteImage` and `deletePlace`.
 */
export async function deleteAssetsIfUnreferenced(
  client: Queryable,
  assetIds: readonly string[],
): Promise<StorageObjectRef[]> {
  if (assetIds.length === 0) return []

  const { rows: removed } = await client.query<StorageObjectRef>(
    `
    DELETE FROM media_assets m
    WHERE m.id = ANY($1::uuid[])
      AND NOT EXISTS (SELECT 1 FROM place_images pi WHERE pi.asset_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM destinations d WHERE d.hero_image_asset_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM routes r       WHERE r.cover_asset_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM users u        WHERE u.avatar_asset_id = m.id)
    RETURNING m.bucket, m.path
    `,
    [[...assetIds]],
  )
  if (removed.length === 0) return []

  // A surviving media_assets row may still point at the same object under
  // the other path spelling. Look those up (both spellings of every removed
  // key) and keep their bytes.
  const buckets = removed.map((r) => r.bucket)
  const keys = removed.map((r) => toStorageObjectKey(r.bucket, r.path))
  const { rows: stillUsed } = await client.query<{ bucket: string; key: string }>(
    `
    SELECT m.bucket, m.path AS key
    FROM media_assets m
    JOIN unnest($1::text[], $2::text[]) AS c(bucket, key) ON c.bucket = m.bucket
    WHERE m.path = c.key OR m.path = c.bucket || '/' || c.key
    `,
    [buckets, keys],
  )
  return selectObjectsSafeToRemove(removed, stillUsed)
}

/**
 * Permanently delete one image from one place.
 *
 * Only this place's place_images row is removed unconditionally. The
 * media_asset (and the storage object behind it) is deleted only when nothing
 * else references it: `addImageToPlace` upserts on (bucket, path), so two
 * places can share one asset, and deleting the asset used to cascade through
 * place_images and silently remove the photo from the *other* place too.
 *
 * Returns null when the image does not belong to this place. Otherwise
 * `storageObject` is the location whose bytes may now be removed from
 * Storage, or null when the asset is still in use elsewhere.
 */
export async function deleteImageFromPlace(
  placeId: string,
  imageId: string,
): Promise<{ storageObject: StorageObjectRef | null; assetDeleted: boolean } | null> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ asset_id: string }>(
      `DELETE FROM place_images WHERE id = $1 AND place_id = $2 RETURNING asset_id`,
      [imageId, placeId],
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }

    const objects = await deleteAssetsIfUnreferenced(client, [rows[0].asset_id])
    const { rows: assetLeft } = await client.query(
      `SELECT 1 FROM media_assets WHERE id = $1`,
      [rows[0].asset_id],
    )

    await client.query('COMMIT')
    return { storageObject: objects[0] ?? null, assetDeleted: assetLeft.length === 0 }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Same as `deleteImageFromPlace`, returning only the storage object the
 * caller should delete (null when there is nothing to remove: unknown image,
 * or an asset another owner still uses). Kept with this shape for the business
 * portal review flow, which deletes whatever location it gets back.
 */
export async function deleteImage(placeId: string, imageId: string): Promise<StorageObjectRef | null> {
  const result = await deleteImageFromPlace(placeId, imageId)
  return result?.storageObject ?? null
}

/** Create a media_asset and link it to a place as a gallery image */
/** Maximum total images per place (hero + gallery). */
const MAX_IMAGES_PER_PLACE = 10

export async function addImageToPlace(placeId: string, data: {
  bucket: string; path: string; mimeType: string | null;
  width: number | null; height: number | null; sizeBytes: number | null;
}): Promise<PlaceImageRow> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Enforce image limit — do not allow new uploads above the cap
    const { rows: [{ count }] } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM place_images WHERE place_id = $1`,
      [placeId],
    )
    if (parseInt(count, 10) >= MAX_IMAGES_PER_PLACE) {
      await client.query('ROLLBACK')
      throw new Error(`This place already has ${count} images. Maximum is ${MAX_IMAGES_PER_PLACE}.`)
    }

    // Create media_asset
    const { rows: [asset] } = await client.query<{ id: string }>(`
      INSERT INTO media_assets (bucket, path, mime_type, width, height, size_bytes)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (bucket, path) DO UPDATE SET mime_type = EXCLUDED.mime_type
      RETURNING id
    `, [data.bucket, data.path, data.mimeType, data.width, data.height, data.sizeBytes])

    // Does this place already have a cover/hero? If not, the first uploaded
    // image becomes the cover automatically. Editors frequently upload photos
    // without explicitly marking one as the cover (the UI lands every upload in
    // the gallery), which left new places with NO cover photo in the app and
    // editor. Auto-promoting the first image guarantees a cover.
    const { rows: [{ has_cover }] } = await client.query<{ has_cover: boolean }>(`
      SELECT EXISTS(
        SELECT 1 FROM place_images
        WHERE place_id = $1 AND image_role IN ('hero', 'cover')
      ) AS has_cover
    `, [placeId])

    const role = has_cover ? 'gallery' : 'cover'
    const isPrimary = !has_cover

    // Get next sort_order (gallery images are ordered; the cover sits at 0)
    const { rows: [{ max_order }] } = await client.query<{ max_order: number }>(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS max_order
      FROM place_images WHERE place_id = $1 AND image_role = 'gallery'
    `, [placeId])
    const sortOrder = role === 'cover' ? 0 : max_order

    // Create place_image
    const { rows: [img] } = await client.query<PlaceImageRow>(`
      INSERT INTO place_images (place_id, asset_id, image_role, sort_order, is_primary)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, asset_id, image_role, sort_order, is_primary, caption,
                $6::text AS bucket, $7::text AS path, $8::int AS width, $9::int AS height
    `, [placeId, asset.id, role, sortOrder, isPrimary, data.bucket, data.path, data.width, data.height])

    await client.query('COMMIT')
    return img
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
