import { db } from '../../db/postgres'

export interface VisibilityRow {
  id: string
  place_id: string
  surface: string
  visibility_type: string
  priority: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  notes: string | null
  source: string
  placement_slot: string | null
  scope_type: string | null
  scope_id: string | null
  created_at: string
  updated_at: string
}

// ─── CRUD for dashboard ──────────────────────────────────────────────────────

export async function getVisibilitiesForPlace(placeId: string): Promise<VisibilityRow[]> {
  const { rows } = await db.query<VisibilityRow>(`
    SELECT * FROM place_visibility WHERE place_id = $1 ORDER BY surface, priority DESC
  `, [placeId])
  return rows
}

export async function createVisibility(data: {
  placeId: string; surface: string; visibilityType: string;
  priority: number; startsAt: string | null; endsAt: string | null;
  notes: string | null; source?: string; placementSlot?: string | null;
  scopeType?: string | null; scopeId?: string | null;
}): Promise<VisibilityRow> {
  const { rows } = await db.query<VisibilityRow>(`
    INSERT INTO place_visibility (place_id, surface, visibility_type, priority, starts_at, ends_at, notes, source, placement_slot, scope_type, scope_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [data.placeId, data.surface, data.visibilityType, data.priority, data.startsAt, data.endsAt, data.notes,
      data.source ?? 'system', data.placementSlot ?? null, data.scopeType ?? null, data.scopeId ?? null])
  return rows[0]
}

export async function updateVisibility(id: string, data: {
  surface?: string; visibilityType?: string; priority?: number;
  startsAt?: string | null; endsAt?: string | null;
  isActive?: boolean; notes?: string | null;
}): Promise<void> {
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1
  function add(col: string, val: unknown) { sets.push(`${col} = $${i++}`); params.push(val) }

  if (data.surface !== undefined) add('surface', data.surface)
  if (data.visibilityType !== undefined) add('visibility_type', data.visibilityType)
  if (data.priority !== undefined) add('priority', data.priority)
  if (data.startsAt !== undefined) add('starts_at', data.startsAt)
  if (data.endsAt !== undefined) add('ends_at', data.endsAt)
  if (data.isActive !== undefined) add('is_active', data.isActive)
  if (data.notes !== undefined) add('notes', data.notes)
  sets.push('updated_at = now()')

  if (sets.length <= 1) return
  params.push(id)
  await db.query(`UPDATE place_visibility SET ${sets.join(', ')} WHERE id = $${i}`, params)
}

export async function deleteVisibility(id: string): Promise<void> {
  await db.query(`DELETE FROM place_visibility WHERE id = $1`, [id])
}

// ─── Global list for dashboard ───────────────────────────────────────────────

export interface VisibilityGlobalRow {
  id: string
  place_id: string
  place_name: string
  place_slug: string
  city_name: string
  city_slug: string
  surface: string
  visibility_type: string
  priority: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  notes: string | null
  source: string
  placement_slot: string | null
  scope_type: string | null
  scope_id: string | null
}

export async function getAllVisibilities(): Promise<VisibilityGlobalRow[]> {
  try {
    const { rows } = await db.query<VisibilityGlobalRow>(`
      SELECT
        pv.id, pv.place_id, p.name AS place_name, p.slug AS place_slug,
        d.name AS city_name, d.slug AS city_slug,
        pv.surface, pv.visibility_type, pv.priority,
        pv.starts_at, pv.ends_at, pv.is_active, pv.notes,
        pv.source, pv.placement_slot, pv.scope_type, pv.scope_id
      FROM place_visibility pv
      JOIN places p ON p.id = pv.place_id
      JOIN destinations d ON d.id = p.destination_id
      ORDER BY d.name ASC, pv.surface ASC, pv.priority DESC
    `)
    return rows
  } catch {
    // Fallback if new columns don't exist yet
    const { rows } = await db.query<VisibilityGlobalRow>(`
      SELECT
        pv.id, pv.place_id, p.name AS place_name, p.slug AS place_slug,
        d.name AS city_name, d.slug AS city_slug,
        pv.surface, pv.visibility_type, pv.priority,
        pv.starts_at, pv.ends_at, pv.is_active, pv.notes,
        'system' AS source, NULL AS placement_slot, NULL AS scope_type, NULL AS scope_id
      FROM place_visibility pv
      JOIN places p ON p.id = pv.place_id
      JOIN destinations d ON d.id = p.destination_id
      ORDER BY d.name ASC, pv.surface ASC, pv.priority DESC
    `)
    return rows
  }
}

// ─── Query: active place IDs for a surface, filtered by city ─────────────────

/**
 * Get active paid placement IDs for a surface within a specific city.
 * City is resolved via places → destinations join.
 * Used for NOW and Concierge where placements must respect city boundaries.
 */
export async function getActiveVisibilityPlaceIdsByCity(
  surface: string,
  citySlug: string,
  limit: number,
): Promise<string[]> {
  const { rows } = await db.query<{ place_id: string }>(`
    SELECT pv.place_id
    FROM place_visibility pv
    JOIN places p ON p.id = pv.place_id AND p.status = 'published'
    JOIN destinations d ON d.id = p.destination_id
    WHERE pv.surface = $1
      AND d.slug = lower($2)
      AND pv.is_active = true
      AND (pv.starts_at IS NULL OR pv.starts_at <= now())
      AND (pv.ends_at IS NULL OR pv.ends_at >= now())
    ORDER BY pv.priority DESC, pv.created_at ASC
    LIMIT $3
  `, [surface, citySlug, limit])
  return rows.map(r => r.place_id)
}

// ─── Query for discover: get active place IDs for a surface (global) ────────

export async function getActiveVisibilityPlaceIds(surface: string, limit: number): Promise<string[]> {
  const { rows } = await db.query<{ place_id: string }>(`
    SELECT pv.place_id
    FROM place_visibility pv
    JOIN places p ON p.id = pv.place_id AND p.status = 'published'
    WHERE pv.surface = $1
      AND pv.is_active = true
      AND (pv.starts_at IS NULL OR pv.starts_at <= now())
      AND (pv.ends_at IS NULL OR pv.ends_at >= now())
    ORDER BY pv.priority DESC, pv.created_at ASC
    LIMIT $2
  `, [surface, limit])
  return rows.map(r => r.place_id)
}

/** Get active placement for a surface + slot (e.g. now + morning) */
export async function getActiveVisibilityBySlot(surface: string, slot: string, limit = 1): Promise<string[]> {
  const { rows } = await db.query<{ place_id: string }>(`
    SELECT pv.place_id
    FROM place_visibility pv
    JOIN places p ON p.id = pv.place_id AND p.status = 'published'
    WHERE pv.surface = $1
      AND pv.placement_slot = $2
      AND pv.is_active = true
      AND (pv.starts_at IS NULL OR pv.starts_at <= now())
      AND (pv.ends_at IS NULL OR pv.ends_at >= now())
    ORDER BY pv.priority DESC, pv.created_at ASC
    LIMIT $3
  `, [surface, slot, limit])
  return rows.map(r => r.place_id)
}

/** Get active placement for a surface + scope (e.g. category_featured + main_category + 'food-drinks') */
export async function getActiveVisibilityByScope(surface: string, scopeType: string, scopeId: string, limit = 1): Promise<string[]> {
  const { rows } = await db.query<{ place_id: string }>(`
    SELECT pv.place_id
    FROM place_visibility pv
    JOIN places p ON p.id = pv.place_id AND p.status = 'published'
    WHERE pv.surface = $1
      AND pv.scope_type = $2
      AND pv.scope_id = $3
      AND pv.is_active = true
      AND (pv.starts_at IS NULL OR pv.starts_at <= now())
      AND (pv.ends_at IS NULL OR pv.ends_at >= now())
    ORDER BY pv.priority DESC, pv.created_at ASC
    LIMIT $4
  `, [surface, scopeType, scopeId, limit])
  return rows.map(r => r.place_id)
}
