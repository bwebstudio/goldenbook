import { db } from '../../db/postgres'
import { translateText } from '../../lib/translation/deepl'

// Editorial source-of-truth for routes (curator writes here).
// Mirrors modules/admin/places/translation-policy.ts.
const CANONICAL_LOCALE = 'pt'
type Lang = 'en' | 'pt' | 'es'

function toLang(locale: string): Lang {
  const family = locale.trim().toLowerCase().replace('_', '-').split('-')[0]
  if (family === 'pt') return 'pt'
  if (family === 'es') return 'es'
  return 'en'
}

/**
 * Resolve a localized route field (title / summary) for the requested locale.
 *
 * The raw column on `curated_routes` is the canonical PT text — that's where
 * the curator writes. `*_translations` is a JSONB cache of EN/ES translations.
 *
 * Strategy:
 *  • If the requested locale is canonical → return the raw column.
 *  • Else if the JSONB already has it → return that.
 *  • Else translate raw → target via DeepL (cached at translation_cache level)
 *    and persist into the JSONB so future reads skip the API call.
 *  • If translation fails (DeepL down, key missing) → fall back to raw so the
 *    user sees PT instead of an empty card. Better degraded than broken.
 */
async function resolveLocalizedRouteField(args: {
  routeId: string
  raw: string | null
  translations: Record<string, string> | null | undefined
  targetLang: Lang
  column: 'title_translations' | 'summary_translations'
}): Promise<string | null> {
  const { routeId, raw, translations, targetLang, column } = args
  if (!raw || !raw.trim()) return raw

  if (targetLang === CANONICAL_LOCALE) return raw

  const cached = translations?.[targetLang]
  if (cached && cached.trim()) return cached

  try {
    const translated = await translateText(raw, targetLang, CANONICAL_LOCALE)
    if (translated && translated.trim()) {
      // Persist; non-fatal if it fails (next read will retry).
      db.query(
        `UPDATE curated_routes
         SET ${column} = COALESCE(${column}, '{}'::jsonb) || $2::jsonb
         WHERE id = $1`,
        [routeId, JSON.stringify({ [targetLang]: translated })],
      ).catch(() => { /* non-fatal */ })
      return translated
    }
  } catch {
    // DeepL unavailable — degrade to canonical PT instead of crashing.
  }

  return raw
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CuratedRouteWithStops {
  id: string
  citySlug: string
  routeType: string
  templateType: string | null
  sponsorPlaceId: string | null
  title: string
  summary: string | null
  startsAt: string
  expiresAt: string
  isActive: boolean
  stops: Array<{
    placeId: string
    stopOrder: number
    editorialNote: string | null
    placeName: string
    placeSlug: string
    placeType: string
    heroImage: { bucket: string | null; path: string | null }
    latitude: number | null
    longitude: number | null
    shortDescription: string | null
  }>
}

export interface AdminCuratedRouteRow {
  id: string
  city_slug: string
  route_type: string
  template_type: string | null
  sponsor_place_id: string | null
  title: string
  summary: string | null
  starts_at: string
  expires_at: string
  is_active: boolean
  stop_count: number
  created_at: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Builds a CuratedRouteWithStops from a route row and its stop rows */
function buildRouteWithStops(
  route: Record<string, unknown>,
  stopRows: Array<Record<string, unknown>>,
): CuratedRouteWithStops {
  return {
    id: route.id as string,
    citySlug: route.city_slug as string,
    routeType: route.route_type as string,
    templateType: (route.template_type as string) ?? null,
    sponsorPlaceId: (route.sponsor_place_id as string) ?? null,
    title: route.title as string,
    summary: (route.summary as string) ?? null,
    startsAt: route.starts_at as string,
    expiresAt: route.expires_at as string,
    isActive: route.is_active as boolean,
    stops: stopRows.map((s) => ({
      placeId: s.place_id as string,
      stopOrder: s.stop_order as number,
      editorialNote: (s.editorial_note as string) ?? null,
      placeName: s.place_name as string,
      placeSlug: s.place_slug as string,
      placeType: s.place_type as string,
      heroImage: {
        bucket: (s.hero_bucket as string) ?? null,
        path: (s.hero_path as string) ?? null,
      },
      latitude: (s.latitude as number) ?? null,
      longitude: (s.longitude as number) ?? null,
      shortDescription: (s.short_description as string) ?? null,
    })),
  }
}

// Fallback chain for translatable fields on a stop:
//   1. requested locale (full, e.g. 'pt-PT')
//   2. requested language code (e.g. 'pt' from 'pt-PT')
//   3. Portuguese ('pt') — Goldenbook's primary market, the editorial source of truth
//   4. Spanish ('es')
//   5. English ('en') — baseline fallback
//   6. raw columns on `places` / `curated_route_stops`
// This lets a Spanish user see Portuguese when Spanish is missing, and keeps
// English as the last resort before the raw editorial row.
const STOPS_SELECT = `
  crs.place_id,
  crs.stop_order,
  COALESCE(
    NULLIF(crs.note_translations ->> split_part($LOCALE$::text, '-', 1), ''),
    NULLIF(crs.note_translations ->> 'pt', ''),
    NULLIF(crs.note_translations ->> 'es', ''),
    NULLIF(crs.note_translations ->> 'en', ''),
    crs.editorial_note
  ) AS editorial_note,
  COALESCE(
    NULLIF(pt.name, ''),
    NULLIF(pt_lang.name, ''),
    NULLIF(pt_primary.name, ''),
    NULLIF(pt_es.name, ''),
    NULLIF(pt_fb.name, ''),
    p.name
  ) AS place_name,
  p.slug          AS place_slug,
  p.place_type,
  hero_img.bucket AS hero_bucket,
  hero_img.path   AS hero_path,
  p.latitude,
  p.longitude,
  COALESCE(
    NULLIF(pt.short_description, ''),
    NULLIF(pt_lang.short_description, ''),
    NULLIF(pt_primary.short_description, ''),
    NULLIF(pt_es.short_description, ''),
    NULLIF(pt_fb.short_description, ''),
    p.short_description
  ) AS short_description`

const STOPS_FROM = `
  FROM curated_route_stops crs
  JOIN places p ON p.id = crs.place_id
  LEFT JOIN place_translations pt
         ON pt.place_id = p.id AND pt.locale = $LOCALE$
  LEFT JOIN place_translations pt_lang
         ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($LOCALE$, '-', 1) AND $LOCALE$ LIKE '%-%'
  -- Canonical PT row is the editorial source-of-truth (see
  -- modules/admin/places/translation-policy.ts). It is also the canonical
  -- fallback when the requested locale + language family return nothing.
  -- pt_es / pt_fb are kept as soft-fallback tiers so a place that happens
  -- to be missing both PT and the requested locale still surfaces some
  -- editorial copy instead of dropping to the bare places.name column.
  -- They are NOT used as canonical reads.
  LEFT JOIN place_translations pt_primary
         ON pt_primary.place_id = p.id AND pt_primary.locale = 'pt'
  LEFT JOIN place_translations pt_es
         ON pt_es.place_id = p.id AND pt_es.locale = 'es'
  LEFT JOIN place_translations pt_fb
         ON pt_fb.place_id = p.id AND pt_fb.locale = 'pt'
  LEFT JOIN LATERAL (
    SELECT ma.bucket, ma.path
    FROM   place_images pi
    JOIN   media_assets ma ON ma.id = pi.asset_id
    WHERE  pi.place_id = p.id
      AND  pi.image_role IN ('hero', 'cover')
    ORDER  BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
    LIMIT  1
  ) hero_img ON true`

// ─── getActiveCuratedRoutes ─────────────────────────────────────────────────

export async function getActiveCuratedRoutes(
  citySlug: string,
  locale: string,
): Promise<CuratedRouteWithStops[]> {
  const targetLang = toLang(locale)

  // 1. Fetch raw + translations JSONB so we can resolve per-locale in JS.
  //    The previous SQL COALESCE fallback walked PT before EN, so an EN user
  //    whose `title_translations.en` was missing always got PT back.
  const { rows: routeRows } = await db.query<Record<string, unknown>>(
    `SELECT id, city_slug, route_type, template_type, sponsor_place_id,
            title,
            summary,
            title_translations,
            summary_translations,
            starts_at, expires_at, is_active
     FROM   curated_routes
     WHERE  city_slug = $1
       AND  is_active = true
       AND  starts_at <= now()
       AND  expires_at > now()
     ORDER  BY route_type = 'sponsored' DESC, created_at DESC
     LIMIT  2`,
    [citySlug],
  )

  if (routeRows.length === 0) return []

  // 2. Resolve title/summary per locale. Lazy-translates and persists when
  //    a translation is missing for the requested locale. Parallel across
  //    rows so a list of 2 routes is one DeepL roundtrip wide, not serial.
  await Promise.all(
    routeRows.flatMap((row) => [
      resolveLocalizedRouteField({
        routeId: row.id as string,
        raw: row.title as string,
        translations: row.title_translations as Record<string, string> | null,
        targetLang,
        column: 'title_translations',
      }).then((t) => { row.title = t }),
      resolveLocalizedRouteField({
        routeId: row.id as string,
        raw: row.summary as string | null,
        translations: row.summary_translations as Record<string, string> | null,
        targetLang,
        column: 'summary_translations',
      }).then((s) => { row.summary = s }),
    ]),
  )

  // 3. Fetch stops for all routes in one query
  const routeIds = routeRows.map((r) => r.id as string)
  const stopsQuery = `
    SELECT crs.route_id, ${STOPS_SELECT.replace(/\$LOCALE\$/g, '$2')}
    ${STOPS_FROM.replace(/\$LOCALE\$/g, '$2')}
    WHERE crs.route_id = ANY($1::uuid[])
    ORDER BY crs.route_id, crs.stop_order ASC`

  const { rows: stopRows } = await db.query<Record<string, unknown>>(stopsQuery, [routeIds, locale])

  // 4. Group stops by route
  const stopsByRoute = new Map<string, Array<Record<string, unknown>>>()
  for (const stop of stopRows) {
    const routeId = stop.route_id as string
    if (!stopsByRoute.has(routeId)) stopsByRoute.set(routeId, [])
    stopsByRoute.get(routeId)!.push(stop)
  }

  return routeRows.map((route) =>
    buildRouteWithStops(route, stopsByRoute.get(route.id as string) ?? []),
  )
}

// ─── getCuratedRouteById ────────────────────────────────────────────────────

export async function getCuratedRouteById(
  id: string,
  locale: string,
): Promise<CuratedRouteWithStops | null> {
  const targetLang = toLang(locale)

  // Fetch raw + translations JSONB. Resolution happens in JS (see
  // resolveLocalizedRouteField) so a missing target translation is
  // lazy-generated via DeepL instead of silently falling back to PT.
  const { rows: routeRows } = await db.query<Record<string, unknown>>(
    `SELECT id, city_slug, route_type, template_type, sponsor_place_id,
            title,
            summary,
            title_translations,
            summary_translations,
            starts_at, expires_at, is_active
     FROM   curated_routes
     WHERE  id = $1
     LIMIT  1`,
    [id],
  )

  if (!routeRows[0]) return null

  const route = routeRows[0]
  await Promise.all([
    resolveLocalizedRouteField({
      routeId: route.id as string,
      raw: route.title as string,
      translations: route.title_translations as Record<string, string> | null,
      targetLang,
      column: 'title_translations',
    }).then((t) => { route.title = t }),
    resolveLocalizedRouteField({
      routeId: route.id as string,
      raw: route.summary as string | null,
      translations: route.summary_translations as Record<string, string> | null,
      targetLang,
      column: 'summary_translations',
    }).then((s) => { route.summary = s }),
  ])

  const stopsQuery = `
    SELECT ${STOPS_SELECT.replace(/\$LOCALE\$/g, '$2')}
    ${STOPS_FROM.replace(/\$LOCALE\$/g, '$2')}
    WHERE crs.route_id = $1
    ORDER BY crs.stop_order ASC`

  const { rows: stopRows } = await db.query<Record<string, unknown>>(stopsQuery, [id, locale])

  return buildRouteWithStops(routeRows[0], stopRows)
}

// ─── countActiveByCity ──────────────────────────────────────────────────────

export async function countActiveByCity(
  citySlug: string,
): Promise<{ total: number; editorial: number; sponsored: number }> {
  const { rows } = await db.query<{ route_type: string; cnt: string }>(
    `SELECT route_type, COUNT(*)::int AS cnt
     FROM   curated_routes
     WHERE  city_slug = $1
       AND  is_active = true
       AND  expires_at > now()
     GROUP  BY route_type`,
    [citySlug],
  )

  let editorial = 0
  let sponsored = 0
  for (const row of rows) {
    if (row.route_type === 'editorial') editorial = Number(row.cnt)
    if (row.route_type === 'sponsored') sponsored = Number(row.cnt)
  }

  return { total: editorial + sponsored, editorial, sponsored }
}

// ─── createCuratedRoute ─────────────────────────────────────────────────────

/**
 * Translate canonical PT text to EN + ES, returning a `{ en, es }` map.
 * The PT canonical lives in the raw column, so we don't store a `pt` key.
 * Non-blocking — partial failures are silently dropped, and the read path
 * (resolveLocalizedRouteField) will lazy-translate on demand.
 *
 * Was previously translating from `'en'` to `'pt'`/`'es'`, which produced
 * garbage after the canonical-locale switch (commit e7b09d4) and left
 * `title_translations.en` empty for every new route — the bug that caused
 * EN users to see PT route titles in the routes list.
 */
async function translateToLocales(text: string | null): Promise<Record<string, string>> {
  if (!text || !text.trim()) return {}
  const result: Record<string, string> = {}
  for (const target of ['en', 'es'] as const) {
    try {
      result[target] = await translateText(text, target, CANONICAL_LOCALE)
    } catch {
      // Non-fatal — read path will retry lazily.
    }
  }
  return result
}

export async function createCuratedRoute(route: {
  citySlug: string
  routeType: 'editorial' | 'sponsored'
  templateType: string | null
  sponsorPlaceId: string | null
  title: string
  summary: string | null
  startsAt?: Date
  expiresAt: Date
  purchaseId?: string | null
  stops: Array<{ placeId: string; stopOrder: number; editorialNote: string | null }>
}): Promise<{ id: string }> {
  // Translate title + summary to PT/ES before inserting
  const titleTranslations = await translateToLocales(route.title)
  const summaryTranslations = await translateToLocales(route.summary)
  const noteTranslations: Record<string, string>[] = []
  for (const stop of route.stops) {
    noteTranslations.push(await translateToLocales(stop.editorialNote))
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO curated_routes
         (city_slug, route_type, template_type, sponsor_place_id, title, summary,
          title_translations, summary_translations,
          starts_at, expires_at, purchase_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, now()), $10, $11, true)
       RETURNING id`,
      [
        route.citySlug,
        route.routeType,
        route.templateType,
        route.sponsorPlaceId,
        route.title,
        route.summary,
        JSON.stringify(titleTranslations),
        JSON.stringify(summaryTranslations),
        route.startsAt ?? null,
        route.expiresAt,
        route.purchaseId ?? null,
      ],
    )

    const routeId = rows[0].id

    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i]
      await client.query(
        `INSERT INTO curated_route_stops (route_id, place_id, stop_order, editorial_note, note_translations)
         VALUES ($1, $2, $3, $4, $5)`,
        [routeId, stop.placeId, stop.stopOrder, stop.editorialNote, JSON.stringify(noteTranslations[i] ?? {})],
      )
    }

    await client.query('COMMIT')
    return { id: routeId }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── deactivateRoute ────────────────────────────────────────────────────────

export async function deactivateRoute(id: string): Promise<void> {
  await db.query(
    `UPDATE curated_routes SET is_active = false WHERE id = $1`,
    [id],
  )
}

// ─── deactivateExpiredRoutes ────────────────────────────────────────────────

export async function deactivateExpiredRoutes(): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE curated_routes
     SET    is_active = false
     WHERE  expires_at < now()
       AND  is_active = true`,
  )
  return rowCount ?? 0
}

// ─── findEditorialToDisplace ────────────────────────────────────────────────

export async function findEditorialToDisplace(citySlug: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id
     FROM   curated_routes
     WHERE  city_slug = $1
       AND  route_type = 'editorial'
       AND  is_active = true
     ORDER  BY created_at ASC
     LIMIT  1`,
    [citySlug],
  )
  return rows[0]?.id ?? null
}

// ─── getAdminCuratedRoutes ──────────────────────────────────────────────────

export async function getAdminCuratedRoutes(filters?: {
  citySlug?: string
  routeType?: string
  isActive?: boolean
}): Promise<AdminCuratedRouteRow[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (filters?.citySlug) {
    conditions.push(`cr.city_slug = $${i++}`)
    params.push(filters.citySlug)
  }
  if (filters?.routeType) {
    conditions.push(`cr.route_type = $${i++}`)
    params.push(filters.routeType)
  }
  if (filters?.isActive !== undefined) {
    conditions.push(`cr.is_active = $${i++}`)
    params.push(filters.isActive)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows } = await db.query<AdminCuratedRouteRow>(
    `SELECT
       cr.id,
       cr.city_slug,
       cr.route_type,
       cr.template_type,
       cr.sponsor_place_id,
       cr.title,
       cr.summary,
       cr.starts_at,
       cr.expires_at,
       cr.is_active,
       cr.created_at,
       (SELECT COUNT(*)::int FROM curated_route_stops s WHERE s.route_id = cr.id) AS stop_count
     FROM curated_routes cr
     ${where}
     ORDER BY cr.created_at DESC`,
    params,
  )
  return rows
}

// ─── updateCuratedRoute ─────────────────────────────────────────────────────

export async function updateCuratedRoute(
  id: string,
  data: {
    title?: string
    summary?: string | null
    stops?: Array<{ placeId: string; stopOrder: number; editorialNote: string | null }>
  },
): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Update route fields. When title/summary changes we also reset the
    // matching `*_translations` JSONB to '{}', so the read path's lazy
    // translation regenerates them from the new canonical text instead of
    // serving stale EN/ES translations that no longer match.
    const sets: string[] = []
    const params: unknown[] = []
    let i = 1
    if (data.title !== undefined) {
      sets.push(`title = $${i++}`); params.push(data.title)
      sets.push(`title_translations = '{}'::jsonb`)
    }
    if (data.summary !== undefined) {
      sets.push(`summary = $${i++}`); params.push(data.summary)
      sets.push(`summary_translations = '{}'::jsonb`)
    }
    if (sets.length > 0) {
      sets.push('updated_at = now()')
      params.push(id)
      await client.query(`UPDATE curated_routes SET ${sets.join(', ')} WHERE id = $${i}`, params)
    }

    // Replace stops if provided
    if (data.stops) {
      await client.query('DELETE FROM curated_route_stops WHERE route_id = $1', [id])
      for (const stop of data.stops) {
        await client.query(
          `INSERT INTO curated_route_stops (route_id, place_id, stop_order, editorial_note)
           VALUES ($1, $2, $3, $4)`,
          [id, stop.placeId, stop.stopOrder, stop.editorialNote],
        )
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── isPlaceInActiveRoute ───────────────────────────────────────────────────

export async function isPlaceInActiveRoute(placeId: string): Promise<boolean> {
  const { rows } = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM   curated_route_stops crs
       JOIN   curated_routes cr ON cr.id = crs.route_id
       WHERE  crs.place_id = $1
         AND  cr.is_active = true
         AND  cr.expires_at > now()
     ) AS exists`,
    [placeId],
  )
  return rows[0]?.exists ?? false
}
