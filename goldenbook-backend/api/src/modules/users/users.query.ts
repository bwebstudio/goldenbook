import { db } from '../../db/postgres'

interface UserRow {
  id: string
  username: string | null
  display_name: string | null
  locale: string | null
  home_destination_id: string | null
  onboarding_completed: boolean
  email_verified: boolean
}

/**
 * Fetches a user by their Supabase auth UUID.
 * Returns null if the user does not exist in the users table yet.
 */
export async function getUserById(id: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, username, display_name, locale, home_destination_id, onboarding_completed,
            COALESCE(email_verified, false) AS email_verified
     FROM users
     WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

/**
 * Creates a minimal user record on first login.
 * Uses ON CONFLICT DO NOTHING so concurrent requests are safe.
 * Returns the resulting row.
 */
export async function upsertUserOnFirstAccess(id: string, emailVerified = false): Promise<UserRow> {
  await db.query(
    `INSERT INTO users (id, email_verified, onboarding_completed, created_at, updated_at)
     VALUES ($1, $2, false, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [id, emailVerified],
  )

  const user = await getUserById(id)

  // The SELECT after INSERT ON CONFLICT DO NOTHING always returns a row
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return user!
}