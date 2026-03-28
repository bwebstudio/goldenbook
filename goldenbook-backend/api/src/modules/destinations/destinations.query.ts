import { db } from '../../db/postgres'

export interface DestinationRow {
  slug: string
  name: string
  hero_bucket: string | null
  hero_path: string | null
}

export async function getDestinations(locale: string = 'en'): Promise<DestinationRow[]> {
  const { rows } = await db.query<DestinationRow>(
    `
    SELECT
      d.slug,
      COALESCE(dt.name, dt_fb.name, d.name) AS name,
      ma.bucket                              AS hero_bucket,
      ma.path                                AS hero_path
    FROM destinations d
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $1
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    LEFT JOIN media_assets ma
           ON ma.id = d.hero_image_asset_id
    WHERE d.is_active = true
    ORDER BY d.sort_order ASC, d.created_at ASC
    `,
    [locale],
  )
  return rows
}
