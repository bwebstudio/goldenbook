import { Pool } from 'pg'
import { env } from '../config/env'

export const db = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
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
