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

  // ── NOW context tags (reference data) ───────────────────────────────────────
  app.get('/admin/now/tags', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    const { rows } = await db.query<{ slug: string; name: string; description: string | null }>(
      `SELECT slug, name, description FROM now_context_tags ORDER BY name`,
    )
    return reply.send({ items: rows })
  })

  // ── NOW config for a place ─────────────────────────────────────────────────
  app.get('/admin/places/:id/now', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)

    const { rows: placeRows } = await db.query<{
      now_enabled: boolean; now_priority: number; now_featured: boolean
      now_start_at: string | null; now_end_at: string | null
    }>(
      `SELECT now_enabled, now_priority, now_featured, now_start_at, now_end_at FROM places WHERE id = $1`,
      [id],
    )
    if (!placeRows[0]) return reply.status(404).send({ error: 'Place not found' })

    const { rows: tagRows } = await db.query<{ slug: string }>(
      `SELECT nct.slug FROM place_now_tags pnt JOIN now_context_tags nct ON nct.id = pnt.tag_id WHERE pnt.place_id = $1`,
      [id],
    )

    const { rows: twRows } = await db.query<{ time_window: string }>(
      `SELECT time_window FROM place_now_time_windows WHERE place_id = $1`,
      [id],
    )

    const p = placeRows[0]
    return reply.send({
      nowEnabled:    p.now_enabled,
      nowPriority:   p.now_priority,
      nowFeatured:   p.now_featured,
      nowStartAt:    p.now_start_at,
      nowEndAt:      p.now_end_at,
      nowTagSlugs:   tagRows.map((r) => r.slug),
      nowTimeWindows: twRows.map((r) => r.time_window),
    })
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
    try {
      const image = await addImageToPlace(id, body)
      return reply.status(201).send(image)
    } catch (err) {
      if (err instanceof Error && err.message.includes('Maximum is')) {
        return reply.status(400).send({ error: 'IMAGE_LIMIT_REACHED', message: err.message })
      }
      throw err
    }
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

  // ── POST regenerate PT/ES translations from EN via DeepL ────────────────
  app.post('/admin/places/:id/translations/regenerate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)

    // EN is the source of truth for auto-generated locales.
    const { rows } = await db.query<{
      name: string; short_description: string | null; full_description: string | null
      goldenbook_note: string | null; why_we_love_it: string | null; insider_tip: string | null
    }>('SELECT name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip FROM place_translations WHERE place_id = $1 AND locale = \'en\' LIMIT 1', [id])

    if (!rows[0]) {
      return reply.status(400).send({ error: 'NO_EN_TRANSLATION', message: 'No English translation found for this place.' })
    }

    const en = rows[0]
    const { translatePlaceFields } = await import('../../../lib/translation/deepl')
    const targetLocales = ['pt', 'es'] as const
    const succeeded: string[] = []
    const failed: string[] = []

    for (const targetLocale of targetLocales) {
      try {
        const translated = await translatePlaceFields(
          {
            name: en.name,
            short_description: en.short_description,
            full_description: en.full_description,
            goldenbook_note: en.goldenbook_note,
            why_we_love_it: en.why_we_love_it,
            insider_tip: en.insider_tip,
          },
          targetLocale,
          'en',
        )

        await db.query(`
          INSERT INTO place_translations (place_id, locale, name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip, translation_override)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
          ON CONFLICT (place_id, locale) DO UPDATE SET
            name = EXCLUDED.name, short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description,
            goldenbook_note = EXCLUDED.goldenbook_note, why_we_love_it = EXCLUDED.why_we_love_it, insider_tip = EXCLUDED.insider_tip,
            translation_override = false, updated_at = now()
        `, [
          id,
          targetLocale,
          translated.name,
          translated.short_description,
          translated.full_description,
          translated.goldenbook_note,
          translated.why_we_love_it,
          translated.insider_tip,
        ])
        succeeded.push(targetLocale)
      } catch (err) {
        app.log.error({ placeId: id, locale: targetLocale, error: err instanceof Error ? err.message : err }, 'regenerate_translation_failed')
        failed.push(targetLocale)
      }
    }

    return reply.send({ regenerated: succeeded.length > 0, succeeded, failed })
  })

  // ── POST bulk regenerate translations for all places missing PT/ES ─────
  app.post('/admin/places/translations/regenerate-all', { preHandler: [authenticateDashboardUser] }, async (_request, reply) => {
    // Find all places that have EN but are missing PT or ES
    const { rows: missing } = await db.query<{ place_id: string; missing_locales: string[] }>(`
      SELECT
        en.place_id,
        ARRAY_REMOVE(ARRAY[
          CASE WHEN pt.place_id IS NULL THEN 'pt' END,
          CASE WHEN es.place_id IS NULL THEN 'es' END
        ], NULL) AS missing_locales
      FROM place_translations en
      LEFT JOIN place_translations pt ON pt.place_id = en.place_id AND pt.locale = 'pt'
      LEFT JOIN place_translations es ON es.place_id = en.place_id AND es.locale = 'es'
      WHERE en.locale = 'en'
        AND (pt.place_id IS NULL OR es.place_id IS NULL)
    `)

    if (missing.length === 0) {
      return reply.send({ total: 0, succeeded: 0, failed: 0, details: [] })
    }

    const { translatePlaceFields } = await import('../../../lib/translation/deepl')
    const details: { placeId: string; locale: string; status: 'ok' | 'error'; error?: string }[] = []

    for (const { place_id, missing_locales } of missing) {
      // Fetch EN fields
      const { rows: enRows } = await db.query<{
        name: string; short_description: string | null; full_description: string | null
        goldenbook_note: string | null; why_we_love_it: string | null; insider_tip: string | null
      }>('SELECT name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip FROM place_translations WHERE place_id = $1 AND locale = \'en\' LIMIT 1', [place_id])

      if (!enRows[0]) continue
      const en = enRows[0]

      for (const locale of missing_locales) {
        try {
          const translated = await translatePlaceFields(
            { name: en.name, short_description: en.short_description, full_description: en.full_description, goldenbook_note: en.goldenbook_note, why_we_love_it: en.why_we_love_it, insider_tip: en.insider_tip },
            locale,
            'en',
          )
          await db.query(`
            INSERT INTO place_translations (place_id, locale, name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip, translation_override)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
            ON CONFLICT (place_id, locale) DO UPDATE SET
              name = EXCLUDED.name, short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description,
              goldenbook_note = EXCLUDED.goldenbook_note, why_we_love_it = EXCLUDED.why_we_love_it, insider_tip = EXCLUDED.insider_tip,
              translation_override = false, updated_at = now()
          `, [place_id, locale, translated.name, translated.short_description, translated.full_description, translated.goldenbook_note, translated.why_we_love_it, translated.insider_tip])
          details.push({ placeId: place_id, locale, status: 'ok' })
        } catch (err) {
          app.log.error({ placeId: place_id, locale, error: err instanceof Error ? err.message : err }, 'bulk_regenerate_failed')
          details.push({ placeId: place_id, locale, status: 'error', error: err instanceof Error ? err.message : 'unknown' })
        }
      }
    }

    const succeeded = details.filter(d => d.status === 'ok').length
    const failed = details.filter(d => d.status === 'error').length
    return reply.send({ total: missing.length, succeeded, failed, details })
  })
}
