import { jwtVerify, createRemoteJWKSet } from 'jose'
import { AppError } from '../errors/AppError'

export interface SupabaseJWTPayload {
  sub: string    // Supabase user UUID
  email: string
  role: string   // 'authenticated' for logged-in users
  aud: string
  exp: number
  iat: number
}

const JWKS_URL = 'https://ltdhyshuhkvicsvtssjm.supabase.co/auth/v1/.well-known/jwks.json'
const JWKS = createRemoteJWKSet(new URL(JWKS_URL))

export async function verifySupabaseToken(token: string): Promise<SupabaseJWTPayload> {
  try {
    const { payload } = await jwtVerify(token, JWKS)

    console.log('[auth] decoded payload:', { sub: payload.sub, email: (payload as any).email, role: (payload as any).role })

    return payload as unknown as SupabaseJWTPayload
  } catch (err) {
    console.error('[auth] token verification failed:', err)
    throw new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED')
  }
}