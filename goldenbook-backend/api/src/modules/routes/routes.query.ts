import { db } from '../../db/postgres'

// ─── Route list ────────────���──────────────────────────────────────────────────

export interface RouteListRow {
  id: string
  slug: string
  title: string
  summary: string | null
  route_type: string
  estimated_duration_minutes: number | null
  featured: boolean
  hero_bucket: string | null
  hero_path: string | null
  places_count: number
  city_slug: string
  city_name: string
}

export async function getRoutes(
  citySlug: string,
  locale: string,
  limit = 20,
  offset = 0,
): Promise<RouteListRow[]> {
  const { rows } = await db.query<RouteListRow>(
    `
    SELECT
      r.id,
      r.slug,
      COALESCE(NULLIF(rt.title,''),   NULLIF(rt_lang.title,''),   NULLIF(rt_fb.title,''),   r.title)         AS title,
      COALESCE(NULLIF(rt.summary,''), NULLIF(rt_lang.summary,''), NULLIF(rt_fb.summary,''), r.summary)       AS summary,
      r.route_type,
      r.estimated_duration_minutes,
      r.featured,
      ma.bucket                                                               AS hero_bucket,
      ma.path                                                                 AS hero_path,
      COUNT(rp.place_id)::int                                                AS places_count,
      d.slug                                                                  AS city_slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name)                   AS city_name
    FROM routes r
    JOIN destinations d ON d.id = r.destination_id AND d.slug = $1
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    LEFT JOIN route_translations rt
           ON rt.route_id = r.id AND rt.locale = $2
    LEFT JOIN route_translations rt_lang
           ON rt_lang.route_id = r.id AND rt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN route_translations rt_fb
           ON rt_fb.route_id = r.id AND rt_fb.locale = 'en'
    LEFT JOIN media_assets ma ON ma.id = r.cover_asset_id
    LEFT JOIN route_places rp ON rp.route_id = r.id
    WHERE r.status = 'published'
    GROUP BY
      r.id, r.slug, r.title, r.summary, r.route_type, r.estimated_duration_minutes,
      r.featured, r.published_at,
      rt.title, rt_lang.title, rt_fb.title,
      rt.summary, rt_lang.summary, rt_fb.summary,
      ma.bucket, ma.path,
      d.slug, dt.name, dt_lang.name, dt_fb.name, d.name
    ORDER BY r.featured DESC, r.published_at DESC NULLS LAST
    LIMIT $3 OFFSET $4
    `,
    [citySlug, locale, limit, offset],
  )
  return rows
}

// ─── Route detail ─────────────────────────────────────────────────────────────

export interface RouteDetailRow {
  id: string
  slug: string
  title: string
  summary: string | null
  body: string | null
  route_type: string
  estimated_duration_minutes: number | null
  featured: boolean
  hero_bucket: string | null
  hero_path: string | null
  city_slug: string
  city_name: string
}

export async function getRouteBySlug(
  slug: string,
  locale: string,
): Promise<RouteDetailRow | null> {
  const { rows } = await db.query<RouteDetailRow>(
    `
    SELECT
      r.id,
      r.slug,
      COALESCE(NULLIF(rt.title,''),   NULLIF(rt_lang.title,''),   NULLIF(rt_fb.title,''),   r.title)         AS title,
      COALESCE(NULLIF(rt.summary,''), NULLIF(rt_lang.summary,''), NULLIF(rt_fb.summary,''), r.summary)       AS summary,
      COALESCE(NULLIF(rt.body,''),    NULLIF(rt_lang.body,''),    NULLIF(rt_fb.body,''))                       AS body,
      r.route_type,
      r.estimated_duration_minutes,
      r.featured,
      ma.bucket                                                               AS hero_bucket,
      ma.path                                                                 AS hero_path,
      d.slug                                                                  AS city_slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name)                   AS city_name
    FROM routes r
    JOIN destinations d ON d.id = r.destination_id
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    LEFT JOIN route_translations rt
           ON rt.route_id = r.id AND rt.locale = $2
    LEFT JOIN route_translations rt_lang
           ON rt_lang.route_id = r.id AND rt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN route_translations rt_fb
           ON rt_fb.route_id = r.id AND rt_fb.locale = 'en'
    LEFT JOIN media_assets ma ON ma.id = r.cover_asset_id
    WHERE r.slug = $1
      AND r.status = 'published'
    LIMIT 1
    `,
    [slug, locale],
  )
  return rows[0] ?? null
}

// ─── Route places ─────────────────────────────────────────────────────────────

export interface RoutePlaceRow {
  id: string
  slug: string
  name: string
  short_description: string | null
  note: string | null
  stay_minutes: number | null
  sort_order: number
  hero_bucket: string | null
  hero_path: string | null
  address_line: string | null
  latitude: string | null
  longitude: string | null
}

export async function getRoutePlaces(
  routeId: string,
  locale: string,
): Promise<RoutePlaceRow[]> {
  const { rows } = await db.query<RoutePlaceRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name)          AS name,
      COALESCE(
        NULLIF(pt.short_description,''),
        NULLIF(pt_lang.short_description,''),
        NULLIF(pt_fb.short_description,''),
        p.short_description
      ) AS short_description,
      COALESCE(NULLIF(rpt.note,''), NULLIF(rpt_lang.note,''), rp.note)                    AS note,
      rp.stay_minutes,
      rp.sort_order,
      hero_img.bucket                                                AS hero_bucket,
      hero_img.path                                                  AS hero_path,
      p.address_line,
      p.latitude,
      p.longitude
    FROM route_places rp
    JOIN places p ON p.id = rp.place_id AND p.status = 'published'
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_lang
           ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    LEFT JOIN route_place_translations rpt
           ON rpt.route_id = rp.route_id AND rpt.place_id = rp.place_id AND rpt.locale = $2
    LEFT JOIN route_place_translations rpt_lang
           ON rpt_lang.route_id = rp.route_id AND rpt_lang.place_id = rp.place_id
          AND rpt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
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
    [routeId, locale],
  )
  return rows
}
