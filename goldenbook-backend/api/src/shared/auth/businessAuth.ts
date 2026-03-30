import { db } from '../../db/postgres'
import { AppError } from '../errors/AppError'
import { authenticate } from './authPlugin'
import type { FastifyReply, FastifyRequest } from 'fastify'

export interface BusinessClient {
  id: string
  userId: string
  placeId: string
  contactName: string | null
  contactEmail: string | null
}

interface BusinessClientRow {
  id: string
  user_id: string
  place_id: string
  contact_name: string | null
  contact_email: string | null
}

declare module 'fastify' {
  interface FastifyRequest {
    businessClient?: BusinessClient
  }
}

export async function getBusinessClientByUserId(userId: string): Promise<BusinessClient | null> {
  const { rows } = await db.query<BusinessClientRow>(
    `SELECT id, user_id, place_id, contact_name, contact_email
     FROM business_clients
     WHERE user_id = $1 AND is_active = true
     LIMIT 1`,
    [userId],
  )

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    userId: row.user_id,
    placeId: row.place_id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
  }
}

export async function authenticateBusinessClient(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply)

  const client = await getBusinessClientByUserId(request.user.sub)

  if (!client) {
    throw new AppError(403, 'You do not have a business account', 'FORBIDDEN')
  }

  request.businessClient = client
}
