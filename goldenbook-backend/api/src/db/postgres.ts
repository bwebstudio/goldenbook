import { Pool } from 'pg'
import { env } from '../config/env'

// Use Transaction mode port (6543) if Session mode (5432) is saturated
const connString = env.DATABASE_URL.replace(':5432/', ':6543/')

export const db = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
})

db.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err)
})

export async function checkDbConnection(): Promise<void> {
  const client = await db.connect()
  await client.query('SELECT 1')
  client.release()
}
