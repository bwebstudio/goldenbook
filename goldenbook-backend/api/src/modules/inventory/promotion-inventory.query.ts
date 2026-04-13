// ─── Promotion Inventory: Global Slot Cap Per City + Surface ─────────────────
//
// Enforces max_slots limits from the promotion_inventory table.
// This is a GLOBAL cap on top of the per-campaign campaign_inventory system.
//
// Example: if max_slots = 5 for golden_picks in Lisboa, there can never be
// more than 5 active sponsored golden_picks placements in Lisboa at any time,
// regardless of how many campaigns exist.
//
// All slot mutations use atomic SQL to prevent race conditions.

import { db } from '../../db/postgres'
import {
  PLACEMENT_TO_SURFACE,
  SURFACE_TO_INVENTORY,
} from '../../shared/constants/surfaces'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SlotAvailability {
  city: string
  surface: string
  max_slots: number
  active_slots: number
  available: boolean
}

/** Convert placement_type (from purchases) → inventory key (promotion_inventory). */
export function placementToInventoryKey(placementType: string): string {
  // placement_type → visibility surface → inventory key
  const visSurface = PLACEMENT_TO_SURFACE[placementType] ?? placementType
  return SURFACE_TO_INVENTORY[visSurface] ?? visSurface
}

/** Convert visibility surface → inventory key. */
export function surfaceToInventoryKey(surface: string): string {
  return SURFACE_TO_INVENTORY[surface] ?? surface
}

/** @deprecated Use placementToInventoryKey instead. */
export const placementToSurface = placementToInventoryKey

// ─── Check availability (read-only, for validation) ─────────────────────────

/**
 * Check if a slot is available for a given city + surface.
 * Does NOT modify any data. Safe to call at any point.
 *
 * Returns null if no inventory row exists (uncapped surface — always available).
 */
export async function checkSlotAvailability(
  city: string,
  surface: string,
): Promise<SlotAvailability | null> {
  const { rows } = await db.query<{
    city: string; surface: string; max_slots: number; active_slots: number
  }>(
    `SELECT city, surface, max_slots, active_slots
     FROM promotion_inventory
     WHERE city = $1 AND surface = $2
     LIMIT 1`,
    [city, surface],
  )

  if (rows.length === 0) return null // no cap configured

  const row = rows[0]
  return {
    ...row,
    available: row.active_slots < row.max_slots,
  }
}

/**
 * Check availability considering overlapping time periods.
 * Counts ACTUAL active placements for the city+surface that overlap
 * with the requested date range, instead of relying on a counter.
 */
/**
 * Check availability considering overlapping time periods.
 *
 * @param city - City slug (e.g. 'lisboa')
 * @param inventoryKey - Inventory surface key (e.g. 'hidden_gems', 'golden_picks')
 * @param startsAt - Requested placement start date
 * @param endsAt - Requested placement end date
 */
export async function checkSlotAvailabilityForPeriod(
  city: string,
  inventoryKey: string,
  startsAt: string,
  endsAt: string,
): Promise<SlotAvailability | null> {
  // Get the cap from promotion_inventory (uses inventory key naming)
  const { rows: invRows } = await db.query<{ max_slots: number; active_slots: number }>(
    `SELECT max_slots, active_slots FROM promotion_inventory
     WHERE city = $1 AND surface = $2 LIMIT 1`,
    [city, inventoryKey],
  )
  if (invRows.length === 0) return null // no cap

  const maxSlots = invRows[0].max_slots

  // Resolve which surface names in place_visibility correspond to this inventory key.
  // E.g. inventory key 'hidden_gems' → visibility surface 'hidden_spots'.
  const visibilitySurfaces: string[] = []
  for (const [visSurface, invKey] of Object.entries(SURFACE_TO_INVENTORY)) {
    if (invKey === inventoryKey) visibilitySurfaces.push(visSurface)
  }
  // Also include the inventory key itself in case they match directly
  if (!visibilitySurfaces.includes(inventoryKey)) visibilitySurfaces.push(inventoryKey)

  // Count overlapping active sponsored placements
  const surfacePlaceholders = visibilitySurfaces.map((_, i) => `$${i + 5}`).join(', ')
  const { rows: countRows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM place_visibility pv
     JOIN places p ON p.id = pv.place_id
     JOIN destinations d ON d.id = p.destination_id
     WHERE d.slug = $1
       AND pv.surface IN (${surfacePlaceholders})
       AND pv.is_active = true
       AND pv.visibility_type = 'sponsored'
       AND pv.starts_at < $3::timestamptz
       AND pv.ends_at > $2::timestamptz`,
    [city, startsAt, endsAt, ...visibilitySurfaces],
  )

  const overlapping = parseInt(countRows[0]?.count ?? '0', 10)
  return {
    city,
    surface: inventoryKey,
    max_slots: maxSlots,
    active_slots: overlapping,
    available: overlapping < maxSlots,
  }
}

// ─── Atomic increment (post-payment activation) ─────────────────────────────

/**
 * Atomically increment active_slots for a city + surface.
 * Returns false if the increment would exceed max_slots (oversell protection).
 *
 * Uses UPDATE ... WHERE active_slots < max_slots to prevent race conditions.
 */
export async function incrementSlot(city: string, surface: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE promotion_inventory
     SET active_slots = active_slots + 1,
         updated_at = now()
     WHERE city = $1
       AND surface = $2
       AND active_slots < max_slots`,
    [city, surface],
  )

  const success = (rowCount ?? 0) > 0

  if (!success) {
    const current = await checkSlotAvailability(city, surface)
    console.warn(
      `[promotion-inventory] Slot increment BLOCKED: city=${city} surface=${surface} active=${current?.active_slots ?? '?'} max=${current?.max_slots ?? '?'}`,
    )
  } else {
    console.info(`[promotion-inventory] Slot incremented: city=${city} surface=${surface}`)
  }

  return success
}

// ─── Atomic decrement (refund/cancellation/expiry) ──────────────────────────

/**
 * Atomically decrement active_slots for a city + surface.
 * Clamps to 0 (never goes negative).
 */
export async function decrementSlot(city: string, surface: string): Promise<void> {
  await db.query(
    `UPDATE promotion_inventory
     SET active_slots = GREATEST(active_slots - 1, 0),
         updated_at = now()
     WHERE city = $1 AND surface = $2`,
    [city, surface],
  )
  console.info(`[promotion-inventory] Slot decremented: city=${city} surface=${surface}`)
}

// ─── Sync active_slots from actual visibility records ───────────────────────

/**
 * Recompute active_slots from the ground truth (place_visibility table).
 * Useful for recovering from inconsistencies or after manual admin changes.
 */
/**
 * Recompute ALL active_slots from ground truth (place_visibility table).
 *
 * Two-step process:
 *   1. Zero out all rows (handles surfaces with no active placements)
 *   2. Set actual counts from overlapping visibility records
 *
 * Safe to run at any time (idempotent). Should be scheduled periodically.
 */
export async function syncAllSlots(): Promise<number> {
  // Step 1: Zero everything
  await db.query(`UPDATE promotion_inventory SET active_slots = 0, updated_at = now()`)

  // Step 2: Count actual active sponsored placements per city+surface
  // and map visibility surface names back to inventory keys
  const { rows: counts } = await db.query<{ city: string; surface: string; active: string }>(`
    SELECT d.slug AS city, pv.surface, COUNT(*)::text AS active
    FROM place_visibility pv
    JOIN places p ON p.id = pv.place_id
    JOIN destinations d ON d.id = p.destination_id
    WHERE pv.is_active = true
      AND pv.visibility_type = 'sponsored'
      AND pv.ends_at > now()
    GROUP BY d.slug, pv.surface
  `)

  let updated = 0
  for (const row of counts) {
    // Map visibility surface to inventory key
    const invKey = SURFACE_TO_INVENTORY[row.surface] ?? row.surface
    const active = parseInt(row.active, 10)
    const { rowCount } = await db.query(
      `UPDATE promotion_inventory
       SET active_slots = active_slots + $3, updated_at = now()
       WHERE city = $1 AND surface = $2`,
      [row.city, invKey, active],
    )
    updated += rowCount ?? 0
  }

  console.info(`[promotion-inventory] syncAllSlots completed: ${updated} rows updated from ${counts.length} visibility groups`)
  return updated
}

// ─── Expire stale visibility records ─────────────────────────────────────────
// Marks is_active = false on records whose ends_at has passed.
// Idempotent — safe to run frequently. Does NOT decrement promotion_inventory;
// the subsequent syncAllSlots() call handles that.

export async function expireStaleVisibility(): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE place_visibility
     SET is_active = false, updated_at = now()
     WHERE is_active = true
       AND ends_at IS NOT NULL
       AND ends_at < now()`,
  )
  const count = rowCount ?? 0
  if (count > 0) {
    console.info(`[promotion-inventory] Expired ${count} stale visibility records`)
  }
  return count
}

// ─── Get all inventory for a city ───────────────────────────────────────────

export async function getInventoryForCity(city: string): Promise<SlotAvailability[]> {
  const { rows } = await db.query<{
    city: string; surface: string; max_slots: number; active_slots: number
  }>(
    `SELECT city, surface, max_slots, active_slots
     FROM promotion_inventory
     WHERE city = $1
     ORDER BY surface`,
    [city],
  )
  return rows.map((r) => ({ ...r, available: r.active_slots < r.max_slots }))
}
