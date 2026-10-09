// ─── Business portal image changes: database side ───────────────────────────
//
// Every image change a business client makes is stored as a pending
// `place_change_requests` row (the same table and review queue as name and
// description edits):
//
//   new_image      new_value = media_assets.id of the uploaded file.
//                  The asset exists, the place_images link does not, so the
//                  image is invisible until approved.
//   image_removal  old_value = place_images.id to remove on approval.
//
// Approve/reject are called from the review-queue endpoints.

import type { PoolClient } from 'pg'
import { db } from '../../db/postgres'
import { AppError } from '../../shared/errors/AppError'
import {
  addImageToPlace,
  deleteImage,
  getPlaceImages,
  setCoverImage,
  type PlaceImageRow,
} from '../admin/places/admin-images.query'
import {
  IMAGE_ADD_FIELD,
  IMAGE_CHANGE_FIELDS,
  IMAGE_REMOVE_FIELD,
  VISIBLE_IMAGE_ROLES,
  canCancelImageRequest,
  canRequestImageRemoval,
  isUuid,
  portalImageSlotsLeft,
} from './business-images.policy'

type Queryable = Pick<PoolClient, 'query'>

export interface StorageLocation { bucket: string; path: string }

export interface PendingImageChange {
  id: string
  kind: 'add' | 'remove'
  /** place_images.id for removals, null for additions. */
  image_id: string | null
  bucket: string | null
  path: string | null
  width: number | null
  height: number | null
  created_at: string
}

export interface PortalImageState {
  items: PlaceImageRow[]
  pending: PendingImageChange[]
  slotsLeft: number
}

async function countSlots(
  q: Queryable,
  placeId: string,
): Promise<{ visible: number; pendingAdds: number }> {
  const { rows: [r] } = await q.query<{ visible: string; pending_adds: string }>(`
    SELECT
      (SELECT COUNT(*) FROM place_images
        WHERE place_id = $1 AND image_role = ANY($2::text[]))::text AS visible,
      (SELECT COUNT(*) FROM place_change_requests
        WHERE place_id = $1 AND field_name = $3 AND status = 'pending')::text AS pending_adds
  `, [placeId, VISIBLE_IMAGE_ROLES, IMAGE_ADD_FIELD])
  return { visible: Number(r.visible), pendingAdds: Number(r.pending_adds) }
}

export async function getPortalImageSlotsLeft(placeId: string): Promise<number> {
  const { visible, pendingAdds } = await countSlots(db, placeId)
  return portalImageSlotsLeft(visible, pendingAdds)
}

export async function getPortalImageState(placeId: string): Promise<PortalImageState> {
  const [items, pendingRes, slotsLeft] = await Promise.all([
    getPlaceImages(placeId),
    db.query<{
      id: string; field_name: string; old_value: string | null; created_at: string
      bucket: string | null; path: string | null; width: number | null; height: number | null
    }>(`
      SELECT cr.id, cr.field_name, cr.old_value, cr.created_at,
             ma.bucket, ma.path, ma.width, ma.height
      FROM place_change_requests cr
      LEFT JOIN place_images pi
             ON cr.field_name = $3 AND pi.id::text = cr.old_value
      LEFT JOIN media_assets ma
             ON ma.id::text = CASE WHEN cr.field_name = $2 THEN cr.new_value ELSE pi.asset_id::text END
      WHERE cr.place_id = $1 AND cr.status = 'pending' AND cr.field_name = ANY($4::text[])
      ORDER BY cr.created_at ASC
    `, [placeId, IMAGE_ADD_FIELD, IMAGE_REMOVE_FIELD, IMAGE_CHANGE_FIELDS]),
    getPortalImageSlotsLeft(placeId),
  ])

  return {
    items,
    pending: pendingRes.rows.map((r) => ({
      id: r.id,
      kind: r.field_name === IMAGE_ADD_FIELD ? 'add' : 'remove',
      image_id: r.field_name === IMAGE_REMOVE_FIELD ? r.old_value : null,
      bucket: r.bucket,
      path: r.path,
      width: r.width,
      height: r.height,
      created_at: r.created_at,
    })),
    slotsLeft,
  }
}

/**
 * Record an uploaded object as a pending `new_image` request. The slot check
 * is repeated here under a row lock on the place, so two concurrent uploads
 * cannot both take the last slot. Throws AppError(409) when full; the caller
 * must then delete the object it uploaded.
 */
export async function createPendingImage(args: {
  placeId: string
  userId: string
  bucket: string
  path: string
  mimeType: string
  width: number | null
  height: number | null
  sizeBytes: number
}): Promise<{ requestId: string; assetId: string }> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT id FROM places WHERE id = $1 FOR UPDATE', [args.placeId])

    const { visible, pendingAdds } = await countSlots(client, args.placeId)
    if (portalImageSlotsLeft(visible, pendingAdds) <= 0) {
      throw new AppError(409, 'Image limit reached for this listing', 'IMAGE_LIMIT_REACHED')
    }

    const { rows: [asset] } = await client.query<{ id: string }>(`
      INSERT INTO media_assets (bucket, path, mime_type, width, height, size_bytes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [args.bucket, args.path, args.mimeType, args.width, args.height, args.sizeBytes])

    const { rows: [req] } = await client.query<{ id: string }>(`
      INSERT INTO place_change_requests (place_id, field_name, old_value, new_value, created_by)
      VALUES ($1, $2, NULL, $3, $4)
      RETURNING id
    `, [args.placeId, IMAGE_ADD_FIELD, asset.id, args.userId])

    await client.query('COMMIT')
    return { requestId: req.id, assetId: asset.id }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Ask an editor to remove one of the place's visible images. Idempotent. */
export async function requestImageRemoval(placeId: string, userId: string, imageId: string): Promise<{ requestId: string }> {
  if (!isUuid(imageId)) throw new AppError(404, 'Image not found', 'NOT_FOUND')

  const { rows: [img] } = await db.query<{ place_id: string; image_role: string }>(
    'SELECT place_id, image_role FROM place_images WHERE id = $1',
    [imageId],
  )
  // Images of other places are reported as missing, not forbidden.
  if (!canRequestImageRemoval(img, placeId)) throw new AppError(404, 'Image not found', 'NOT_FOUND')

  const { rows: [existing] } = await db.query<{ id: string }>(`
    SELECT id FROM place_change_requests
    WHERE place_id = $1 AND field_name = $2 AND old_value = $3 AND status = 'pending'
    LIMIT 1
  `, [placeId, IMAGE_REMOVE_FIELD, imageId])
  if (existing) return { requestId: existing.id }

  const { rows: [req] } = await db.query<{ id: string }>(`
    INSERT INTO place_change_requests (place_id, field_name, old_value, new_value, created_by)
    VALUES ($1, $2, $3, NULL, $4)
    RETURNING id
  `, [placeId, IMAGE_REMOVE_FIELD, imageId, userId])
  return { requestId: req.id }
}

/** Delete a media_asset that no place_image points at. Returns its location. */
async function dropUnlinkedAsset(
  q: Queryable,
  assetId: string | null,
): Promise<StorageLocation | null> {
  if (!isUuid(assetId)) return null
  const { rows } = await q.query<StorageLocation>(`
    DELETE FROM media_assets ma
    WHERE ma.id = $1
      AND NOT EXISTS (SELECT 1 FROM place_images pi WHERE pi.asset_id = ma.id)
    RETURNING ma.bucket, ma.path
  `, [assetId])
  return rows[0] ?? null
}

/**
 * Client withdraws one of their own pending image requests. For an upload,
 * the asset row is removed and its location returned so the caller can
 * delete the object from Storage.
 */
export async function cancelImageRequest(placeId: string, requestId: string): Promise<StorageLocation | null> {
  if (!isUuid(requestId)) throw new AppError(404, 'Request not found', 'NOT_FOUND')

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows: [req] } = await client.query<{
      place_id: string; field_name: string; status: string; new_value: string | null
    }>(
      'SELECT place_id, field_name, status, new_value FROM place_change_requests WHERE id = $1 FOR UPDATE',
      [requestId],
    )
    const decision = canCancelImageRequest(req, placeId)
    if (decision === 'not_found') throw new AppError(404, 'Request not found', 'NOT_FOUND')
    if (decision === 'not_pending') throw new AppError(409, 'Request already reviewed', 'ALREADY_REVIEWED')

    await client.query('DELETE FROM place_change_requests WHERE id = $1', [requestId])
    const location = req.field_name === IMAGE_ADD_FIELD ? await dropUnlinkedAsset(client, req.new_value) : null

    await client.query('COMMIT')
    return location
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export interface ReviewedImageChange {
  placeId: string
  fieldName: string
  createdBy: string | null
  /** Object to delete from Storage after the database work committed. */
  storageToDelete: StorageLocation | null
}

/**
 * Atomically move a pending image request to approved/rejected. Returns null
 * when the request does not exist, is not an image request, or was already
 * reviewed (double click, two editors).
 */
async function claimImageRequest(
  requestId: string,
  status: 'approved' | 'rejected',
  reviewer: string,
  note: string | null,
): Promise<{ place_id: string; field_name: string; old_value: string | null; new_value: string | null; created_by: string | null } | null> {
  const { rows } = await db.query<{
    place_id: string; field_name: string; old_value: string | null; new_value: string | null; created_by: string | null
  }>(`
    UPDATE place_change_requests
       SET status = $2, reviewed_by = $3, review_note = $4, reviewed_at = now()
     WHERE id = $1 AND status = 'pending' AND field_name = ANY($5::text[])
     RETURNING place_id, field_name, old_value, new_value, created_by
  `, [requestId, status, reviewer, note, IMAGE_CHANGE_FIELDS])
  return rows[0] ?? null
}

async function revertToPending(requestId: string): Promise<void> {
  await db.query(`
    UPDATE place_change_requests
       SET status = 'pending', reviewed_by = NULL, review_note = NULL, reviewed_at = NULL
     WHERE id = $1
  `, [requestId])
}

export async function approveImageChange(requestId: string, reviewer: string, note: string | null): Promise<ReviewedImageChange> {
  const req = await claimImageRequest(requestId, 'approved', reviewer, note)
  if (!req) throw new AppError(400, 'Request already reviewed', 'ALREADY_REVIEWED')

  try {
    if (req.field_name === IMAGE_ADD_FIELD) {
      const { rows: [asset] } = await db.query<{
        bucket: string; path: string; mime_type: string | null
        width: number | null; height: number | null; size_bytes: number | null
      }>(
        'SELECT bucket, path, mime_type, width, height, size_bytes FROM media_assets WHERE id::text = $1',
        [req.new_value],
      )
      if (!asset) throw new AppError(410, 'The uploaded image no longer exists', 'ASSET_MISSING')
      // Same insert the editor uses: links the asset (ON CONFLICT reuses the
      // row we created at upload) and makes it the cover if there is none.
      await addImageToPlace(req.place_id, {
        bucket: asset.bucket,
        path: asset.path,
        mimeType: asset.mime_type,
        width: asset.width,
        height: asset.height,
        sizeBytes: asset.size_bytes,
      })
      return { placeId: req.place_id, fieldName: req.field_name, createdBy: req.created_by, storageToDelete: null }
    }

    // image_removal
    const removed = isUuid(req.old_value) ? await deleteImage(req.place_id, req.old_value) : null
    // Removing the cover would leave the listing without one; promote the
    // first remaining gallery image, as the upload path does for new places.
    const { rows: [next] } = await db.query<{ id: string; has_cover: boolean }>(`
      SELECT
        (SELECT id FROM place_images WHERE place_id = $1 AND image_role = 'gallery'
          ORDER BY sort_order ASC LIMIT 1) AS id,
        EXISTS(SELECT 1 FROM place_images WHERE place_id = $1 AND image_role IN ('hero','cover')) AS has_cover
    `, [req.place_id])
    if (next && !next.has_cover && next.id) await setCoverImage(req.place_id, next.id)

    return { placeId: req.place_id, fieldName: req.field_name, createdBy: req.created_by, storageToDelete: removed }
  } catch (err) {
    await revertToPending(requestId).catch(() => {})
    if (err instanceof Error && err.message.includes('Maximum is')) {
      throw new AppError(400, err.message, 'IMAGE_LIMIT_REACHED')
    }
    throw err
  }
}

export async function rejectImageChange(requestId: string, reviewer: string, note: string | null): Promise<ReviewedImageChange> {
  const req = await claimImageRequest(requestId, 'rejected', reviewer, note)
  if (!req) throw new AppError(400, 'Request already reviewed', 'ALREADY_REVIEWED')

  const storageToDelete = req.field_name === IMAGE_ADD_FIELD ? await dropUnlinkedAsset(db, req.new_value) : null
  return { placeId: req.place_id, fieldName: req.field_name, createdBy: req.created_by, storageToDelete }
}

/** Is this change request one of the image kinds? Used by the review queue to branch. */
export async function getChangeRequestField(requestId: string): Promise<string | null> {
  const { rows } = await db.query<{ field_name: string }>(
    'SELECT field_name FROM place_change_requests WHERE id = $1',
    [requestId],
  )
  return rows[0]?.field_name ?? null
}
