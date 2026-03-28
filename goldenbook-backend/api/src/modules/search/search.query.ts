import { db } from '../../db/postgres'

// ─── Places ───────────────────────────────────────────────────────────────────

export interface SearchPlaceRow {
  id: string
  slug: string
  name: string
  summary: string | null
  hero_bucket: string | null
  hero_path: string | null
}

export async function findPlaces(
  citySlug: string,
  locale: string,
  query: string,
  limit = 10,
): Promise<SearchPlaceRow[]> {
  const { rows } = await db.query<SearchPlaceRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(pt.name, pt_lang.name, pt_fb.name, p.name)                                        AS name,
      COALESCE(pt.short_description, pt_lang.short_description, pt_fb.short_description, p.short_description) AS summary,
      hero_img.bucket                                                                               AS hero_bucket,
      hero_img.path                                                                                 AS hero_path
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_lang
           ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path
      FROM   place_images pi
      JOIN   media_assets ma ON ma.id = pi.asset_id
      WHERE  pi.place_id = p.id
        AND  pi.image_role IN ('hero', 'cover')
      ORDER  BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
      LIMIT  1
    ) hero_img ON true
    WHERE p.status = 'published'
      AND (
        COALESCE(pt.name, pt_lang.name, pt_fb.name, p.name) ILIKE '%' || $3 || '%'
        OR COALESCE(pt.short_description, pt_lang.short_description, pt_fb.short_description, p.short_description) ILIKE '%' || $3 || '%'
      )
    ORDER BY p.featured DESC, p.published_at DESC NULLS LAST
    LIMIT $4
    `,
    [citySlug, locale, query, limit],
  )
  return rows
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export interface SearchRouteRow {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_bucket: string | null
  hero_path: string | null
}

export async function findRoutes(
  citySlug: string,
  locale: string,
  query: string,
  limit = 5,
): Promise<SearchRouteRow[]> {
  const { rows } = await db.query<SearchRouteRow>(
    `
    SELECT
      r.id,
      r.slug,
      COALESCE(rt.title,   rt_lang.title,   rt_fb.title,   r.title)     AS title,
      COALESCE(rt.summary, rt_lang.summary, rt_fb.summary, r.summary)   AS summary,
      ma.bucket                                                           AS hero_bucket,
      ma.path                                                             AS hero_path
    FROM routes r
    JOIN destinations d ON d.id = r.destination_id AND d.slug = $1
    LEFT JOIN route_translations rt
           ON rt.route_id = r.id AND rt.locale = $2
    LEFT JOIN route_translations rt_lang
           ON rt_lang.route_id = r.id AND rt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN route_translations rt_fb
           ON rt_fb.route_id = r.id AND rt_fb.locale = 'en'
    LEFT JOIN media_assets ma ON ma.id = r.cover_asset_id
    WHERE r.status = 'published'
      AND (
        COALESCE(rt.title, rt_lang.title, rt_fb.title, r.title) ILIKE '%' || $3 || '%'
        OR COALESCE(rt.summary, rt_lang.summary, rt_fb.summary, r.summary) ILIKE '%' || $3 || '%'
      )
    ORDER BY r.featured DESC, r.published_at DESC NULLS LAST
    LIMIT $4
    `,
    [citySlug, locale, query, limit],
  )
  return rows
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface SearchCategoryRow {
  id: string
  slug: string
  name: string
  icon_name: string | null
}

export async function findCategories(
  citySlug: string,
  locale: string,
  query: string,
  limit = 5,
): Promise<SearchCategoryRow[]> {
  const { rows } = await db.query<SearchCategoryRow>(
    `
    SELECT DISTINCT ON (c.sort_order, c.id)
      c.id,
      c.slug,
      COALESCE(ct.name, ct_lang.name, ct_fb.name, c.slug) AS name,
      c.icon_name
    FROM categories c
    JOIN place_categories pc ON pc.category_id = c.id
    JOIN places p            ON p.id = pc.place_id AND p.status = 'published'
    JOIN destinations d      ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN category_translations ct
           ON ct.category_id = c.id AND ct.locale = $2
    LEFT JOIN category_translations ct_lang
           ON ct_lang.category_id = c.id AND ct_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN category_translations ct_fb
           ON ct_fb.category_id = c.id AND ct_fb.locale = 'en'
    WHERE c.is_active = true
      AND COALESCE(ct.name, ct_lang.name, ct_fb.name, c.slug) ILIKE '%' || $3 || '%'
    ORDER BY c.sort_order ASC, c.id ASC
    LIMIT $4
    `,
    [citySlug, locale, query, limit],
  )
  return rows
}
