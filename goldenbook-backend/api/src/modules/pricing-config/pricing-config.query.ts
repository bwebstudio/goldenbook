import { db } from '../../db/postgres'

export interface PricingConfigRow {
  id: string
  city: string | null
  product_type: string
  price: number
  currency: string
  duration_days: number
  max_slots: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getActivePricingConfigs(): Promise<PricingConfigRow[]> {
  const { rows } = await db.query<PricingConfigRow>(
    `SELECT * FROM pricing_config WHERE is_active = true ORDER BY product_type, city`
  )
  return rows
}

export async function getAllPricingConfigs(): Promise<PricingConfigRow[]> {
  const { rows } = await db.query<PricingConfigRow>(
    `SELECT * FROM pricing_config ORDER BY product_type, city`
  )
  return rows
}

export async function getPricingConfigById(id: string): Promise<PricingConfigRow | null> {
  const { rows } = await db.query<PricingConfigRow>(
    `SELECT * FROM pricing_config WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function updatePricingConfig(
  id: string,
  data: {
    price?: number
    duration_days?: number
    max_slots?: number | null
    is_active?: boolean
  },
): Promise<PricingConfigRow | null> {
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  if (data.price !== undefined) { sets.push(`price = $${i++}`); params.push(data.price) }
  if (data.duration_days !== undefined) { sets.push(`duration_days = $${i++}`); params.push(data.duration_days) }
  if (data.max_slots !== undefined) { sets.push(`max_slots = $${i++}`); params.push(data.max_slots) }
  if (data.is_active !== undefined) { sets.push(`is_active = $${i++}`); params.push(data.is_active) }

  if (sets.length === 0) return getPricingConfigById(id)

  sets.push('updated_at = now()')
  params.push(id)

  const { rows } = await db.query<PricingConfigRow>(
    `UPDATE pricing_config SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  )
  return rows[0] ?? null
}
