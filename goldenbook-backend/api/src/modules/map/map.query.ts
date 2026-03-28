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
  categorySlug?: string,
  limit = 200,
): Promise<MapPlaceRow[]> {
  // Optional category filter via EXISTS — avoids changing JOIN cardinality
  const categoryClause = categorySlug
    ? `AND EXISTS (
        SELECT 1 FROM place_categories pc2
        JOIN categories c2 ON c2.id = pc2.category_id
        WHERE pc2.place_id = p.id AND c2.slug = $3
      )`
    : ''

  const params: unknown[] = categorySlug
    ? [citySlug, limit, categorySlug]
    : [citySlug, limit]

  const { rows } = await db.query<MapPlaceRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(pt.name, p.name)                                            AS name,
      p.latitude::text                                                      AS latitude,
      p.longitude::text                                                     AS longitude,
      p.place_type,
      COALESCE(
        ARRAY_AGG(DISTINCT c.slug) FILTER (WHERE c.slug IS NOT NULL),
        ARRAY[]::text[]
      )                                                                     AS category_slugs,
      d.name                                                                AS city_name,
      hero_img.bucket                                                       AS hero_bucket,
      hero_img.path                                                         AS hero_path
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = 'en'
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
    GROUP BY p.id, p.slug, p.name, p.latitude, p.longitude, p.place_type, pt.name,
             d.name, hero_img.bucket, hero_img.path
    ORDER BY p.featured DESC, p.published_at DESC NULLS LAST
    LIMIT $2
    `,
    params,
  )
  return rows
}