// ─── Business portal: image endpoints ───────────────────────────────────────
//
// The portal used to upload straight to the place-images bucket from the
// browser and then call POST /admin/places/:id/images, which requires an
// admin_users row. Business clients have none, so the second call returned
// 403 after the object was already stored: the image never appeared and the
// bytes stayed in the bucket as an orphan. Deleting went through the
// equally admin-only DELETE /admin/places/:id/images/:imageId/permanent.
//
// Here the browser sends the (already resized) bytes to the API. In one
// request the API checks the place belongs to the caller, uploads with the
// service role, and records a pending change request. If the database write
// fails the object is deleted again before responding, so a failed upload
// leaves nothing behind. Nothing is shown in the app until an editor
// approves the request in the review queue.
//
// Ownership: every route uses authenticateBusinessClient, which resolves the
// caller's linked places (business_clients + place_users) and only honours an
// X-Place-Id header naming one of them. All queries are scoped to that
// request.businessClient.placeId.

import type { FastifyError, FastifyInstance, FastifyRequest } from 'fastify'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authenticateBusinessClient } from '../../shared/auth/businessAuth'
import { AppError } from '../../shared/errors/AppError'
import { deleteStorageObject } from '../../lib/storage/supabase-storage'
import { uploadStorageObject } from '../../lib/storage/supabase-upload'
import {
  PORTAL_IMAGE_BUCKET,
  PORTAL_IMAGE_MAX_BYTES,
  PORTAL_IMAGE_MIME_TYPES,
  buildPortalImageKey,
  sniffImageMime,
} from './business-images.policy'
import {
  cancelImageRequest,
  createPendingImage,
  getPortalImageSlotsLeft,
  getPortalImageState,
  requestImageRemoval,
} from './business-images.query'

const dimsSchema = z.object({
  width: z.coerce.number().int().positive().max(20000).optional(),
  height: z.coerce.number().int().positive().max(20000).optional(),
})

export async function businessImagesRoutes(app: FastifyInstance) {
  // Raw image bodies, scoped to this plugin only. Anything else (HEIC, TIFF,
  // multipart) is refused by Fastify with 415 before the handler runs.
  app.addContentTypeParser(
    [...PORTAL_IMAGE_MIME_TYPES],
    { parseAs: 'buffer', bodyLimit: PORTAL_IMAGE_MAX_BYTES },
    (_req: FastifyRequest, body: Buffer, done: (err: Error | null, body?: Buffer) => void) => done(null, body),
  )

  // The global handler turns Fastify's own 413/415 into a 500. Give the
  // portal stable codes it can translate, then let the parent format them.
  app.setErrorHandler((error: FastifyError, _request, _reply) => {
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      throw new AppError(413, 'Image is larger than 10 MB', 'IMAGE_TOO_LARGE')
    }
    if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || error.code === 'FST_ERR_CTP_EMPTY_TYPE') {
      throw new AppError(415, 'Only JPEG, PNG or WebP images are accepted', 'UNSUPPORTED_IMAGE_TYPE')
    }
    if (error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY' || error.code === 'FST_ERR_CTP_INVALID_CONTENT_LENGTH') {
      throw new AppError(400, 'Empty image', 'EMPTY_IMAGE')
    }
    throw error
  })

  // ── GET /business/images ────────────────────────────────────────────────
  // Live images of the active place plus the client's pending image changes.
  app.get('/business/images', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    return reply.send(await getPortalImageState(request.businessClient!.placeId))
  })

  // ── POST /business/images ───────────────────────────────────────────────
  // Body: the image bytes, Content-Type image/jpeg | image/png | image/webp.
  // Query: optional width/height (the dashboard knows them after resizing).
  // Result: a pending `new_image` change request.
  app.post('/business/images', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!
    const body = request.body
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new AppError(400, 'Empty image', 'EMPTY_IMAGE')
    }

    // Trust the bytes, not the header.
    const mime = sniffImageMime(body)
    if (!mime) throw new AppError(415, 'Only JPEG, PNG or WebP images are accepted', 'UNSUPPORTED_IMAGE_TYPE')

    const dims = dimsSchema.safeParse(request.query)
    const width = dims.success ? dims.data.width ?? null : null
    const height = dims.success ? dims.data.height ?? null : null

    // Cheap pre-check so a full gallery does not cost an upload. The
    // authoritative check runs again under a lock in createPendingImage.
    if (await getPortalImageSlotsLeft(client.placeId) <= 0) {
      throw new AppError(409, 'Image limit reached for this listing', 'IMAGE_LIMIT_REACHED')
    }

    const key = buildPortalImageKey(client.placeId, mime, Date.now(), randomBytes(6).toString('hex'))

    try {
      await uploadStorageObject(PORTAL_IMAGE_BUCKET, key, body, mime)
    } catch (err) {
      request.log.error({ err, placeId: client.placeId }, '[business-images] storage upload failed')
      throw new AppError(502, 'Image upload failed', 'UPLOAD_FAILED')
    }

    try {
      const { requestId } = await createPendingImage({
        placeId: client.placeId,
        userId: client.userId,
        bucket: PORTAL_IMAGE_BUCKET,
        path: key, // bare object key, no "place-images/" prefix
        mimeType: mime,
        width,
        height,
        sizeBytes: body.length,
      })
      request.log.info(`[business-images] pending upload place=${client.placeId} request=${requestId}`)
      return reply.status(201).send({ requestId, pendingApproval: true })
    } catch (err) {
      // The object is stored but nothing points at it: remove it now rather
      // than leave an orphan counting against the Storage quota.
      const removed = await deleteStorageObject(PORTAL_IMAGE_BUCKET, key)
      request.log.error({ err, key, removed }, '[business-images] db write failed after upload; object rolled back')
      throw err
    }
  })

  // ── DELETE /business/images/:imageId ────────────────────────────────────
  // Ask an editor to remove a live image (creates an `image_removal` request).
  app.delete('/business/images/:imageId', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!
    const { imageId } = z.object({ imageId: z.string() }).parse(request.params)
    const { requestId } = await requestImageRemoval(client.placeId, client.userId, imageId)
    return reply.send({ requestId, pendingApproval: true })
  })

  // ── DELETE /business/images/requests/:requestId ─────────────────────────
  // Withdraw a pending image change. For an upload, its object is deleted.
  app.delete('/business/images/requests/:requestId', { preHandler: [authenticateBusinessClient] }, async (request, reply) => {
    const client = request.businessClient!
    const { requestId } = z.object({ requestId: z.string() }).parse(request.params)
    const location = await cancelImageRequest(client.placeId, requestId)
    const storageDeleted = location ? await deleteStorageObject(location.bucket, location.path) : false
    return reply.send({ cancelled: true, storageDeleted })
  })
}
