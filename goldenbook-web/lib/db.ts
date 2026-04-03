import { Pool } from 'pg'

/**
 * Server-only PostgreSQL connection pool.
 * Uses DATABASE_URL from environment — must be set in Vercel project settings.
 *
 * In development, connects to the local/remote Supabase Postgres instance.
 * In production (Vercel), connects via the pooled connection string.
 */

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error(
        '[goldenbook-web] DATABASE_URL is not set. ' +
        'Add it to .env.local (dev) or Vercel environment variables (prod).',
      )
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })

    pool.on('error', (err) => {
      console.error('[goldenbook-web] Unexpected pool error:', err)
    })
  }
  return pool
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T extends Record<string, any>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await getPool().query<T>(text, params)
  return rows
}
