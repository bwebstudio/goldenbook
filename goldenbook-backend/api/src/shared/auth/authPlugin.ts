import { FastifyRequest, FastifyReply } from 'fastify'
import { verifySupabaseToken, SupabaseJWTPayload } from './verifySupabaseToken'
import { AppError } from '../errors/AppError'
import { db } from '../../db/postgres'

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
 * After verifying the token, it ensures the user has a row in
 * public.users. This handles the case where a user registered via
 * Supabase Auth (Google, Apple, email) but the app-level profile row
 * was never created — which causes every INSERT with a FK to
 * users(id) to fail with a 500.
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

  // Auto-provision the public.users row if it doesn't exist.
  // This is a lightweight upsert (ON CONFLICT DO NOTHING) that runs on
  // every authenticated request but only INSERTs once. The overhead is
  // a single indexed lookup — negligible compared to the actual route work.
  try {
    await db.query(
      `INSERT INTO users (id, created_at, updated_at)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [request.user.sub],
    )
  } catch (err) {
    // Non-fatal — if this fails the user just won't be able to save/etc.
    // but at least the auth middleware itself won't crash.
    console.warn('[auth] auto-provision users row failed:', err)
  }
}