import { db } from '../../db/postgres'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CampaignRow {
  id: string
  name: string
  section: string
  section_group: string
  city_id: string | null
  start_date: string
  end_date: string
  status: string
  slot_limit: number
  priority: number
  created_at: string
  updated_at: string
  // computed
  total_inventory?: number
  sold_inventory?: number
  available_inventory?: number
  city_name?: string
}

export interface CampaignSlotRow {
  id: string
  campaign_id: string
  place_id: string
  purchase_id: string | null
  inventory_id: string | null
  status: string
  starts_at: string
  ends_at: string
  created_at: string
  updated_at: string
  place_name?: string
}

export interface InventoryRow {
  id: string
  campaign_id: string
  position: number
  date: string
  time_bucket: string | null
  status: string
  purchase_id: string | null
  place_id: string | null
  created_at: string
}

// ─── Campaign CRUD ──────────────────────────────────────────────────────────

export async function getAllCampaigns(filters?: {
  status?: string
  section?: string
  section_group?: string
}): Promise<CampaignRow[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 0

  if (filters?.status) {
    conditions.push(`c.status = $${++idx}`)
    params.push(filters.status)
  }
  if (filters?.section) {
    conditions.push(`c.section = $${++idx}`)
    params.push(filters.section)
  }
  if (filters?.section_group) {
    conditions.push(`c.section_group = $${++idx}`)
    params.push(filters.section_group)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows } = await db.query<CampaignRow>(
    `SELECT c.*,
            d.name AS city_name,
            COALESCE(inv.total, 0)::int AS total_inventory,
            COALESCE(inv.sold, 0)::int AS sold_inventory,
            (COALESCE(inv.total, 0) - COALESCE(inv.sold, 0))::int AS available_inventory
     FROM campaigns c
     LEFT JOIN destinations d ON d.id = c.city_id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE ci.status = 'sold')::int AS sold
       FROM campaign_inventory ci
       WHERE ci.campaign_id = c.id
     ) inv ON true
     ${where}
     ORDER BY c.priority DESC, c.created_at DESC`,
    params,
  )
  return rows
}

export async function getCampaignById(id: string): Promise<CampaignRow | null> {
  const { rows } = await db.query<CampaignRow>(
    `SELECT c.*,
            d.name AS city_name,
            COALESCE(inv.total, 0)::int AS total_inventory,
            COALESCE(inv.sold, 0)::int AS sold_inventory,
            (COALESCE(inv.total, 0) - COALESCE(inv.sold, 0))::int AS available_inventory
     FROM campaigns c
     LEFT JOIN destinations d ON d.id = c.city_id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE ci.status = 'sold')::int AS sold
       FROM campaign_inventory ci
       WHERE ci.campaign_id = c.id
     ) inv ON true
     WHERE c.id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function createCampaign(data: {
  name: string
  section: string
  section_group: string
  city_id?: string | null
  start_date: string
  end_date: string
  status?: string
  slot_limit: number
  priority?: number
}): Promise<CampaignRow> {
  const { rows } = await db.query<CampaignRow>(
    `INSERT INTO campaigns (name, section, section_group, city_id, start_date, end_date, status, slot_limit, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.name,
      data.section,
      data.section_group,
      data.city_id ?? null,
      data.start_date,
      data.end_date,
      data.status ?? 'draft',
      data.slot_limit,
      data.priority ?? 0,
    ],
  )
  return rows[0]
}

export async function updateCampaign(
  id: string,
  data: Partial<{
    name: string
    section: string
    section_group: string
    city_id: string | null
    start_date: string
    end_date: string
    status: string
    slot_limit: number
    priority: number
  }>,
): Promise<CampaignRow | null> {
  const sets: string[] = []
  const params: unknown[] = []
  let idx = 0

  if (data.name !== undefined) { sets.push(`name = $${++idx}`); params.push(data.name) }
  if (data.section !== undefined) { sets.push(`section = $${++idx}`); params.push(data.section) }
  if (data.section_group !== undefined) { sets.push(`section_group = $${++idx}`); params.push(data.section_group) }
  if (data.city_id !== undefined) { sets.push(`city_id = $${++idx}`); params.push(data.city_id) }
  if (data.start_date !== undefined) { sets.push(`start_date = $${++idx}`); params.push(data.start_date) }
  if (data.end_date !== undefined) { sets.push(`end_date = $${++idx}`); params.push(data.end_date) }
  if (data.status !== undefined) { sets.push(`status = $${++idx}`); params.push(data.status) }
  if (data.slot_limit !== undefined) { sets.push(`slot_limit = $${++idx}`); params.push(data.slot_limit) }
  if (data.priority !== undefined) { sets.push(`priority = $${++idx}`); params.push(data.priority) }

  if (sets.length === 0) return getCampaignById(id)

  params.push(id)
  const { rows } = await db.query<CampaignRow>(
    `UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${idx + 1} RETURNING *`,
    params,
  )
  return rows[0] ?? null
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM campaigns WHERE id = $1 AND status = 'draft'`,
    [id],
  )
  return (rowCount ?? 0) > 0
}

// ─── Inventory ──────────────────────────────────────────────────────────────

export async function getInventoryByCampaign(
  campaignId: string,
  filters?: { date_from?: string; date_to?: string; status?: string },
): Promise<InventoryRow[]> {
  const conditions = ['ci.campaign_id = $1']
  const params: unknown[] = [campaignId]
  let idx = 1

  if (filters?.date_from) {
    conditions.push(`ci.date >= $${++idx}`)
    params.push(filters.date_from)
  }
  if (filters?.date_to) {
    conditions.push(`ci.date <= $${++idx}`)
    params.push(filters.date_to)
  }
  if (filters?.status) {
    conditions.push(`ci.status = $${++idx}`)
    params.push(filters.status)
  }

  const { rows } = await db.query<InventoryRow>(
    `SELECT ci.*
     FROM campaign_inventory ci
     WHERE ${conditions.join(' AND ')}
     ORDER BY ci.date ASC, ci.position ASC, ci.time_bucket ASC NULLS FIRST`,
    params,
  )
  return rows
}

export async function createInventoryItem(data: {
  campaign_id: string
  position: number
  date: string
  time_bucket?: string | null
}): Promise<InventoryRow> {
  const { rows } = await db.query<InventoryRow>(
    `INSERT INTO campaign_inventory (campaign_id, position, date, time_bucket)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.campaign_id, data.position, data.date, data.time_bucket ?? null],
  )
  return rows[0]
}

export async function bulkCreateInventory(data: {
  campaign_id: string
  positions: number[]
  date_from: string
  date_to: string
  time_buckets?: string[] | null
}): Promise<number> {
  const values: string[] = []
  const params: unknown[] = []
  let idx = 0

  // Generate date range
  const start = new Date(data.date_from)
  const end = new Date(data.date_to)
  const dates: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }

  const buckets = data.time_buckets && data.time_buckets.length > 0
    ? data.time_buckets
    : [null]

  for (const date of dates) {
    for (const pos of data.positions) {
      for (const bucket of buckets) {
        values.push(`($${++idx}, $${++idx}, $${++idx}, $${++idx})`)
        params.push(data.campaign_id, pos, date, bucket)
      }
    }
  }

  if (values.length === 0) return 0

  const { rowCount } = await db.query(
    `INSERT INTO campaign_inventory (campaign_id, position, date, time_bucket)
     VALUES ${values.join(', ')}
     ON CONFLICT (campaign_id, position, date, time_bucket) DO NOTHING`,
    params,
  )
  return rowCount ?? 0
}

/**
 * Atomic inventory claim — the core concurrency-safe operation.
 * Uses UPDATE ... WHERE status='available' RETURNING to prevent double-sell.
 */
export async function claimInventory(data: {
  campaign_id: string
  position: number | null
  date: string
  time_bucket: string
  purchase_id: string
  place_id: string
}): Promise<InventoryRow | null> {
  // If position specified, claim that exact slot
  if (data.position) {
    const { rows } = await db.query<InventoryRow>(
      `UPDATE campaign_inventory
       SET status = 'sold', purchase_id = $5, place_id = $6
       WHERE campaign_id = $1
         AND position = $2
         AND date = $3
         AND time_bucket = $4
         AND status = 'available'
       RETURNING *`,
      [data.campaign_id, data.position, data.date, data.time_bucket, data.purchase_id, data.place_id],
    )
    return rows[0] ?? null
  }

  // No position specified — claim first available on that date/time_bucket
  const { rows } = await db.query<InventoryRow>(
    `UPDATE campaign_inventory
     SET status = 'sold', purchase_id = $4, place_id = $5
     WHERE id = (
       SELECT id FROM campaign_inventory
       WHERE campaign_id = $1
         AND date = $2
         AND time_bucket = $3
         AND status = 'available'
       ORDER BY position ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [data.campaign_id, data.date, data.time_bucket, data.purchase_id, data.place_id],
  )
  return rows[0] ?? null
}

/**
 * Release inventory back to available (for refunds).
 */
export async function releaseInventory(purchaseId: string): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE campaign_inventory
     SET status = 'available', purchase_id = NULL, place_id = NULL
     WHERE purchase_id = $1 AND status = 'sold'`,
    [purchaseId],
  )
  return rowCount ?? 0
}

/**
 * Check if inventory is available for a specific slot.
 */
export async function checkInventoryAvailable(data: {
  campaign_id: string
  position?: number | null
  date: string
  time_bucket?: string
}): Promise<boolean> {
  const conditions = [
    'campaign_id = $1',
    'date = $2',
    "status = 'available'",
  ]
  const params: unknown[] = [data.campaign_id, data.date]
  let idx = 2

  if (data.position) {
    conditions.push(`position = $${++idx}`)
    params.push(data.position)
  }

  if (data.time_bucket) {
    conditions.push(`time_bucket = $${++idx}`)
    params.push(data.time_bucket)
  }

  const { rows } = await db.query<{ available: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM campaign_inventory WHERE ${conditions.join(' AND ')}
     ) AS available`,
    params,
  )
  return rows[0]?.available ?? false
}

export interface NextAvailable {
  date: string
  position: number
  time_bucket: string
}

/**
 * Get the next available slot for a campaign.
 */
export async function getNextAvailableSlot(campaignId: string): Promise<NextAvailable | null> {
  const { rows } = await db.query<{ date: string; position: number; time_bucket: string }>(
    `SELECT date::text, position, time_bucket
     FROM campaign_inventory
     WHERE campaign_id = $1
       AND status = 'available'
       AND date >= CURRENT_DATE
     ORDER BY date ASC, position ASC
     LIMIT 1`,
    [campaignId],
  )
  return rows[0] ?? null
}

// ─── Slots ──────────────────────────────────────────────────────────────────

export async function getSlotsByCampaign(campaignId: string): Promise<CampaignSlotRow[]> {
  const { rows } = await db.query<CampaignSlotRow>(
    `SELECT cs.*, p.name AS place_name
     FROM campaign_slots cs
     LEFT JOIN places p ON p.id = cs.place_id
     WHERE cs.campaign_id = $1
     ORDER BY cs.created_at DESC`,
    [campaignId],
  )
  return rows
}

export async function getActiveSlotsByPlace(placeId: string): Promise<(CampaignSlotRow & { section: string; section_group: string })[]> {
  const { rows } = await db.query<CampaignSlotRow & { section: string; section_group: string }>(
    `SELECT cs.*, c.section, c.section_group
     FROM campaign_slots cs
     JOIN campaigns c ON c.id = cs.campaign_id
     WHERE cs.place_id = $1
       AND cs.status = 'active'
       AND now() BETWEEN cs.starts_at AND cs.ends_at`,
    [placeId],
  )
  return rows
}

export async function createCampaignSlot(data: {
  campaign_id: string
  place_id: string
  purchase_id: string
  inventory_id: string | null
  status: string
  starts_at: string
  ends_at: string
}): Promise<CampaignSlotRow> {
  const { rows } = await db.query<CampaignSlotRow>(
    `INSERT INTO campaign_slots (campaign_id, place_id, purchase_id, inventory_id, status, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.campaign_id,
      data.place_id,
      data.purchase_id,
      data.inventory_id,
      data.status,
      data.starts_at,
      data.ends_at,
    ],
  )
  return rows[0]
}

export async function cancelSlotByPurchase(purchaseId: string): Promise<void> {
  await db.query(
    `UPDATE campaign_slots
     SET status = 'cancelled', updated_at = now()
     WHERE purchase_id = $1 AND status IN ('active', 'reserved')`,
    [purchaseId],
  )
}
