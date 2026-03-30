import { db } from '../../db/postgres'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlacementRequestRow {
  id: string
  place_id: string
  client_id: string
  placement_type: string
  city_id: string | null
  slot: string | null
  scope_type: string | null
  scope_id: string | null
  route_id: string | null
  duration_days: number
  status: string
  admin_notes: string | null
  visibility_id: string | null
  created_at: string
  updated_at: string
}

export interface PlacementRequestWithPlace extends PlacementRequestRow {
  place_name: string
  place_slug: string
  city_name: string | null
  client_contact_name: string | null
  client_contact_email: string | null
}

// ─── Client queries ─────────────────────────────────────────────────────────

export async function getRequestsByClient(clientId: string): Promise<PlacementRequestRow[]> {
  const { rows } = await db.query<PlacementRequestRow>(`
    SELECT * FROM placement_requests
    WHERE client_id = $1
    ORDER BY created_at DESC
  `, [clientId])
  return rows
}

export async function getRequestById(id: string, clientId: string): Promise<PlacementRequestRow | null> {
  const { rows } = await db.query<PlacementRequestRow>(`
    SELECT * FROM placement_requests
    WHERE id = $1 AND client_id = $2
  `, [id, clientId])
  return rows[0] ?? null
}

export async function createRequest(data: {
  placeId: string
  clientId: string
  placementType: string
  cityId: string | null
  slot: string | null
  scopeType: string | null
  scopeId: string | null
  routeId: string | null
  durationDays: number
}): Promise<PlacementRequestRow> {
  const { rows } = await db.query<PlacementRequestRow>(`
    INSERT INTO placement_requests (
      place_id, client_id, placement_type, city_id,
      slot, scope_type, scope_id, route_id, duration_days
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    data.placeId, data.clientId, data.placementType, data.cityId,
    data.slot, data.scopeType, data.scopeId, data.routeId, data.durationDays,
  ])
  return rows[0]
}

// ─── Admin queries ──────────────────────────────────────────────────────────

export async function getAllRequests(status?: string): Promise<PlacementRequestWithPlace[]> {
  const where = status ? 'AND pr.status = $1' : ''
  const params = status ? [status] : []

  const { rows } = await db.query<PlacementRequestWithPlace>(`
    SELECT
      pr.*,
      p.name AS place_name,
      p.slug AS place_slug,
      d.name AS city_name,
      bc.contact_name AS client_contact_name,
      bc.contact_email AS client_contact_email
    FROM placement_requests pr
    JOIN places p ON p.id = pr.place_id
    LEFT JOIN destinations d ON d.slug = pr.city_id
    JOIN business_clients bc ON bc.id = pr.client_id
    WHERE 1=1 ${where}
    ORDER BY
      CASE pr.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
      pr.created_at DESC
  `, params)
  return rows
}

export async function getRequestByIdAdmin(id: string): Promise<PlacementRequestWithPlace | null> {
  const { rows } = await db.query<PlacementRequestWithPlace>(`
    SELECT
      pr.*,
      p.name AS place_name,
      p.slug AS place_slug,
      d.name AS city_name,
      bc.contact_name AS client_contact_name,
      bc.contact_email AS client_contact_email
    FROM placement_requests pr
    JOIN places p ON p.id = pr.place_id
    LEFT JOIN destinations d ON d.slug = pr.city_id
    JOIN business_clients bc ON bc.id = pr.client_id
    WHERE pr.id = $1
  `, [id])
  return rows[0] ?? null
}

export async function updateRequestStatus(
  id: string,
  status: string,
  adminNotes: string | null,
  visibilityId: string | null,
): Promise<void> {
  await db.query(`
    UPDATE placement_requests
    SET status = $2, admin_notes = $3, visibility_id = $4, updated_at = now()
    WHERE id = $1
  `, [id, status, adminNotes, visibilityId])
}

// ─── Approval: create visibility record ─────────────────────────────────────

export async function approveAndCreateVisibility(requestId: string, adminNotes: string | null): Promise<string> {
  const req = await getRequestByIdAdmin(requestId)
  if (!req) throw new Error('Request not found')
  if (req.status !== 'pending') throw new Error('Request is not pending')

  const startsAt = new Date()
  const endsAt = new Date(startsAt.getTime() + req.duration_days * 86_400_000)

  // Map placement_type to surface
  const surfaceMap: Record<string, string> = {
    golden_picks: 'golden_picks',
    now: 'now',
    hidden_gems: 'hidden_spots',
    category_featured: 'category_featured',
    search_priority: 'search_priority',
    new_on_goldenbook: 'new_on_goldenbook',
    routes: 'route_featured',
    concierge: 'concierge',
  }
  const surface = surfaceMap[req.placement_type] ?? req.placement_type

  // Create visibility record
  const { rows } = await db.query<{ id: string }>(`
    INSERT INTO place_visibility (
      place_id, surface, visibility_type, priority,
      starts_at, ends_at, is_active, source,
      placement_slot, scope_type, scope_id, notes
    ) VALUES ($1, $2, 'sponsored', 10, $3, $4, true, 'sponsored', $5, $6, $7, $8)
    RETURNING id
  `, [
    req.place_id,
    surface,
    startsAt.toISOString(),
    endsAt.toISOString(),
    req.slot,
    req.scope_type,
    req.scope_id,
    `Approved from request ${requestId}`,
  ])

  const visibilityId = rows[0].id

  // Update request status
  await updateRequestStatus(requestId, 'active', adminNotes, visibilityId)

  return visibilityId
}

// ─── Expire stale active requests ───────────────────────────────────────────

export async function expireCompletedRequests(): Promise<number> {
  const { rowCount } = await db.query(`
    UPDATE placement_requests pr
    SET status = 'expired', updated_at = now()
    FROM place_visibility pv
    WHERE pr.visibility_id = pv.id
      AND pr.status = 'active'
      AND pv.ends_at < now()
  `)
  return rowCount ?? 0
}
