import { db } from '../../../db/postgres'

export interface AdminPlaceListRow {
  id: string
  slug: string
  name: string
  city_name: string
  category_slug: string | null
  status: string
  booking_enabled: boolean
  booking_mode: string
  reservation_relevant: boolean
  has_booking_link: boolean
  has_suggestion: boolean
  suggestion_relevant: boolean | null
  suggestion_mode: string | null
  suggestion_confidence: number | null
  suggestion_dismissed: boolean
  hero_bucket: string | null
  hero_path: string | null
}

const CORE_QUERY = `
  SELECT
    p.id, p.slug, p.name, d.name AS city_name,
    (SELECT c.slug FROM place_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.place_id = p.id AND pc.is_primary = true LIMIT 1) AS category_slug,
    p.status,
    hero_img.bucket AS hero_bucket,
    hero_img.path AS hero_path
  FROM places p
  JOIN destinations d ON d.id = p.destination_id
  LEFT JOIN LATERAL (
    SELECT ma.bucket, ma.path
    FROM place_images pi
    JOIN media_assets ma ON ma.id = pi.asset_id
    WHERE pi.place_id = p.id AND pi.image_role IN ('hero','cover')
    ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
    LIMIT 1
  ) hero_img ON true
  ORDER BY p.name ASC
`

const FULL_QUERY = `
  SELECT
    p.id, p.slug, p.name, d.name AS city_name,
    (SELECT c.slug FROM place_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.place_id = p.id AND pc.is_primary = true LIMIT 1) AS category_slug,
    p.status,
    p.booking_enabled,
    p.booking_mode::text AS booking_mode,
    p.reservation_relevant,
    (p.booking_url IS NOT NULL OR EXISTS (
      SELECT 1 FROM place_booking_candidates bc
      WHERE bc.place_id = p.id AND bc.is_active = true AND bc.candidate_url IS NOT NULL
    )) AS has_booking_link,
    (p.suggestion_generated_at IS NOT NULL) AS has_suggestion,
    p.suggestion_relevant,
    p.suggestion_mode,
    p.suggestion_confidence,
    p.suggestion_dismissed,
    hero_img.bucket AS hero_bucket,
    hero_img.path AS hero_path
  FROM places p
  JOIN destinations d ON d.id = p.destination_id
  LEFT JOIN LATERAL (
    SELECT ma.bucket, ma.path
    FROM place_images pi
    JOIN media_assets ma ON ma.id = pi.asset_id
    WHERE pi.place_id = p.id AND pi.image_role IN ('hero','cover')
    ORDER BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
    LIMIT 1
  ) hero_img ON true
  ORDER BY p.name ASC
`

export async function getAdminPlacesList(): Promise<AdminPlaceListRow[]> {
  try {
    const { rows } = await db.query<AdminPlaceListRow>(FULL_QUERY)
    return rows
  } catch {
    // Booking/suggestion columns don't exist yet — use core query with defaults
    const { rows } = await db.query<any>(CORE_QUERY)
    return rows.map((r: any) => ({
      ...r,
      booking_enabled: false,
      booking_mode: 'none',
      reservation_relevant: false,
      has_booking_link: false,
      has_suggestion: false,
      suggestion_relevant: null,
      suggestion_mode: null,
      suggestion_confidence: null,
      suggestion_dismissed: false,
    }))
  }
}
