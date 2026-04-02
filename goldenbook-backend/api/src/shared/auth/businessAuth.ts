import { db } from '../../db/postgres'
import { AppError } from '../errors/AppError'
import { authenticate } from './authPlugin'
import type { FastifyReply, FastifyRequest } from 'fastify'

export interface PlaceUserLink {
  placeId: string
  role: 'owner' | 'manager'
}

export interface BusinessClient {
  id: string
  userId: string
  placeId: string
  contactName: string | null
  contactEmail: string | null
  places: PlaceUserLink[]
}

interface BusinessClientRow {
  id: string
  user_id: string
  place_id: string
  contact_name: string | null
  contact_email: string | null
}

interface PlaceUserRow {
  place_id: string
  role: 'owner' | 'manager'
}

declare module 'fastify' {
  interface FastifyRequest {
    businessClient?: BusinessClient
  }
}

export async function getPlacesByUserId(userId: string): Promise<PlaceUserLink[]> {
  try {
    const { rows } = await db.query<PlaceUserRow>(
      `SELECT place_id, role FROM place_users WHERE user_id = $1`,
      [userId],
    )
    return rows.map((r) => ({ placeId: r.place_id, role: r.role }))
  } catch {
    // Table may not exist yet (migration pending)
    return []
  }
}

export async function getBusinessClientByUserId(userId: string): Promise<BusinessClient | null> {
  const [clientResult, places] = await Promise.all([
    db.query<BusinessClientRow>(
      `SELECT id, user_id, place_id, contact_name, contact_email
       FROM business_clients
       WHERE user_id = $1 AND is_active = true`,
      [userId],
    ),
    getPlacesByUserId(userId),
  ])

  const rows = clientResult.rows
  if (rows.length === 0 && places.length === 0) return null

  const row = rows[0]

  // Build unified places list from both sources
  const placeMap = new Map<string, PlaceUserLink>()
  for (const p of places) {
    placeMap.set(p.placeId, p)
  }
  // Add any business_clients entries not already in place_users
  for (const r of rows) {
    if (!placeMap.has(r.place_id)) {
      placeMap.set(r.place_id, { placeId: r.place_id, role: 'owner' })
    }
  }

  const allPlaces = Array.from(placeMap.values())
  const activePlaceId = allPlaces[0]?.placeId ?? row?.place_id

  return {
    id: row?.id ?? '',
    userId: row?.user_id ?? userId,
    placeId: activePlaceId,
    contactName: row?.contact_name ?? null,
    contactEmail: row?.contact_email ?? null,
    places: allPlaces,
  }
}

export async function authenticateBusinessClient(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply)

  const client = await getBusinessClientByUserId(request.user.sub)

  if (!client || client.places.length === 0) {
    throw new AppError(403, 'You do not have a business account', 'FORBIDDEN')
  }

  // Allow place selection via X-Place-Id header
  const selectedPlaceId = (request.headers['x-place-id'] as string) ?? null

  if (selectedPlaceId) {
    const hasAccess = client.places.some((p) => p.placeId === selectedPlaceId)
    if (!hasAccess) {
      throw new AppError(403, 'You do not have access to this place', 'PLACE_ACCESS_DENIED')
    }
    client.placeId = selectedPlaceId
  }

  request.businessClient = client
}
