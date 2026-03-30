import { db } from '../../../db/postgres'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FunnelRow {
  key: string
  impressions: number
  clicks: number
  ctr: number
}

export interface PlaceFunnelRow extends FunnelRow {
  placeId: string
  placeName: string
  placeSlug: string
}

export interface AnalyticsSummary {
  totalImpressions: number
  totalClicks: number
  globalCtr: number
  byProvider: FunnelRow[]
  byMode: FunnelRow[]
  byCity: FunnelRow[]
  topPlaces: PlaceFunnelRow[]
  byCategory: FunnelRow[]
}

export interface AnalyticsFilter {
  days?: number
  provider?: string
  city?: string
  bookingMode?: string
}

// ─── Main query ──────────────────────────────────────────────────────────────

export async function getBookingAnalytics(filter: AnalyticsFilter = {}): Promise<AnalyticsSummary> {
  const days = Math.max(1, Math.min(filter.days ?? 30, 365))
  const since = `now() - interval '${days} days'`

  // Build optional WHERE fragments for filters
  const clickFilters: string[] = [`e.created_at >= ${since}`]
  const impFilters: string[] = [`e.created_at >= ${since}`]

  if (filter.provider) {
    clickFilters.push(`e.provider = '${filter.provider}'::booking_provider`)
    impFilters.push(`e.provider = '${filter.provider}'::booking_provider`)
  }
  if (filter.city) {
    const city = filter.city.trim().toLowerCase().replace(/\s+/g, '-')
    clickFilters.push(`e.city = '${city}'`)
    impFilters.push(`e.city = '${city}'`)
  }
  if (filter.bookingMode) {
    clickFilters.push(`e.booking_mode = '${filter.bookingMode}'`)
    impFilters.push(`e.booking_mode = '${filter.bookingMode}'`)
  }

  const clickWhere = clickFilters.join(' AND ')
  const impWhere = impFilters.join(' AND ')

  const [
    totalImpRes, totalClickRes,
    providerRes, modeRes, cityRes, placesRes, categoryRes,
  ] = await Promise.all([
    // Totals
    db.query<{ count: string }>(`SELECT count(*) FROM booking_impression_events e WHERE ${impWhere}`),
    db.query<{ count: string }>(`SELECT count(*) FROM booking_click_events e WHERE ${clickWhere}`),

    // By provider — join impressions and clicks
    db.query<{ key: string; impressions: string; clicks: string }>(`
      SELECT
        COALESCE(i.provider, c.provider) AS key,
        COALESCE(i.cnt, 0)::text AS impressions,
        COALESCE(c.cnt, 0)::text AS clicks
      FROM
        (SELECT provider::text, count(*) AS cnt FROM booking_impression_events e WHERE ${impWhere} GROUP BY provider) i
      FULL OUTER JOIN
        (SELECT provider::text, count(*) AS cnt FROM booking_click_events e WHERE ${clickWhere} GROUP BY provider) c
      ON i.provider = c.provider
      ORDER BY COALESCE(c.cnt, 0) DESC
    `),

    // By mode
    db.query<{ key: string; impressions: string; clicks: string }>(`
      SELECT
        COALESCE(i.booking_mode, c.booking_mode) AS key,
        COALESCE(i.cnt, 0)::text AS impressions,
        COALESCE(c.cnt, 0)::text AS clicks
      FROM
        (SELECT booking_mode, count(*) AS cnt FROM booking_impression_events e WHERE ${impWhere} GROUP BY booking_mode) i
      FULL OUTER JOIN
        (SELECT booking_mode, count(*) AS cnt FROM booking_click_events e WHERE ${clickWhere} GROUP BY booking_mode) c
      ON i.booking_mode = c.booking_mode
      ORDER BY COALESCE(c.cnt, 0) DESC
    `),

    // By city
    db.query<{ key: string; impressions: string; clicks: string }>(`
      SELECT
        COALESCE(i.city, c.city, 'unknown') AS key,
        COALESCE(i.cnt, 0)::text AS impressions,
        COALESCE(c.cnt, 0)::text AS clicks
      FROM
        (SELECT COALESCE(city, 'unknown') AS city, count(*) AS cnt FROM booking_impression_events e WHERE ${impWhere} GROUP BY city) i
      FULL OUTER JOIN
        (SELECT COALESCE(city, 'unknown') AS city, count(*) AS cnt FROM booking_click_events e WHERE ${clickWhere} GROUP BY city) c
      ON i.city = c.city
      ORDER BY COALESCE(c.cnt, 0) DESC
    `),

    // Top places
    db.query<{ place_id: string; place_name: string; place_slug: string; impressions: string; clicks: string }>(`
      SELECT
        COALESCE(i.place_id, c.place_id) AS place_id,
        p.name AS place_name,
        p.slug AS place_slug,
        COALESCE(i.cnt, 0)::text AS impressions,
        COALESCE(c.cnt, 0)::text AS clicks
      FROM
        (SELECT place_id, count(*) AS cnt FROM booking_impression_events e WHERE ${impWhere} GROUP BY place_id) i
      FULL OUTER JOIN
        (SELECT place_id, count(*) AS cnt FROM booking_click_events e WHERE ${clickWhere} GROUP BY place_id) c
      ON i.place_id = c.place_id
      JOIN places p ON p.id = COALESCE(i.place_id, c.place_id)
      ORDER BY COALESCE(c.cnt, 0) DESC
      LIMIT 20
    `),

    // By category (primary category of the place)
    db.query<{ key: string; impressions: string; clicks: string }>(`
      SELECT
        COALESCE(i.cat, c.cat, 'uncategorized') AS key,
        COALESCE(i.cnt, 0)::text AS impressions,
        COALESCE(c.cnt, 0)::text AS clicks
      FROM
        (SELECT (SELECT cat.slug FROM place_categories pc JOIN categories cat ON cat.id = pc.category_id WHERE pc.place_id = e.place_id AND pc.is_primary LIMIT 1) AS cat, count(*) AS cnt FROM booking_impression_events e WHERE ${impWhere} GROUP BY cat) i
      FULL OUTER JOIN
        (SELECT (SELECT cat.slug FROM place_categories pc JOIN categories cat ON cat.id = pc.category_id WHERE pc.place_id = e.place_id AND pc.is_primary LIMIT 1) AS cat, count(*) AS cnt FROM booking_click_events e WHERE ${clickWhere} GROUP BY cat) c
      ON i.cat = c.cat
      ORDER BY COALESCE(i.cnt, 0) + COALESCE(c.cnt, 0) DESC
    `),
  ])

  const totalImpressions = parseInt(totalImpRes.rows[0]?.count ?? '0', 10)
  const totalClicks = parseInt(totalClickRes.rows[0]?.count ?? '0', 10)

  function toFunnel(rows: { key: string; impressions: string; clicks: string }[]): FunnelRow[] {
    return rows.map(r => {
      const imp = parseInt(r.impressions, 10)
      const clk = parseInt(r.clicks, 10)
      return { key: r.key, impressions: imp, clicks: clk, ctr: imp > 0 ? Math.round((clk / imp) * 10000) / 10000 : 0 }
    })
  }

  return {
    totalImpressions,
    totalClicks,
    globalCtr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 10000 : 0,
    byProvider: toFunnel(providerRes.rows),
    byMode: toFunnel(modeRes.rows),
    byCity: toFunnel(cityRes.rows),
    topPlaces: placesRes.rows.map(r => {
      const imp = parseInt(r.impressions, 10)
      const clk = parseInt(r.clicks, 10)
      return {
        key: r.place_slug,
        placeId: r.place_id,
        placeName: r.place_name,
        placeSlug: r.place_slug,
        impressions: imp,
        clicks: clk,
        ctr: imp > 0 ? Math.round((clk / imp) * 10000) / 10000 : 0,
      }
    }),
    byCategory: toFunnel(categoryRes.rows),
  }
}
