import { db } from '../../../db/postgres'
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors/AppError'
import type {
  CreateRouteInput,
  UpdateRouteInput,
  SetRoutePlacesInput,
  AdminRouteResponseDTO,
  AdminRoutePlaceDTO,
} from './admin-routes.dto'

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function resolveDestinationId(citySlug: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM destinations WHERE slug = $1 AND is_active = true LIMIT 1`,
    [citySlug],
  )
  if (!rows[0]) throw new ValidationError(`City not found: ${citySlug}`)
  return rows[0].id
}

function nullify(v: string | undefined): string | null {
  return v === undefined || v === '' ? null : v
}

// ─── Shared row type ───────────────────────────────────────────────────────────

interface AdminRouteRow {
  id:                         string
  slug:                       string
  title:                      string
  summary:                    string | null
  body:                       string | null
  route_type:                 string
  estimated_duration_minutes: number | null
  featured:                   boolean
  status:                     string
  city_slug:                  string
  city_name:                  string
  places_count:               number
  hero_bucket:                string | null
  hero_path:                  string | null
}

function rowToDTO(row: AdminRouteRow): AdminRouteResponseDTO {
  return {
    id:               row.id,
    slug:             row.slug,
    title:            row.title,
    summary:          row.summary,
    body:             row.body,
    routeType:        row.route_type,
    estimatedMinutes: row.estimated_duration_minutes,
    featured:         row.featured,
    status:           row.status,
    citySlug:         row.city_slug,
    cityName:         row.city_name,
    placesCount:      Number(row.places_count),
    heroImage:        { bucket: row.hero_bucket, path: row.hero_path },
  }
}

// ─── List all routes (no status filter — admin view) ───────────────────────────

export async function listAdminRoutes(): Promise<AdminRouteResponseDTO[]> {
  const { rows } = await db.query<AdminRouteRow>(
    `
    SELECT
      r.id,
      r.slug,
      COALESCE(rt.title,   r.title)   AS title,
      COALESCE(rt.summary, r.summary) AS summary,
      rt.body                         AS body,
      r.route_type,
      r.estimated_duration_minutes,
      r.featured,
      r.status,
      d.slug                          AS city_slug,
      d.name                          AS city_name,
      COUNT(rp.place_id)::int         AS places_count,
      ma.bucket                       AS hero_bucket,
      ma.path                         AS hero_path
    FROM routes r
    JOIN destinations d ON d.id = r.destination_id
    LEFT JOIN route_translations rt
           ON rt.route_id = r.id AND rt.locale = 'en'
    LEFT JOIN media_assets ma ON ma.id = r.cover_asset_id
    LEFT JOIN route_places rp ON rp.route_id = r.id
    GROUP BY
      r.id, r.slug, r.title, r.summary, r.route_type, r.estimated_duration_minutes,
      r.featured, r.status, r.published_at,
      d.slug, d.name,
      rt.title, rt.summary, rt.body,
      ma.bucket, ma.path
    ORDER BY r.featured DESC, r.published_at DESC NULLS LAST
    `,
  )
  return rows.map(rowToDTO)
}

// ─── Get single route by ID ────────────────────────────────────────────────────

export async function getAdminRouteById(id: string): Promise<AdminRouteResponseDTO | null> {
  const { rows } = await db.query<AdminRouteRow>(
    `
    SELECT
      r.id,
      r.slug,
      COALESCE(rt.title,   r.title)   AS title,
      COALESCE(rt.summary, r.summary) AS summary,
      rt.body                         AS body,
      r.route_type,
      r.estimated_duration_minutes,
      r.featured,
      r.status,
      d.slug                          AS city_slug,
      d.name                          AS city_name,
      COUNT(rp.place_id)::int         AS places_count,
      ma.bucket                       AS hero_bucket,
      ma.path                         AS hero_path
    FROM routes r
    JOIN destinations d ON d.id = r.destination_id
    LEFT JOIN route_translations rt
           ON rt.route_id = r.id AND rt.locale = 'en'
    LEFT JOIN media_assets ma ON ma.id = r.cover_asset_id
    LEFT JOIN route_places rp ON rp.route_id = r.id
    WHERE r.id = $1
    GROUP BY
      r.id, r.slug, r.title, r.summary, r.route_type, r.estimated_duration_minutes,
      r.featured, r.status,
      d.slug, d.name,
      rt.title, rt.summary, rt.body,
      ma.bucket, ma.path
    LIMIT 1
    `,
    [id],
  )
  return rows[0] ? rowToDTO(rows[0]) : null
}

// ─── Create route ──────────────────────────────────────────────────────────────

export async function createRoute(input: CreateRouteInput): Promise<AdminRouteResponseDTO> {
  const destinationId = await resolveDestinationId(input.citySlug)

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Slug uniqueness check
    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id FROM routes WHERE slug = $1 LIMIT 1`,
      [input.slug],
    )
    if (existing[0]) {
      throw new AppError(409, `Slug "${input.slug}" is already taken`, 'SLUG_CONFLICT')
    }

    // Insert route
    const { rows: inserted } = await client.query<{ id: string }>(
      `
      INSERT INTO routes (
        destination_id, slug, title, summary,
        route_type, estimated_duration_minutes, featured, status,
        published_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        CASE WHEN $8 = 'published' THEN now() ELSE NULL END
      )
      RETURNING id
      `,
      [
        destinationId,
        input.slug,
        input.title,
        nullify(input.summary),
        input.routeType ?? 'walking',
        input.estimatedMinutes ?? null,
        input.featured ?? false,
        input.status ?? 'draft',
      ],
    )
    const routeId = inserted[0].id

    // Upsert English translation (title + summary + body)
    await client.query(
      `
      INSERT INTO route_translations (route_id, locale, title, summary, body)
      VALUES ($1, 'en', $2, $3, $4)
      ON CONFLICT (route_id, locale) DO UPDATE SET
        title   = EXCLUDED.title,
        summary = EXCLUDED.summary,
        body    = EXCLUDED.body
      `,
      [routeId, input.title, nullify(input.summary), nullify(input.body)],
    )

    await client.query('COMMIT')

    const created = await getAdminRouteById(routeId)
    return created!
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Update route ──────────────────────────────────────────────────────────────

export async function updateRoute(
  routeId: string,
  input: UpdateRouteInput,
): Promise<AdminRouteResponseDTO> {
  const { rows: found } = await db.query<{ slug: string }>(
    `SELECT slug FROM routes WHERE id = $1 LIMIT 1`,
    [routeId],
  )
  if (!found[0]) throw new NotFoundError('Route')
  const existing = found[0]

  let destinationId: string | null = null
  if (input.citySlug) {
    destinationId = await resolveDestinationId(input.citySlug)
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Slug uniqueness check if slug is changing
    if (input.slug && input.slug !== existing.slug) {
      const { rows: slugCheck } = await client.query<{ id: string }>(
        `SELECT id FROM routes WHERE slug = $1 LIMIT 1`,
        [input.slug],
      )
      if (slugCheck[0]) {
        throw new AppError(409, `Slug "${input.slug}" is already taken`, 'SLUG_CONFLICT')
      }
    }

    // Dynamic SET clause
    const setClauses: string[] = []
    const params: unknown[]    = []
    let   i = 1

    function addField(column: string, value: unknown) {
      setClauses.push(`${column} = $${i++}`)
      params.push(value)
    }

    if (input.title            !== undefined) addField('title',                      input.title)
    if (input.slug             !== undefined) addField('slug',                       input.slug)
    if (destinationId          !== null)      addField('destination_id',             destinationId)
    if (input.summary          !== undefined) addField('summary',                    nullify(input.summary))
    if (input.routeType        !== undefined) addField('route_type',                 input.routeType)
    if (input.estimatedMinutes !== undefined) addField('estimated_duration_minutes', input.estimatedMinutes)
    if (input.featured         !== undefined) addField('featured',                   input.featured)

    if (input.status !== undefined) {
      addField('status', input.status)
      if (input.status === 'published') {
        setClauses.push(`published_at = COALESCE(published_at, now())`)
      }
    }

    if (setClauses.length > 0) {
      params.push(routeId)
      await client.query(
        `UPDATE routes SET ${setClauses.join(', ')} WHERE id = $${i}`,
        params,
      )
    }

    // Upsert translation if any text field changed
    const hasTranslationUpdate =
      input.title   !== undefined ||
      input.summary !== undefined ||
      input.body    !== undefined

    if (hasTranslationUpdate) {
      // Fetch current translation as fallback
      const { rows: ct } = await client.query<{
        title:   string | null
        summary: string | null
        body:    string | null
      }>(
        `SELECT title, summary, body
         FROM route_translations
         WHERE route_id = $1 AND locale = 'en'
         LIMIT 1`,
        [routeId],
      )
      const current = ct[0] ?? {}

      await client.query(
        `
        INSERT INTO route_translations (route_id, locale, title, summary, body)
        VALUES ($1, 'en', $2, $3, $4)
        ON CONFLICT (route_id, locale) DO UPDATE SET
          title   = EXCLUDED.title,
          summary = EXCLUDED.summary,
          body    = EXCLUDED.body
        `,
        [
          routeId,
          input.title   !== undefined ? input.title                       : (current.title ?? ''),
          input.summary !== undefined ? nullify(input.summary)            : current.summary,
          input.body    !== undefined ? nullify(input.body)               : current.body,
        ],
      )
    }

    await client.query('COMMIT')

    const updated = await getAdminRouteById(routeId)
    return updated!
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Archive route (soft delete — sets status = 'archived') ───────────────────

export async function archiveRoute(routeId: string): Promise<void> {
  const { rowCount } = await db.query(
    `UPDATE routes SET status = 'archived' WHERE id = $1`,
    [routeId],
  )
  if (!rowCount) throw new NotFoundError('Route')
}

// ─── Get route places (admin — no status filter on places) ────────────────────

export async function getAdminRoutePlaces(routeId: string): Promise<AdminRoutePlaceDTO[]> {
  const { rows } = await db.query<{
    id:           string
    slug:         string
    name:         string
    note:         string | null
    stay_minutes: number | null
    sort_order:   number
    hero_bucket:  string | null
    hero_path:    string | null
    city:         string | null
  }>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(pt.name, p.name) AS name,
      rp.note,
      rp.stay_minutes,
      rp.sort_order,
      hero_img.bucket           AS hero_bucket,
      hero_img.path             AS hero_path,
      d.name                    AS city
    FROM route_places rp
    JOIN places p ON p.id = rp.place_id
    JOIN destinations d ON d.id = p.destination_id
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = 'en'
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path
      FROM   place_images pi
      JOIN   media_assets ma ON ma.id = pi.asset_id
      WHERE  pi.place_id = p.id
        AND  pi.image_role IN ('hero', 'cover')
      ORDER  BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
      LIMIT  1
    ) hero_img ON true
    WHERE rp.route_id = $1
    ORDER BY rp.sort_order ASC
    `,
    [routeId],
  )
  return rows.map((row) => ({
    id:          row.id,
    slug:        row.slug,
    name:        row.name,
    note:        row.note,
    stayMinutes: row.stay_minutes,
    sortOrder:   row.sort_order,
    heroImage:   { bucket: row.hero_bucket, path: row.hero_path },
    city:        row.city,
  }))
}

// ─── Set route places (replace all stops at once) ─────────────────────────────

export async function setRoutePlaces(
  routeId: string,
  input: SetRoutePlacesInput,
): Promise<void> {
  const { rows: found } = await db.query<{ id: string }>(
    `SELECT id FROM routes WHERE id = $1 LIMIT 1`,
    [routeId],
  )
  if (!found[0]) throw new NotFoundError('Route')

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Delete all existing stops for this route
    await client.query(`DELETE FROM route_places WHERE route_id = $1`, [routeId])

    // Insert new stops in order
    for (const stop of input.places) {
      await client.query(
        `
        INSERT INTO route_places (route_id, place_id, sort_order, note, stay_minutes)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [routeId, stop.placeId, stop.sortOrder, stop.note ?? null, stop.stayMinutes ?? null],
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}