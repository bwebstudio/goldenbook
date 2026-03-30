import { db } from '../../../db/postgres'

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

/** Permanently delete a place_image and its media_asset */
export async function deleteImage(placeId: string, imageId: string): Promise<{ bucket: string; path: string } | null> {
  // Get the asset info first so caller can delete from storage
  const { rows } = await db.query<{ asset_id: string; bucket: string; path: string }>(`
    SELECT pi.asset_id, ma.bucket, ma.path
    FROM place_images pi
    JOIN media_assets ma ON ma.id = pi.asset_id
    WHERE pi.id = $1 AND pi.place_id = $2
  `, [imageId, placeId])
  if (rows.length === 0) return null

  const { asset_id, bucket, path } = rows[0]

  // Delete place_image, then media_asset (cascade would handle it but be explicit)
  await db.query('DELETE FROM place_images WHERE id = $1 AND place_id = $2', [imageId, placeId])
  await db.query('DELETE FROM media_assets WHERE id = $1', [asset_id])

  return { bucket, path }
}

/** Create a media_asset and link it to a place as a gallery image */
export async function addImageToPlace(placeId: string, data: {
  bucket: string; path: string; mimeType: string | null;
  width: number | null; height: number | null; sizeBytes: number | null;
}): Promise<PlaceImageRow> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Create media_asset
    const { rows: [asset] } = await client.query<{ id: string }>(`
      INSERT INTO media_assets (bucket, path, mime_type, width, height, size_bytes)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (bucket, path) DO UPDATE SET mime_type = EXCLUDED.mime_type
      RETURNING id
    `, [data.bucket, data.path, data.mimeType, data.width, data.height, data.sizeBytes])

    // Get next sort_order
    const { rows: [{ max_order }] } = await client.query<{ max_order: number }>(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS max_order
      FROM place_images WHERE place_id = $1 AND image_role = 'gallery'
    `, [placeId])

    // Create place_image
    const { rows: [img] } = await client.query<PlaceImageRow>(`
      INSERT INTO place_images (place_id, asset_id, image_role, sort_order)
      VALUES ($1, $2, 'gallery', $3)
      RETURNING id, asset_id, image_role, sort_order, is_primary, caption,
                $4::text AS bucket, $5::text AS path, $6::int AS width, $7::int AS height
    `, [placeId, asset.id, max_order, data.bucket, data.path, data.width, data.height])

    await client.query('COMMIT')
    return img
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
