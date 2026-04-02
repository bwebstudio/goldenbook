import { db } from '../../db/postgres'

export interface Recommendation {
  rule: string              // rule id: no_active, combine_intent, high_demand, fully_booked, renew, time_bucket, best_section, low_competition
  type: 'performance' | 'demand' | 'timing' | 'opportunity'
  section?: string          // placement_type
  value?: number            // numeric value (revenue, pct, count)
  extra?: string            // additional data (time_bucket name, date, campaign name)
  action?: string           // 'promote' if actionable
}

export async function getPlaceRecommendations(placeId: string): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = []

  const [purchaseData, visibilityData, bestSections, inventoryData, timeBucketData, placeRevenue] = await Promise.all([
    db.query<{ placement_type: string; status: string; final_price: string }>(`
      SELECT placement_type, status, final_price::text
      FROM purchases WHERE place_id = $1 AND placement_type IS NOT NULL
      ORDER BY created_at DESC
    `, [placeId]).catch(() => ({ rows: [] as never[] })),

    db.query<{ surface: string }>(`
      SELECT surface FROM place_visibility
      WHERE place_id = $1 AND is_active = true AND ends_at > now()
    `, [placeId]).catch(() => ({ rows: [] as { surface: string }[] })),

    db.query<{ placement_type: string; count: string; revenue: string }>(`
      SELECT placement_type, COUNT(*)::text AS count, SUM(final_price::numeric)::text AS revenue
      FROM purchases WHERE status IN ('paid', 'activated', 'expired') AND placement_type IS NOT NULL
      GROUP BY placement_type ORDER BY COUNT(*) DESC LIMIT 5
    `).catch(() => ({ rows: [] as { placement_type: string; count: string; revenue: string }[] })),

    db.query<{ campaign_name: string; section: string; available: string; total: string; end_date: string }>(`
      SELECT c.name AS campaign_name, c.section::text,
             COUNT(*) FILTER (WHERE ci.status = 'available')::text AS available,
             COUNT(*)::text AS total, c.end_date::text
      FROM campaigns c LEFT JOIN campaign_inventory ci ON ci.campaign_id = c.id
      WHERE c.status = 'active' AND c.end_date > now()
      GROUP BY c.id, c.name, c.section, c.end_date
    `).catch(() => ({ rows: [] as never[] })),

    db.query<{ time_bucket: string; sold: string; total: string }>(`
      SELECT time_bucket, COUNT(*) FILTER (WHERE status = 'sold')::text AS sold, COUNT(*)::text AS total
      FROM campaign_inventory GROUP BY time_bucket HAVING COUNT(*) > 0
      ORDER BY COUNT(*) FILTER (WHERE status = 'sold') DESC LIMIT 1
    `).catch(() => ({ rows: [] as { time_bucket: string; sold: string; total: string }[] })),

    db.query<{ placement_type: string; count: string }>(`
      SELECT placement_type, COUNT(*)::text AS count
      FROM purchases WHERE place_id = $1 AND status IN ('paid', 'activated', 'expired')
        AND placement_type IS NOT NULL
        AND placement_type NOT IN ('extra_images', 'extended_description', 'listing_premium_pack')
      GROUP BY placement_type ORDER BY COUNT(*) DESC LIMIT 1
    `, [placeId]).catch(() => ({ rows: [] as { placement_type: string; count: string }[] })),
  ])

  const activeSurfaces = new Set(visibilityData.rows.map((r) => r.surface))
  const hasActiveDiscover = ['golden_picks', 'now', 'hidden_spots', 'hidden_gems', 'new_on_goldenbook']
    .some((s) => activeSurfaces.has(s))

  // Rule: no active placements
  if (activeSurfaces.size === 0 && bestSections.rows.length > 0) {
    const top = bestSections.rows[0]
    recommendations.push({
      rule: 'no_active', type: 'opportunity',
      section: top.placement_type, value: parseInt(top.count), action: 'promote',
    })
  }

  // Rule: has discover but no intent
  if (hasActiveDiscover && !activeSurfaces.has('search_priority') && !activeSurfaces.has('category_featured')) {
    recommendations.push({
      rule: 'combine_intent', type: 'performance',
      section: 'search_priority', action: 'promote',
    })
  }

  // Rule: campaign nearly full (>80%)
  for (const inv of inventoryData.rows) {
    const available = parseInt(inv.available)
    const total = parseInt(inv.total)
    if (total === 0) continue
    const occupancy = Math.round(((total - available) / total) * 100)
    if (occupancy > 80 && available > 0) {
      recommendations.push({
        rule: 'high_demand', type: 'demand',
        section: inv.section, value: available, extra: inv.campaign_name, action: 'promote',
      })
      break
    }
  }

  // Rule: fully booked
  for (const inv of inventoryData.rows) {
    if (parseInt(inv.available) === 0 && parseInt(inv.total) > 0) {
      recommendations.push({
        rule: 'fully_booked', type: 'timing',
        section: inv.section, extra: inv.end_date,
      })
      break
    }
  }

  // Rule: renew expired
  if (activeSurfaces.size === 0 && purchaseData.rows.length > 0 && purchaseData.rows[0].status === 'expired') {
    recommendations.push({
      rule: 'renew', type: 'performance',
      section: purchaseData.rows[0].placement_type, action: 'promote',
    })
  }

  // Rule: best time_bucket
  if (timeBucketData.rows.length > 0) {
    const tb = timeBucketData.rows[0]
    const pct = parseInt(tb.total) > 0 ? Math.round((parseInt(tb.sold) / parseInt(tb.total)) * 100) : 0
    if (pct >= 40) {
      recommendations.push({
        rule: 'time_bucket', type: 'performance',
        extra: tb.time_bucket, value: pct, action: 'promote',
      })
    }
  }

  // Rule: best section for this place (by purchase count, not revenue)
  if (placeRevenue.rows.length > 0 && activeSurfaces.size > 0) {
    recommendations.push({
      rule: 'best_section', type: 'performance',
      section: placeRevenue.rows[0].placement_type,
      value: parseInt(placeRevenue.rows[0].count),
      action: 'promote',
    })
  }

  // Rule: low competition
  for (const inv of inventoryData.rows) {
    const total = parseInt(inv.total)
    if (total === 0) continue
    const occupancy = Math.round(((total - parseInt(inv.available)) / total) * 100)
    if (occupancy < 30 && occupancy > 0) {
      recommendations.push({
        rule: 'low_competition', type: 'opportunity',
        section: inv.section, value: occupancy, action: 'promote',
      })
      break
    }
  }

  // Deduplicate + max 3
  const seen = new Set<string>()
  return recommendations.filter((r) => {
    const key = `${r.rule}:${r.section ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 3)
}

export async function getAdminInsights(): Promise<{
  topSections: { section: string; revenue: number; count: number }[]
  topCities: { city: string; revenue: number; count: number }[]
  demandSignals: { section: string; demandScore: number }[]
  bestTimeBucket: { timeBucket: string; pct: number } | null
}> {
  const [sectionsResult, citiesResult, demandResult, timeBucketResult] = await Promise.all([
    db.query<{ section: string; revenue: string; count: string }>(`
      SELECT placement_type AS section, COALESCE(SUM(final_price::numeric), 0)::text AS revenue, COUNT(*)::text AS count
      FROM purchases WHERE status IN ('paid', 'activated', 'expired') AND placement_type IS NOT NULL
      GROUP BY placement_type ORDER BY SUM(final_price::numeric) DESC
    `).catch(() => ({ rows: [] as { section: string; revenue: string; count: string }[] })),

    db.query<{ city: string; revenue: string; count: string }>(`
      SELECT COALESCE(city, 'unknown') AS city, COALESCE(SUM(final_price::numeric), 0)::text AS revenue, COUNT(*)::text AS count
      FROM purchases WHERE status IN ('paid', 'activated', 'expired')
      GROUP BY city ORDER BY SUM(final_price::numeric) DESC
    `).catch(() => ({ rows: [] as { city: string; revenue: string; count: string }[] })),

    db.query<{ section: string; demand_score: string }>(`
      SELECT c.section::text,
             CASE WHEN COUNT(ci.*) > 0
               THEN ROUND(COUNT(*) FILTER (WHERE ci.status = 'sold')::numeric / COUNT(ci.*)::numeric * 100, 1)
               ELSE 0
             END::text AS demand_score
      FROM campaigns c LEFT JOIN campaign_inventory ci ON ci.campaign_id = c.id
      WHERE c.status = 'active' GROUP BY c.section ORDER BY demand_score DESC
    `).catch(() => ({ rows: [] as { section: string; demand_score: string }[] })),

    db.query<{ time_bucket: string; sold: string; total: string }>(`
      SELECT time_bucket, COUNT(*) FILTER (WHERE status = 'sold')::text AS sold, COUNT(*)::text AS total
      FROM campaign_inventory GROUP BY time_bucket HAVING COUNT(*) FILTER (WHERE status = 'sold') > 0
      ORDER BY COUNT(*) FILTER (WHERE status = 'sold') DESC LIMIT 1
    `).catch(() => ({ rows: [] as { time_bucket: string; sold: string; total: string }[] })),
  ])

  for (const d of demandResult.rows) {
    await db.query(`UPDATE campaigns SET demand_score = $2 WHERE section = $1 AND status = 'active'`, [d.section, parseFloat(d.demand_score)]).catch(() => {})
  }

  return {
    topSections: sectionsResult.rows.map((r) => ({ section: r.section, revenue: parseFloat(r.revenue), count: parseInt(r.count) })),
    topCities: citiesResult.rows.map((r) => ({ city: r.city, revenue: parseFloat(r.revenue), count: parseInt(r.count) })),
    demandSignals: demandResult.rows.map((r) => ({ section: r.section, demandScore: parseFloat(r.demand_score) })),
    bestTimeBucket: timeBucketResult.rows.length > 0 ? {
      timeBucket: timeBucketResult.rows[0].time_bucket,
      pct: parseInt(timeBucketResult.rows[0].total) > 0
        ? Math.round((parseInt(timeBucketResult.rows[0].sold) / parseInt(timeBucketResult.rows[0].total)) * 100) : 0,
    } : null,
  }
}
