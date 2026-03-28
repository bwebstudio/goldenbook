import { FastifyRequest, FastifyReply } from 'fastify'
import { verifySupabaseToken, SupabaseJWTPayload } from './verifySupabaseToken'
import { AppError } from '../errors/AppError'

// Augment FastifyRequest so routes can access request.user with full typing
declare module 'fastify' {
  interface FastifyRequest {
    user: SupabaseJWTPayload
  }
}

/**
 * Fastify preHandler that reads Authorization: Bearer <token>,
 * verifies it against Supabase's JWT secret, and attaches the
 * decoded payload to request.user.
 *
 * Usage in a route:
 *   app.get('/me', { preHandler: [authenticate] }, handler)
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[auth] missing or malformed Authorization header')
    throw new AppError(401, 'Missing or malformed Authorization header', 'UNAUTHORIZED')
  }

  const token = authHeader.slice(7)
  request.user = await verifySupabaseToken(token)
}