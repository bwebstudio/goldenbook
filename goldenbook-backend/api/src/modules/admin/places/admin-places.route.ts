// Admin write endpoints for places.
//
// POST /api/v1/admin/places     — create a new place
// PUT  /api/v1/admin/places/:id — update an existing place by internal UUID
//
// NOTE: These endpoints currently have no authentication middleware because
// the dashboard does not yet have an admin auth pipeline. Before opening this
// API to the internet, add a preHandler that verifies admin_users membership.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../../db/postgres'
import { ValidationError } from '../../../shared/errors/AppError'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { createPlaceSchema, updatePlaceSchema } from './admin-places.dto'
import { createPlace, updatePlace, deletePlace } from './admin-places.query'
import { getAdminPlacesList } from './admin-places-list.query'
import { getPlaceImages, setCoverImage, setGalleryOrder, moveImageToGallery, removeImageFromGallery, deleteImage, addImageToPlace } from './admin-images.query'

const idParamsSchema = z.object({ id: z.string().uuid('Place id must be a valid UUID') })

export async function adminPlacesRoutes(app: FastifyInstance) {
  // ── GET /admin/places ───────────────────────────────────────────────────────
  // Lightweight list for dashboard with booking + suggestion metadata
  app.get('/admin/places', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    const rows = await getAdminPlacesList()
    return reply.send({ items: rows })
  })

  // ── POST /admin/places ──────────────────────────────────────────────────────
  app.post('/admin/places', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const parsed = createPlaceSchema.safeParse(request.body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }

    const place = await createPlace(parsed.data)
    return reply.status(201).send(place)
  })

  // ── PUT /admin/places/:id ───────────────────────────────────────────────────
  app.put('/admin/places/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)

    const parsed = updatePlaceSchema.safeParse(request.body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }

    const place = await updatePlace(id, parsed.data)
    return reply.send(place)
  })

  // ── Image management ────────────────────────────────────────────────────────

  app.get('/admin/places/:id/images', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    return reply.send({ items: await getPlaceImages(id) })
  })

  app.post('/admin/places/:id/images/set-cover', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const { imageId } = z.object({ imageId: z.string().uuid() }).parse(request.body)
    await setCoverImage(id, imageId)
    return reply.send({ updated: true })
  })

  app.post('/admin/places/:id/images/reorder', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const { imageIds } = z.object({ imageIds: z.array(z.string().uuid()) }).parse(request.body)
    await setGalleryOrder(id, imageIds)
    return reply.send({ updated: true })
  })

  app.post('/admin/places/:id/images/:imageId/to-gallery', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const { imageId } = z.object({ imageId: z.string().uuid() }).parse(request.params)
    await moveImageToGallery(id, imageId)
    return reply.send({ updated: true })
  })

  app.delete('/admin/places/:id/images/:imageId', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const { imageId } = z.object({ imageId: z.string().uuid() }).parse(request.params)
    await removeImageFromGallery(id, imageId)
    return reply.send({ removed: true })
  })

  // ── Permanently delete an image (superadmin only) ─────────────────────────
  app.delete('/admin/places/:id/images/:imageId/permanent', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const { imageId } = z.object({ imageId: z.string().uuid() }).parse(request.params)
    const result = await deleteImage(id, imageId)
    return reply.send({ deleted: !!result, asset: result })
  })

  // ── Add image to place ────────────────────────────────────────────────────
  app.post('/admin/places/:id/images', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const body = z.object({
      bucket: z.string().min(1),
      path: z.string().min(1),
      mimeType: z.string().nullable().default(null),
      width: z.number().int().nullable().default(null),
      height: z.number().int().nullable().default(null),
      sizeBytes: z.number().int().nullable().default(null),
    }).parse(request.body)
    const image = await addImageToPlace(id, body)
    return reply.status(201).send(image)
  })

  // ── Delete place ──────────────────────────────────────────────────────────
  app.delete('/admin/places/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    await deletePlace(id)
    return reply.send({ deleted: true })
  })

  // ── GET translations for a place ────────────────────────────────────────
  app.get('/admin/places/:id/translations', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const { rows } = await db.query<{
      locale: string; name: string; short_description: string | null; full_description: string | null
      goldenbook_note: string | null; why_we_love_it: string | null; insider_tip: string | null
      translation_override: boolean
    }>(`
      SELECT locale, name, short_description, full_description,
             goldenbook_note, why_we_love_it, insider_tip,
             COALESCE(translation_override, false) AS translation_override
      FROM place_translations WHERE place_id = $1
      ORDER BY locale
    `, [id])
    const result: Record<string, unknown> = {}
    for (const row of rows) result[row.locale] = row
    return reply.send(result)
  })

  // ── PUT EN translation manually (sets override) ─────────────────────────
  app.put('/admin/places/:id/translations/en', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const body = z.object({
      name: z.string().optional(),
      shortDescription: z.string().nullable().optional(),
      fullDescription: z.string().nullable().optional(),
      goldenbookNote: z.string().nullable().optional(),
      whyWeLoveIt: z.string().nullable().optional(),
      insiderTip: z.string().nullable().optional(),
    }).parse(request.body)

    const sets: string[] = []
    const params: unknown[] = []
    let i = 1
    function add(col: string, val: unknown) { sets.push(`${col} = $${i++}`); params.push(val) }

    if (body.name !== undefined) add('name', body.name)
    if (body.shortDescription !== undefined) add('short_description', body.shortDescription)
    if (body.fullDescription !== undefined) add('full_description', body.fullDescription)
    if (body.goldenbookNote !== undefined) add('goldenbook_note', body.goldenbookNote)
    if (body.whyWeLoveIt !== undefined) add('why_we_love_it', body.whyWeLoveIt)
    if (body.insiderTip !== undefined) add('insider_tip', body.insiderTip)

    if (sets.length === 0) return reply.send({ updated: false })

    add('translation_override', true)
    sets.push('updated_at = now()')

    params.push(id)
    await db.query(`UPDATE place_translations SET ${sets.join(', ')} WHERE place_id = $${i} AND locale = 'en'`, params)
    return reply.send({ updated: true })
  })

  // ── POST regenerate EN translation from PT via DeepL ────────────────────
  app.post('/admin/places/:id/translations/regenerate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)

    // Get current PT
    const { rows } = await db.query<{
      name: string; short_description: string | null; full_description: string | null
      goldenbook_note: string | null; why_we_love_it: string | null; insider_tip: string | null
    }>('SELECT name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip FROM place_translations WHERE place_id = $1 AND locale = \'pt\' LIMIT 1', [id])

    if (!rows[0]) {
      return reply.status(400).send({ error: 'NO_PT_TRANSLATION', message: 'No Portuguese translation found for this place.' })
    }

    const pt = rows[0]
    const { translateFields } = await import('../../../lib/translation/deepl')

    const translated = await translateFields({
      name: pt.name,
      short_description: pt.short_description,
      full_description: pt.full_description,
      goldenbook_note: pt.goldenbook_note,
      insider_tip: pt.insider_tip,
    })

    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip, translation_override)
      VALUES ($1, 'en', $2, $3, $4, $5, $6, $7, false)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        name = EXCLUDED.name, short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description,
        goldenbook_note = EXCLUDED.goldenbook_note, why_we_love_it = EXCLUDED.why_we_love_it, insider_tip = EXCLUDED.insider_tip,
        translation_override = false, updated_at = now()
    `, [
      id,
      translated.name ?? pt.name,
      translated.short_description ?? pt.short_description,
      translated.full_description ?? pt.full_description,
      translated.goldenbook_note ?? pt.goldenbook_note,
      translated.why_we_love_it ?? pt.why_we_love_it,
      translated.insider_tip ?? pt.insider_tip,
    ])

    return reply.send({ regenerated: true })
  })
}
