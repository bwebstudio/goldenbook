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

// One set-based query for the whole list. The dashboard filters and searches
// client-side across every place, so this returns all rows and has to be cheap
// rather than paginated.
//
// The primary category and the hero image are resolved once for all places
// with DISTINCT ON + hash joins, instead of a correlated subquery and a
// LATERAL per row (two extra index probes x every place). EXPLAIN ANALYZE on
// production (363 places, warm cache): ~7 ms / ~4.1k buffer hits before,
// ~3.4 ms / ~1k after.
//
// There used to be a "full" variant selecting booking_mode / suggestion_*
// first and falling back to this one on error. Those columns were never
// created (only booking_enabled exists, see migration 20260629120000), so
// every list load paid for a failed query before running this. The fallback's
// output is what the dashboard has always shown, so it is now the only query
// and the derived booking/suggestion values below keep that exact behaviour.
const LIST_QUERY = `
  WITH primary_cat AS (
    SELECT DISTINCT ON (pc.place_id) pc.place_id, c.slug
    FROM place_categories pc
    JOIN categories c ON c.id = pc.category_id
    WHERE pc.is_primary = true
    ORDER BY pc.place_id, pc.sort_order ASC, pc.created_at ASC
  ),
  hero_img AS (
    SELECT DISTINCT ON (pi.place_id) pi.place_id, ma.bucket, ma.path
    FROM place_images pi
    JOIN media_assets ma ON ma.id = pi.asset_id
    WHERE pi.image_role IN ('hero','cover')
    ORDER BY pi.place_id, (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
  )
  SELECT
    p.id, p.slug, p.name, d.name AS city_name,
    primary_cat.slug AS category_slug,
    p.status,
    (p.booking_url IS NOT NULL AND p.booking_url LIKE 'http%') AS has_booking_link,
    hero_img.bucket AS hero_bucket,
    hero_img.path AS hero_path
  FROM places p
  JOIN destinations d ON d.id = p.destination_id
  LEFT JOIN primary_cat ON primary_cat.place_id = p.id
  LEFT JOIN hero_img    ON hero_img.place_id = p.id
  ORDER BY p.name ASC
`

type ListQueryRow = Pick<
  AdminPlaceListRow,
  'id' | 'slug' | 'name' | 'city_name' | 'category_slug' | 'status' | 'has_booking_link' | 'hero_bucket' | 'hero_path'
>

export async function getAdminPlacesList(): Promise<AdminPlaceListRow[]> {
  const { rows } = await db.query<ListQueryRow>(LIST_QUERY)
  return rows.map((r) => ({
    ...r,
    booking_enabled: r.has_booking_link ?? false,
    booking_mode: r.has_booking_link ? 'direct_website' : 'none',
    reservation_relevant: r.has_booking_link ?? false,
    has_booking_link: r.has_booking_link ?? false,
    has_suggestion: false,
    suggestion_relevant: null,
    suggestion_mode: null,
    suggestion_confidence: null,
    suggestion_dismissed: false,
  }))
}
