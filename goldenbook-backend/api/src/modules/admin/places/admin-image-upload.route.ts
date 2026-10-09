// ─── Employee image upload, through the API ──────────────────────────────────
//
// The dashboard used to upload straight to the `place-images` bucket from the
// browser with the public anon key, which only worked because the bucket's
// INSERT/UPDATE/DELETE policies were granted to the `public` role. That also
// let anyone holding the anon key (it ships inside the mobile app) upload,
// overwrite or delete any photo. Uploads now come here: the API checks the
// dashboard session, stores the object with the service-role key and links it
// in the same request, so the write policies can be dropped
// (migration 20261009120000_lock_place_images_writes).
//
// Own plugin so the raw image body parser does not apply to the JSON routes
// in admin-places.route.ts.

import type { FastifyError, FastifyInstance, FastifyRequest } from 'fastify'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { AppError } from '../../../shared/errors/AppError'
import { deleteStorageObject } from '../../../lib/storage/supabase-storage'
import { uploadStorageObject } from '../../../lib/storage/supabase-upload'
import {
  PORTAL_IMAGE_MAX_BYTES as IMAGE_MAX_BYTES,
  PORTAL_IMAGE_MIME_TYPES as IMAGE_MIME_TYPES,
  sniffImageMime,
} from '../../business-portal/business-images.policy'
import { addImageToPlace } from './admin-images.query'

const BUCKET = 'place-images'

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const paramsSchema = z.object({ id: z.string().uuid('Place id must be a valid UUID') })
const dimsSchema = z.object({
  width: z.coerce.number().int().positive().max(20000).optional(),
  height: z.coerce.number().int().positive().max(20000).optional(),
})

export async function adminImageUploadRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    [...IMAGE_MIME_TYPES],
    { parseAs: 'buffer', bodyLimit: IMAGE_MAX_BYTES },
    (_req: FastifyRequest, body: Buffer, done: (err: Error | null, body?: Buffer) => void) => done(null, body),
  )

  // Same stable codes as the business portal, instead of a generic 500.
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

  // ── POST /admin/places/:id/images/upload ────────────────────────────────
  // Body: the image bytes (already resized by the dashboard), Content-Type
  // image/jpeg | image/png | image/webp. Query: width, height.
  app.post('/admin/places/:id/images/upload', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id: placeId } = paramsSchema.parse(request.params)
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

    // Bare object key: storage.objects.name never carries the bucket.
    const key = `places/${placeId}/${Date.now()}-${randomBytes(4).toString('hex')}.${EXTENSION[mime]}`

    try {
      await uploadStorageObject(BUCKET, key, body, mime)
    } catch (err) {
      request.log.error({ err, placeId }, '[admin-image-upload] storage upload failed')
      throw new AppError(502, 'Image upload failed', 'UPLOAD_FAILED')
    }

    try {
      const image = await addImageToPlace(placeId, {
        bucket: BUCKET,
        path: key,
        mimeType: mime,
        width,
        height,
        sizeBytes: body.length,
      })
      return reply.status(201).send(image)
    } catch (err) {
      // Stored but unlinked: remove it now rather than leave an orphan.
      const removed = await deleteStorageObject(BUCKET, key)
      request.log.error({ err, key, removed }, '[admin-image-upload] db write failed after upload; object rolled back')
      if (err instanceof Error && err.message.includes('Maximum is')) {
        throw new AppError(400, err.message, 'IMAGE_LIMIT_REACHED')
      }
      throw err
    }
  })
}
