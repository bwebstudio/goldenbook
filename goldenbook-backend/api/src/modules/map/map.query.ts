import { db } from '../../db/postgres'

export interface MapPlaceRow {
  id: string
  slug: string
  name: string
  latitude: string
  longitude: string
  place_type: string
  category_slugs: string[]
  city_name: string
  hero_bucket: string | null
  hero_path: string | null
}

export async function getMapPlaces(
  citySlug: string,
  locale: string,
  categorySlug?: string,
  limit = 200,
): Promise<MapPlaceRow[]> {
  // Optional category filter via EXISTS — avoids changing JOIN cardinality
  const categoryClause = categorySlug
    ? `AND EXISTS (
        SELECT 1 FROM place_categories pc2
        JOIN categories c2 ON c2.id = pc2.category_id
        WHERE pc2.place_id = p.id AND c2.slug = $4
      )`
    : ''

  const params: unknown[] = categorySlug
    ? [citySlug, locale, limit, categorySlug]
    : [citySlug, locale, limit]

  const { rows } = await db.query<MapPlaceRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(NULLIF(pt.name,''), NULLIF(pt_lang.name,''), NULLIF(pt_fb.name,''), p.name)                  AS name,
      p.latitude::text                                                      AS latitude,
      p.longitude::text                                                     AS longitude,
      p.place_type,
      COALESCE(
        ARRAY_AGG(DISTINCT c.slug) FILTER (WHERE c.slug IS NOT NULL),
        ARRAY[]::text[]
      )                                                                     AS category_slugs,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name)                  AS city_name,
      hero_img.bucket                                                       AS hero_bucket,
      hero_img.path                                                         AS hero_path
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_lang
           ON pt_lang.place_id = p.id AND pt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    LEFT JOIN place_categories pc ON pc.place_id = p.id
    LEFT JOIN categories c        ON c.id = pc.category_id AND c.is_active = true
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
      AND p.latitude  IS NOT NULL
      AND p.longitude IS NOT NULL
      ${categoryClause}
    GROUP BY p.id, p.slug, p.name, p.latitude, p.longitude, p.place_type,
             pt.name, pt_lang.name, pt_fb.name,
             dt.name, dt_lang.name, dt_fb.name, d.name,
             hero_img.bucket, hero_img.path
    ORDER BY p.featured DESC, p.published_at DESC NULLS LAST
    LIMIT $3
    `,
    params,
  )
  return rows
}
