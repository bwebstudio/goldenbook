// Admin write endpoints for places.
//
// POST /api/v1/admin/places     — create a new place
// PUT  /api/v1/admin/places/:id — update an existing place by internal UUID
//
// NOTE: These endpoints currently have no authentication middleware because
// the dashboard does not yet have an admin auth pipeline. Before opening this
// API to the internet, add a preHandler that verifies admin_users membership.

import type { FastifyInstance, FastifyReply, FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { db } from '../../../db/postgres'
import { ValidationError } from '../../../shared/errors/AppError'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import { createPlaceSchema, updatePlaceSchema } from './admin-places.dto'
import { createPlace, updatePlace, deletePlace } from './admin-places.query'
import { getAdminPlacesList } from './admin-places-list.query'
import { getPlaceImages, setCoverImage, setGalleryOrder, moveImageToGallery, removeImageFromGallery, deleteImage, addImageToPlace } from './admin-images.query'
import { searchGooglePlaces, previewPlaceFromGoogle, ingestGooglePhotos } from './generate-place'
import {
  updatePlaceUnifiedSchema,
  updatePlaceUnified,
  getPlaceTranslationsForEditor,
  SUPPORTED_LOCALES,
} from './admin-places-unified.query'

const idParamsSchema = z.object({ id: z.string().uuid('Place id must be a valid UUID') })

// Map a thrown Google Places error (from generate-place.ts) to a 502 response
// the dashboard can surface to the editor. Logs the full message + body for Railway.
function replyGooglePlacesError(reply: FastifyReply, log: FastifyBaseLogger, err: unknown, op: string) {
  const message = err instanceof Error ? err.message : String(err)
  log.error({ err, op }, `google_places_failed: ${message}`)

  if (message.startsWith('GOOGLE_PLACES_NOT_CONFIGURED')) {
    return reply.status(502).send({
      error: 'GOOGLE_PLACES_NOT_CONFIGURED',
      message: 'Backend Google Places API key is missing. Set GOOGLE_MAPS_API_KEY on the API service.',
    })
  }
  // GOOGLE_PLACES_HTTP_<status>: <op> <body>
  const m = /^GOOGLE_PLACES_HTTP_(\d+):/.exec(message)
  const status = m ? Number(m[1]) : null
  const lower = message.toLowerCase()

  let code = 'GOOGLE_PLACES_FAILED'
  if (status === 403 && lower.includes('referer')) code = 'GOOGLE_PLACES_KEY_REFERER_RESTRICTED'
  else if (status === 403 && lower.includes('not been used') ) code = 'GOOGLE_PLACES_API_NOT_ENABLED'
  else if (status === 403 && lower.includes('billing')) code = 'GOOGLE_PLACES_BILLING_REQUIRED'
  else if (status === 403) code = 'GOOGLE_PLACES_PERMISSION_DENIED'
  else if (status === 401) code = 'GOOGLE_PLACES_KEY_INVALID'
  else if (status === 429) code = 'GOOGLE_PLACES_QUOTA_EXCEEDED'
  else if (status === 400) code = 'GOOGLE_PLACES_BAD_REQUEST'

  return reply.status(502).send({ error: code, message })
}

export async function adminPlacesRoutes(app: FastifyInstance) {

  // ── GET /admin/places/search-google ─────────────────────────────────────────
  // Google Places autocomplete for the "new place" flow
  app.get('/admin/places/search-google', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { q } = z.object({ q: z.string().min(2) }).parse(request.query)
    try {
      const results = await searchGooglePlaces(q)
      return reply.send({ results })
    } catch (err) {
      return replyGooglePlacesError(reply, request.log, err, 'searchGooglePlaces')
    }
  })

  // ── POST /admin/places/preview-from-google ───────────────────────────────────
  // Returns all fields pre-filled from Google Places WITHOUT creating the place.
  // The editor reviews the data and clicks Save to actually create it.
  app.post('/admin/places/preview-from-google', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { googlePlaceId } = z.object({
      googlePlaceId: z.string().min(1),
    }).parse(request.body)

    try {
      const preview = await previewPlaceFromGoogle(googlePlaceId)
      return reply.send(preview)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.startsWith('DUPLICATE:')) {
        const existingSlug = msg.split(':')[1]
        return reply.status(409).send({
          error: 'DUPLICATE_PLACE',
          message: 'Este estabelecimento já existe na base de dados.',
          existingSlug,
        })
      }
      if (msg.startsWith('GOOGLE_PLACES_')) {
        return replyGooglePlacesError(reply, request.log, err, 'previewPlaceFromGoogle')
      }
      throw err
    }
  })

  // ── POST /admin/places/:id/ingest-google-photos ──────────────────────────────
  // Downloads photos from Google Places and uploads them to Supabase storage.
  // Called after place creation with the photoNames from the preview.
  app.post('/admin/places/:id/ingest-google-photos', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const { photoNames } = z.object({
      photoNames: z.array(z.string()).max(10),
    }).parse(request.body)

    if (photoNames.length === 0) return reply.send({ ingested: 0, failed: 0 })

    const result = await ingestGooglePhotos(id, photoNames)
    if (result.ingested === 0 && result.failed > 0) {
      request.log.error({ placeId: id, failed: result.failed }, 'ingestGooglePhotos: all photos failed — check Railway stderr for [google places] entries')
    }
    return reply.send(result)
  })

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
  //
  // The canonical save path. Body uses the flat `updatePlaceSchema` shape;
  // editorial fields are written into the **Portuguese** row and EN/ES are
  // auto-translated from PT (override-protected). See
  // `translation-policy.ts` and `admin-places.query.ts:updatePlace`.
  //
  // The legacy "unified" payload (`{ canonical, translations: { en, es, pt }}`)
  // used to be accepted here too; it has been moved to a dedicated endpoint
  // (`PUT /admin/places/:id/translations/bulk` below) so a stray
  // `translations` key on a regular save can never silently route the
  // request through the EN-permissive code path.
  app.put('/admin/places/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const body = (request.body ?? {}) as Record<string, unknown>

    // Defensive: refuse the legacy unified shape on this endpoint with a
    // clear redirect message rather than silently failing schema validation
    // on the keys we don't accept. Dashboards on old code will see a 400
    // explaining where to send the request.
    if ('canonical' in body || 'translations' in body) {
      throw new ValidationError(
        '`canonical` / `translations` payloads are not accepted on PUT /admin/places/:id. ' +
        'Use PUT /admin/places/:id/translations/bulk for explicit per-locale writes.',
      )
    }

    const parsed = updatePlaceSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }

    const place = await updatePlace(id, parsed.data)
    return reply.send(place)
  })

  // ── PUT /admin/places/:id/translations/bulk ─────────────────────────────────
  //
  // Explicit per-locale write surface. Each (place_id, locale) row is
  // first-class and editable; the caller decides which locales to touch
  // and may set `is_override: true` to lock a row against future
  // auto-regeneration. DeepL is NEVER invoked from this path — that's the
  // job of POST /admin/places/:id/translations/regenerate.
  //
  // This endpoint exists for callers that genuinely need to write EN or
  // ES content directly (e.g. bulk imports, future translation-management
  // tools). It is NOT the path the dashboard place editor uses — the
  // editor goes through PUT /admin/places/:id which is PT-canonical.
  app.put('/admin/places/:id/translations/bulk', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const parsed = updatePlaceUnifiedSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }
    const updatedBy = request.user?.sub ?? null
    const result = await updatePlaceUnified(id, parsed.data, updatedBy)
    return reply.send(result)
  })

  // ── GET /admin/places/:id/translations/editor ─────────────────────────────
  //
  // Dashboard read for the three-tab translation editor. Returns all three
  // locales with their provenance metadata so the UI can render badges like
  // "Manual override" / "DeepL auto" per locale.
  app.get('/admin/places/:id/translations/editor', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const translations = await getPlaceTranslationsForEditor(id)
    return reply.send({ translations, supported: SUPPORTED_LOCALES })
  })

  // ── POST /admin/places/:id/translations/suggest ───────────────────────────
  //
  // Returns DeepL suggestions WITHOUT persisting them. The dashboard displays
  // the output inline (as ghost text) in the target-locale tab; the editor
  // accepts or rewrites before the save round-trip.
  //
  // Never write from this endpoint — the data-quality contract depends on it.
  app.post('/admin/places/:id/translations/suggest', {
    preHandler: [authenticateDashboardUser],
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const body = z.object({
      source: z.enum(['en', 'es', 'pt']),
      target: z.enum(['en', 'es', 'pt']),
    }).parse(request.body)

    if (body.source === body.target) {
      throw new ValidationError('source and target locales must differ')
    }

    const { rows } = await db.query<{
      name: string
      short_description: string | null
      full_description: string | null
      goldenbook_note: string | null
      insider_tip: string | null
    }>(
      `SELECT name, short_description, full_description, goldenbook_note, insider_tip
         FROM place_translations
        WHERE place_id = $1 AND locale = $2 LIMIT 1`,
      [id, body.source],
    )
    if (!rows[0]) {
      return reply.status(400).send({
        error: 'NO_SOURCE_TRANSLATION',
        message: `No ${body.source.toUpperCase()} translation exists to translate from.`,
      })
    }

    const { translatePlaceFields } = await import('../../../lib/translation/deepl')
    const suggestion = await translatePlaceFields(rows[0], body.target, body.source)
    return reply.send({
      source: body.source,
      target: body.target,
      suggestion,
      persisted: false,
    })
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
      goldenbook_note: string | null; insider_tip: string | null
      translation_override: boolean
    }>(`
      SELECT locale, name, short_description, full_description,
             goldenbook_note, insider_tip,
             COALESCE(translation_override, false) AS translation_override
      FROM place_translations WHERE place_id = $1
      ORDER BY locale
    `, [id])
    const result: Record<string, unknown> = {}
    for (const row of rows) result[row.locale] = row
    return reply.send(result)
  })

  // ── PUT translation manually for a target locale (sets override) ────────
  // Supports 'en' and 'es' — Portuguese is the canonical source and is edited
  // through the main place form, not here.
  app.put('/admin/places/:id/translations/:locale', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id, locale } = z.object({
      id: z.string().uuid('Place id must be a valid UUID'),
      locale: z.enum(['en', 'es']),
    }).parse(request.params)
    const body = z.object({
      name: z.string().optional(),
      shortDescription: z.string().nullable().optional(),
      fullDescription: z.string().nullable().optional(),
      goldenbookNote: z.string().nullable().optional(),
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
    if (body.insiderTip !== undefined) add('insider_tip', body.insiderTip)

    if (sets.length === 0) return reply.send({ updated: false })

    add('translation_override', true)
    sets.push('updated_at = now()')

    params.push(id)
    params.push(locale)
    await db.query(
      `UPDATE place_translations SET ${sets.join(', ')} WHERE place_id = $${i} AND locale = $${i + 1}`,
      params,
    )
    return reply.send({ updated: true, locale })
  })

  // ── POST regenerate auto-translations via DeepL ─────────────────────────
  //
  // Body (all optional):
  //   - source:    'pt' | 'en' | 'es'   default 'pt'
  //   - text:      { name, shortDescription, fullDescription, goldenbookNote, insiderTip }
  //                If provided, used as the source content (lets the dashboard
  //                regenerate from in-form values without saving first).
  //                Otherwise the source row is read from `place_translations`.
  //   - targets:   ('en' | 'es' | 'pt')[]   defaults to the two locales other
  //                than the source.
  //   - persist:   boolean   default true. When false, returns the DeepL output
  //                without writing — used for in-form previews.
  //
  // PT is the editorial source-of-truth. The endpoint NEVER overwrites a row
  // whose `translation_override = true` unless `targets` explicitly includes it.
  app.post('/admin/places/:id/translations/regenerate', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)

    const localeEnum = z.enum(['en', 'es', 'pt'])
    const body = z.object({
      source: localeEnum.default('pt'),
      text: z.object({
        name: z.string().optional(),
        shortDescription: z.string().nullable().optional(),
        fullDescription: z.string().nullable().optional(),
        goldenbookNote: z.string().nullable().optional(),
        insiderTip: z.string().nullable().optional(),
      }).optional(),
      targets: z.array(localeEnum).optional(),
      persist: z.boolean().default(true),
    }).parse(request.body ?? {})

    // Resolve source content — inline text wins, otherwise read DB.
    let sourceFields: {
      name: string; short_description: string | null; full_description: string | null
      goldenbook_note: string | null; insider_tip: string | null
    } | null = null

    if (body.text) {
      sourceFields = {
        name: body.text.name ?? '',
        short_description: body.text.shortDescription ?? null,
        full_description: body.text.fullDescription ?? null,
        goldenbook_note: body.text.goldenbookNote ?? null,
        insider_tip: body.text.insiderTip ?? null,
      }
    } else {
      const { rows } = await db.query<{
        name: string; short_description: string | null; full_description: string | null
        goldenbook_note: string | null; insider_tip: string | null
      }>(
        'SELECT name, short_description, full_description, goldenbook_note, insider_tip FROM place_translations WHERE place_id = $1 AND locale = $2 LIMIT 1',
        [id, body.source],
      )
      if (!rows[0]) {
        return reply.status(400).send({
          error: 'NO_SOURCE_TRANSLATION',
          message: `No ${body.source.toUpperCase()} translation found for this place.`,
        })
      }
      sourceFields = rows[0]
    }

    const requestedTargets = (body.targets && body.targets.length > 0
      ? body.targets
      : (['en', 'es', 'pt'] as const).filter((l) => l !== body.source)
    ) as ReadonlyArray<'en' | 'es' | 'pt'>

    // Manual overrides (translation_override = true) MUST be preserved —
    // an editor explicitly curated those rows. Read the override flags for
    // the requested targets up-front so the regenerate loop below can skip
    // them with a single round-trip instead of one query per target.
    const overrideRows = await db.query<{ locale: string; translation_override: boolean }>(
      `SELECT locale, COALESCE(translation_override, false) AS translation_override
       FROM place_translations
       WHERE place_id = $1 AND locale = ANY($2::text[])`,
      [id, [...requestedTargets]],
    )
    const overrides: Partial<Record<'en' | 'es' | 'pt', boolean>> = {}
    for (const row of overrideRows.rows) {
      overrides[row.locale as 'en' | 'es' | 'pt'] = row.translation_override
    }

    const { resolveRegenerateTargets } = await import('./translation-policy')
    const { toRegenerate: targets, skippedOverridden } = resolveRegenerateTargets({
      source: body.source,
      targets: requestedTargets,
      overrides,
    })

    const { translatePlaceFields } = await import('../../../lib/translation/deepl')
    const succeeded: string[] = []
    const failed: string[] = []
    const results: Record<string, unknown> = {}

    for (const targetLocale of targets) {
      try {
        const translated = await translatePlaceFields(
          {
            name: sourceFields.name,
            short_description: sourceFields.short_description,
            full_description: sourceFields.full_description,
            goldenbook_note: sourceFields.goldenbook_note,
            insider_tip: sourceFields.insider_tip,
          },
          targetLocale,
          body.source,
        )

        results[targetLocale] = {
          name: translated.name,
          shortDescription: translated.short_description,
          fullDescription: translated.full_description,
          goldenbookNote: translated.goldenbook_note,
          insiderTip: translated.insider_tip,
        }

        if (body.persist) {
          // Belt-and-suspenders: even though `resolveRegenerateTargets`
          // already filtered out overridden locales, the WHERE clause here
          // ensures a concurrent override write between policy check and
          // INSERT can't be silently clobbered. If the row exists with
          // override=true the conflict's UPDATE is a no-op.
          await db.query(`
            INSERT INTO place_translations (place_id, locale, name, short_description, full_description, goldenbook_note, insider_tip, translation_override, translated_from)
            VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
            ON CONFLICT (place_id, locale) DO UPDATE SET
              name = EXCLUDED.name, short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description,
              goldenbook_note = EXCLUDED.goldenbook_note, insider_tip = EXCLUDED.insider_tip,
              translated_from = EXCLUDED.translated_from, updated_at = now()
            WHERE COALESCE(place_translations.translation_override, false) = false
          `, [
            id,
            targetLocale,
            translated.name,
            translated.short_description,
            translated.full_description,
            translated.goldenbook_note,
            translated.insider_tip,
            body.source,
          ])
        }
        succeeded.push(targetLocale)
      } catch (err) {
        app.log.error({ placeId: id, locale: targetLocale, error: err instanceof Error ? err.message : err }, 'regenerate_translation_failed')
        failed.push(targetLocale)
      }
    }

    return reply.send({
      regenerated: succeeded.length > 0,
      source: body.source,
      succeeded,
      failed,
      // Overridden locales are reported separately so the dashboard can
      // explain why a requested target was left untouched ("EN was kept
      // because it has a manual override").
      skippedOverridden,
      persisted: body.persist,
      results,
    })
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
        goldenbook_note: string | null; insider_tip: string | null
      }>('SELECT name, short_description, full_description, goldenbook_note, insider_tip FROM place_translations WHERE place_id = $1 AND locale = \'en\' LIMIT 1', [place_id])

      if (!enRows[0]) continue
      const en = enRows[0]

      for (const locale of missing_locales) {
        try {
          const translated = await translatePlaceFields(
            { name: en.name, short_description: en.short_description, full_description: en.full_description, goldenbook_note: en.goldenbook_note, insider_tip: en.insider_tip },
            locale,
            'en',
          )
          await db.query(`
            INSERT INTO place_translations (place_id, locale, name, short_description, full_description, goldenbook_note, insider_tip, translation_override)
            VALUES ($1, $2, $3, $4, $5, $6, $7, false)
            ON CONFLICT (place_id, locale) DO UPDATE SET
              name = EXCLUDED.name, short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description,
              goldenbook_note = EXCLUDED.goldenbook_note, insider_tip = EXCLUDED.insider_tip,
              translation_override = false, updated_at = now()
          `, [place_id, locale, translated.name, translated.short_description, translated.full_description, translated.goldenbook_note, translated.insider_tip])
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
