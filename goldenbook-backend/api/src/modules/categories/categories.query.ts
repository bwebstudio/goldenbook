import { db } from '../../db/postgres'

// ─── Category header ──────────────────────────────────────────────────────────

export interface CategoryHeaderRow {
  id: string
  slug: string
  name: string
  description: string | null
  icon_name: string | null
}

export async function getCategoryBySlug(
  slug: string,
  locale: string,
): Promise<CategoryHeaderRow | null> {
  const { rows } = await db.query<CategoryHeaderRow>(
    `
    SELECT
      c.id,
      c.slug,
      COALESCE(ct.name,        ct_lang.name,        ct_fb.name,        c.slug) AS name,
      COALESCE(ct.description, ct_lang.description, ct_fb.description)         AS description,
      c.icon_name
    FROM categories c
    LEFT JOIN category_translations ct
           ON ct.category_id = c.id AND ct.locale = $2
    LEFT JOIN category_translations ct_lang
           ON ct_lang.category_id = c.id AND ct_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN category_translations ct_fb
           ON ct_fb.category_id = c.id AND ct_fb.locale = 'en'
    WHERE c.slug = $1
      AND c.is_active = true
    LIMIT 1
    `,
    [slug, locale],
  )
  return rows[0] ?? null
}

// ─── Subcategory as top-level page ───────────────────────────────────────────

export async function getSubcategoryBySlug(
  slug: string,
  locale: string,
): Promise<CategoryHeaderRow | null> {
  const { rows } = await db.query<CategoryHeaderRow>(
    `
    SELECT
      s.id,
      s.slug,
      COALESCE(st.name, st_lang.name, st_fb.name, s.slug) AS name,
      NULL::text                                            AS description,
      NULL::text                                            AS icon_name
    FROM subcategories s
    LEFT JOIN subcategory_translations st
           ON st.subcategory_id = s.id AND st.locale = $2
    LEFT JOIN subcategory_translations st_lang
           ON st_lang.subcategory_id = s.id AND st_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN subcategory_translations st_fb
           ON st_fb.subcategory_id = s.id AND st_fb.locale = 'en'
    WHERE s.slug = $1
      AND s.is_active = true
    LIMIT 1
    `,
    [slug, locale],
  )
  return rows[0] ?? null
}

export async function getSubcategoryPlaces(
  subcategoryId: string,
  citySlug: string,
  locale: string,
  limit = 50,
): Promise<CategoryPlaceRow[]> {
  const { rows } = await db.query<CategoryPlaceRow>(
    `
    SELECT id, slug, name, summary, hero_bucket, hero_path, city_name
    FROM (
      SELECT DISTINCT ON (p.id)
        p.id,
        p.slug,
        COALESCE(pt.name, pt_lang.name, pt_fb.name, p.name)                                        AS name,
        COALESCE(pt.short_description, pt_lang.short_description, pt_fb.short_description, p.short_description) AS summary,
        hero_img.bucket                                                                              AS hero_bucket,
        hero_img.path                                                                                AS hero_path,
        COALESCE(dt.name, dt_lang.name, dt_fb.name, d.name)                                        AS city_name,
        pc.is_primary,
        pc.sort_order,
        p.featured
      FROM (
        SELECT DISTINCT ON (pc2.place_id) pc2.place_id, pc2.is_primary, pc2.sort_order
        FROM place_categories pc2
        WHERE pc2.subcategory_id = $1
        ORDER BY pc2.place_id, pc2.is_primary DESC, pc2.sort_order ASC
      ) pc
      JOIN places p       ON p.id = pc.place_id AND p.status = 'published'
      JOIN destinations d ON d.id = p.destination_id AND d.slug = $2
      LEFT JOIN destination_translations dt
             ON dt.destination_id = d.id AND dt.locale = $3
      LEFT JOIN destination_translations dt_lang
             ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($3, '-', 1) AND $3 LIKE '%-%'
      LEFT JOIN destination_translations dt_fb
             ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
      LEFT JOIN place_translations pt
             ON pt.place_id = p.id AND pt.locale = $3
      LEFT JOIN place_translations pt_lang
             ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($3, '-', 1) AND $3 LIKE '%-%'
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
      ORDER BY p.id
    ) uniq
    ORDER BY is_primary DESC, sort_order ASC, featured DESC
    LIMIT $4
    `,
    [subcategoryId, citySlug, locale, limit],
  )
  return rows
}

// ─── Subcategories ────────────────────────────────────────────────────────────

export interface SubcategoryRow {
  id: string
  slug: string
  name: string
}

export async function getCategorySubcategories(
  categoryId: string,
  locale: string,
): Promise<SubcategoryRow[]> {
  const { rows } = await db.query<SubcategoryRow>(
    `
    SELECT
      s.id,
      s.slug,
      COALESCE(st.name, st_lang.name, st_fb.name, s.slug) AS name
    FROM subcategories s
    LEFT JOIN subcategory_translations st
           ON st.subcategory_id = s.id AND st.locale = $2
    LEFT JOIN subcategory_translations st_lang
           ON st_lang.subcategory_id = s.id AND st_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN subcategory_translations st_fb
           ON st_fb.subcategory_id = s.id AND st_fb.locale = 'en'
    WHERE s.category_id = $1
      AND s.is_active = true
    ORDER BY s.sort_order ASC
    `,
    [categoryId, locale],
  )
  return rows
}

// ─── Places in category ───────────────────────────────────────────────────────

export interface CategoryPlaceRow {
  id: string
  slug: string
  name: string
  summary: string | null
  hero_bucket: string | null
  hero_path: string | null
  city_name: string
}

export async function getCategoryPlaces(
  categoryId: string,
  citySlug: string,
  locale: string,
  limit = 50,
): Promise<CategoryPlaceRow[]> {
  const { rows } = await db.query<CategoryPlaceRow>(
    `
    SELECT id, slug, name, summary, hero_bucket, hero_path, city_name
    FROM (
      SELECT DISTINCT ON (p.id)
        p.id,
        p.slug,
        COALESCE(pt.name, pt_lang.name, pt_fb.name, p.name)                                        AS name,
        COALESCE(pt.short_description, pt_lang.short_description, pt_fb.short_description, p.short_description) AS summary,
        hero_img.bucket                                                                              AS hero_bucket,
        hero_img.path                                                                                AS hero_path,
        COALESCE(dt.name, dt_lang.name, dt_fb.name, d.name)                                        AS city_name,
        pc.is_primary,
        pc.sort_order,
        p.featured
      FROM (
        SELECT DISTINCT ON (pc2.place_id) pc2.place_id, pc2.is_primary, pc2.sort_order
        FROM place_categories pc2
        WHERE pc2.category_id = $1
        ORDER BY pc2.place_id, pc2.is_primary DESC, pc2.sort_order ASC
      ) pc
      JOIN places p       ON p.id = pc.place_id AND p.status = 'published'
      JOIN destinations d ON d.id = p.destination_id AND d.slug = $2
      LEFT JOIN destination_translations dt
             ON dt.destination_id = d.id AND dt.locale = $3
      LEFT JOIN destination_translations dt_lang
             ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($3, '-', 1) AND $3 LIKE '%-%'
      LEFT JOIN destination_translations dt_fb
             ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
      LEFT JOIN place_translations pt
             ON pt.place_id = p.id AND pt.locale = $3
      LEFT JOIN place_translations pt_lang
             ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($3, '-', 1) AND $3 LIKE '%-%'
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
      ORDER BY p.id
    ) uniq
    ORDER BY is_primary DESC, sort_order ASC, featured DESC
    LIMIT $4
    `,
    [categoryId, citySlug, locale, limit],
  )
  return rows
}
