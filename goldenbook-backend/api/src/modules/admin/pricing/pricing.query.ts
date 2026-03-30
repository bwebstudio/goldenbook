import { db } from '../../../db/postgres'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PricingPlanRow {
  id: string
  pricing_type: string
  placement_type: string | null
  city: string | null
  position: number | null
  slot: string | null
  unit_label: string
  unit_days: number
  base_price: string // numeric comes as string from pg
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SeasonRuleRow {
  id: string
  city: string
  season_name: string
  month_from: number
  month_to: number
  multiplier: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CityMultiplierRow {
  id: string
  city: string
  multiplier: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PromotionRow {
  id: string
  name: string
  discount_pct: string
  label: string
  applies_to: string
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Pricing Plans ───────────────────────────────────────────────────────────

export async function getAllPricingPlans(): Promise<PricingPlanRow[]> {
  const { rows } = await db.query<PricingPlanRow>(
    `SELECT * FROM pricing_plans ORDER BY pricing_type, placement_type, position`
  )
  return rows
}

export async function getActivePricingPlans(): Promise<PricingPlanRow[]> {
  const { rows } = await db.query<PricingPlanRow>(
    `SELECT * FROM pricing_plans WHERE is_active = true ORDER BY pricing_type, placement_type, position`
  )
  return rows
}

export async function getPricingPlanById(id: string): Promise<PricingPlanRow | null> {
  const { rows } = await db.query<PricingPlanRow>(
    `SELECT * FROM pricing_plans WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function updatePricingPlan(
  id: string,
  data: { base_price?: number; unit_label?: string; unit_days?: number; is_active?: boolean },
): Promise<PricingPlanRow | null> {
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  if (data.base_price !== undefined) { sets.push(`base_price = $${i++}`); params.push(data.base_price) }
  if (data.unit_label !== undefined) { sets.push(`unit_label = $${i++}`); params.push(data.unit_label) }
  if (data.unit_days !== undefined) { sets.push(`unit_days = $${i++}`); params.push(data.unit_days) }
  if (data.is_active !== undefined) { sets.push(`is_active = $${i++}`); params.push(data.is_active) }

  if (sets.length === 0) return getPricingPlanById(id)

  sets.push('updated_at = now()')
  params.push(id)

  const { rows } = await db.query<PricingPlanRow>(
    `UPDATE pricing_plans SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  )
  return rows[0] ?? null
}

export async function createPricingPlan(data: {
  pricing_type: string
  placement_type?: string | null
  city?: string | null
  position?: number | null
  slot?: string | null
  unit_label: string
  unit_days: number
  base_price: number
}): Promise<PricingPlanRow> {
  const { rows } = await db.query<PricingPlanRow>(
    `INSERT INTO pricing_plans (pricing_type, placement_type, city, position, slot, unit_label, unit_days, base_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [data.pricing_type, data.placement_type ?? null, data.city ?? null, data.position ?? null, data.slot ?? null, data.unit_label, data.unit_days, data.base_price],
  )
  return rows[0]
}

export async function deletePricingPlan(id: string): Promise<boolean> {
  const { rowCount } = await db.query(`DELETE FROM pricing_plans WHERE id = $1`, [id])
  return (rowCount ?? 0) > 0
}

// ─── Season Rules ────────────────────────────────────────────────────────────

export async function getAllSeasonRules(): Promise<SeasonRuleRow[]> {
  const { rows } = await db.query<SeasonRuleRow>(
    `SELECT * FROM season_rules ORDER BY city, month_from`
  )
  return rows
}

export async function getActiveSeasonRules(): Promise<SeasonRuleRow[]> {
  const { rows } = await db.query<SeasonRuleRow>(
    `SELECT * FROM season_rules WHERE is_active = true ORDER BY city, month_from`
  )
  return rows
}

export async function updateSeasonRule(
  id: string,
  data: { multiplier?: number; month_from?: number; month_to?: number; season_name?: string; is_active?: boolean },
): Promise<SeasonRuleRow | null> {
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  if (data.multiplier !== undefined) { sets.push(`multiplier = $${i++}`); params.push(data.multiplier) }
  if (data.month_from !== undefined) { sets.push(`month_from = $${i++}`); params.push(data.month_from) }
  if (data.month_to !== undefined) { sets.push(`month_to = $${i++}`); params.push(data.month_to) }
  if (data.season_name !== undefined) { sets.push(`season_name = $${i++}`); params.push(data.season_name) }
  if (data.is_active !== undefined) { sets.push(`is_active = $${i++}`); params.push(data.is_active) }

  if (sets.length === 0) return null

  sets.push('updated_at = now()')
  params.push(id)

  const { rows } = await db.query<SeasonRuleRow>(
    `UPDATE season_rules SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  )
  return rows[0] ?? null
}

export async function createSeasonRule(data: {
  city: string
  season_name: string
  month_from: number
  month_to: number
  multiplier: number
}): Promise<SeasonRuleRow> {
  const { rows } = await db.query<SeasonRuleRow>(
    `INSERT INTO season_rules (city, season_name, month_from, month_to, multiplier)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.city, data.season_name, data.month_from, data.month_to, data.multiplier],
  )
  return rows[0]
}

export async function deleteSeasonRule(id: string): Promise<boolean> {
  const { rowCount } = await db.query(`DELETE FROM season_rules WHERE id = $1`, [id])
  return (rowCount ?? 0) > 0
}

// ─── City Multipliers ────────────────────────────────────────────────────────

export async function getAllCityMultipliers(): Promise<CityMultiplierRow[]> {
  const { rows } = await db.query<CityMultiplierRow>(
    `SELECT * FROM city_multipliers ORDER BY city`
  )
  return rows
}

export async function updateCityMultiplier(
  id: string,
  data: { multiplier?: number; is_active?: boolean },
): Promise<CityMultiplierRow | null> {
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  if (data.multiplier !== undefined) { sets.push(`multiplier = $${i++}`); params.push(data.multiplier) }
  if (data.is_active !== undefined) { sets.push(`is_active = $${i++}`); params.push(data.is_active) }

  if (sets.length === 0) return null

  sets.push('updated_at = now()')
  params.push(id)

  const { rows } = await db.query<CityMultiplierRow>(
    `UPDATE city_multipliers SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  )
  return rows[0] ?? null
}

// ─── Promotions ──────────────────────────────────────────────────────────────

export async function getAllPromotions(): Promise<PromotionRow[]> {
  const { rows } = await db.query<PromotionRow>(
    `SELECT * FROM promotions ORDER BY created_at DESC`
  )
  return rows
}

export async function getActivePromotion(planType?: string): Promise<PromotionRow | null> {
  const { rows } = await db.query<PromotionRow>(
    `SELECT * FROM promotions
     WHERE is_active = true
       AND valid_from <= now()
       AND (valid_until IS NULL OR valid_until >= now())
       AND (applies_to = 'all' OR applies_to = $1)
     ORDER BY discount_pct DESC
     LIMIT 1`,
    [planType ?? 'all'],
  )
  return rows[0] ?? null
}

export async function updatePromotion(
  id: string,
  data: { discount_pct?: number; label?: string; valid_until?: string; is_active?: boolean },
): Promise<PromotionRow | null> {
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  if (data.discount_pct !== undefined) { sets.push(`discount_pct = $${i++}`); params.push(data.discount_pct) }
  if (data.label !== undefined) { sets.push(`label = $${i++}`); params.push(data.label) }
  if (data.valid_until !== undefined) { sets.push(`valid_until = $${i++}`); params.push(data.valid_until) }
  if (data.is_active !== undefined) { sets.push(`is_active = $${i++}`); params.push(data.is_active) }

  if (sets.length === 0) return null

  sets.push('updated_at = now()')
  params.push(id)

  const { rows } = await db.query<PromotionRow>(
    `UPDATE promotions SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  )
  return rows[0] ?? null
}

export async function createPromotion(data: {
  name: string
  discount_pct: number
  label: string
  applies_to: string
  valid_from: string
  valid_until: string | null
}): Promise<PromotionRow> {
  const { rows } = await db.query<PromotionRow>(
    `INSERT INTO promotions (name, discount_pct, label, applies_to, valid_from, valid_until)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.name, data.discount_pct, data.label, data.applies_to, data.valid_from, data.valid_until],
  )
  return rows[0]
}

// ─── Price Computation ───────────────────────────────────────────────────────

/**
 * Get the season multiplier for a city in a given month.
 */
export async function getSeasonMultiplier(city: string, month: number): Promise<{ multiplier: number; seasonName: string | null }> {
  const rules = await getActiveSeasonRules()
  const cityRules = rules.filter((r) => r.city === city)

  for (const rule of cityRules) {
    const from = rule.month_from
    const to = rule.month_to
    const matches = from <= to
      ? (month >= from && month <= to)
      : (month >= from || month <= to)

    if (matches) {
      return { multiplier: parseFloat(rule.multiplier), seasonName: rule.season_name }
    }
  }

  return { multiplier: 1.0, seasonName: null }
}

/**
 * Get the city index multiplier.
 */
export async function getCityMultiplier(city: string): Promise<number> {
  const all = await getAllCityMultipliers()
  const row = all.find((c) => c.city === city && c.is_active)
  return row ? parseFloat(row.multiplier) : 1.0
}

/**
 * Full price computation:
 *   finalPrice = baseLisboaPrice × cityMultiplier × seasonMultiplier
 *   promoPrice = finalPrice × (1 - discount_pct/100)
 */
export async function computePrice(planId: string, city?: string, month?: number): Promise<{
  basePrice: number
  cityMultiplier: number
  seasonMultiplier: number
  seasonName: string | null
  fullPrice: number
  promoDiscount: number
  promoLabel: string | null
  promoValidUntil: string | null
  finalPrice: number
} | null> {
  const plan = await getPricingPlanById(planId)
  if (!plan) return null

  const basePrice = parseFloat(plan.base_price)

  // Membership: no city or season logic
  if (plan.pricing_type === 'membership') {
    const promo = await getActivePromotion('membership')
    const discount = promo ? parseFloat(promo.discount_pct) : 0
    const finalPrice = Math.round(basePrice * (1 - discount / 100) * 100) / 100
    return {
      basePrice,
      cityMultiplier: 1.0,
      seasonMultiplier: 1.0,
      seasonName: null,
      fullPrice: basePrice,
      promoDiscount: discount,
      promoLabel: promo?.label ?? null,
      promoValidUntil: promo?.valid_until ?? null,
      finalPrice,
    }
  }

  const targetCity = city ?? 'lisbon'
  const targetMonth = month ?? new Date().getMonth() + 1

  const cityMult = await getCityMultiplier(targetCity)
  const { multiplier: seasonMult, seasonName } = await getSeasonMultiplier(targetCity, targetMonth)

  const fullPrice = Math.round(basePrice * cityMult * seasonMult * 100) / 100

  const promo = await getActivePromotion(plan.pricing_type)
  const discount = promo ? parseFloat(promo.discount_pct) : 0
  const finalPrice = Math.round(fullPrice * (1 - discount / 100) * 100) / 100

  return {
    basePrice,
    cityMultiplier: cityMult,
    seasonMultiplier: seasonMult,
    seasonName,
    fullPrice,
    promoDiscount: discount,
    promoLabel: promo?.label ?? null,
    promoValidUntil: promo?.valid_until ?? null,
    finalPrice,
  }
}
