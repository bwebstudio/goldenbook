/**
 * auth.route.ts
 *
 * POST /auth/migrate-firebase
 *
 * Backend-led progressive migration: Firebase Auth → Supabase Auth.
 *
 * ─── Why this endpoint exists ────────────────────────────────────────────────
 *
 * The mobile client cannot safely create a confirmed Supabase user on its own:
 *   - supabase.auth.signUp requires email confirmation (by default)
 *   - Bypassing confirmation from the client would be a security downgrade
 *
 * This endpoint is the only authority that can:
 *   1. Verify that the Firebase credential is genuine (via Google's API)
 *   2. Create a Supabase user with email_confirm: true (via service role key)
 *   3. Upsert the app users row with migration metadata (idempotent)
 *
 * ─── What it returns ─────────────────────────────────────────────────────────
 *
 *   { status: 'created' }
 *     Supabase user was just provisioned. Client should signInWithPassword.
 *
 *   { status: 'already_in_supabase' }
 *     Email already exists in Supabase auth. The client's credentials were
 *     validated by Firebase but rejected by Supabase → the Supabase password
 *     differs (user changed it after a prior migration, or some other reason).
 *     Client should show "incorrect password" to the user.
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   - Firebase token is verified via Google's identitytoolkit API before
 *     any Supabase write. Forged tokens are rejected at step 1.
 *   - Email in the body must match the email in the Firebase token.
 *   - The password is forwarded in a single TLS-protected hop to the
 *     Supabase admin API and is never logged or stored.
 *   - SUPABASE_SERVICE_ROLE_KEY is server-side only, never sent to clients.
 *   - This endpoint should be rate-limited at the infrastructure level
 *     (reverse proxy / API gateway) to prevent abuse.
 *
 * ─── Idempotency ─────────────────────────────────────────────────────────────
 *
 *   Calling this endpoint twice for the same email is safe:
 *   - If the user already exists in Supabase → returns already_in_supabase
 *   - The app users row upsert uses ON CONFLICT DO NOTHING / UPDATE safely
 *
 * ─── Lifetime ────────────────────────────────────────────────────────────────
 *
 *   Delete this file once the migration window is closed.
 *   REMOVAL CHECKLIST:
 *     ✗ Delete this file (auth.route.ts)
 *     ✗ Remove authRoutes registration from app.ts
 *     ✗ Remove FIREBASE_API_KEY from env.ts and .env
 *     ✗ Remove SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY if not used elsewhere
 *     ✗ Run the SQL to drop legacy_firebase_uid, migrated_from_firebase, migrated_at
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../../config/env'
import { db } from '../../db/postgres'

// ─── Validation ───────────────────────────────────────────────────────────────

const migrateBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firebase_id_token: z.string().min(1),
})

// ─── Firebase token verification ──────────────────────────────────────────────

interface FirebaseVerifiedUser {
  uid: string
  email: string
}

/**
 * Verify a Firebase ID token via Google's identitytoolkit REST API.
 * Returns uid + email on success, throws on any failure.
 *
 * We use the REST API (not Admin SDK) to avoid adding a heavy dependency.
 * The identitytoolkit getAccountInfo endpoint is the canonical verification path.
 */
async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseVerifiedUser> {
  if (!env.FIREBASE_API_KEY) {
    throw new Error('FIREBASE_API_KEY is not configured — cannot verify Firebase tokens')
  }

  const url = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${env.FIREBASE_API_KEY}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  if (!response.ok) {
    throw new Error(`Firebase token verification failed (HTTP ${response.status})`)
  }

  const data = await response.json() as { users?: Array<{ localId: string; email: string }> }
  const user = data.users?.[0]

  if (!user?.localId || !user?.email) {
    throw new Error('Firebase token invalid: missing uid or email in response')
  }

  return { uid: user.localId, email: user.email }
}

// ─── Supabase admin — check email existence ───────────────────────────────────

/**
 * Check if an email already exists in Supabase Auth by querying auth.users
 * directly via the database connection (service role has access to auth schema).
 *
 * Returns the Supabase user UUID if found, null if not found.
 * Falls back to the Supabase Admin REST API if the direct query fails
 * (e.g. if the DATABASE_URL role doesn't have auth schema access).
 */
async function findSupabaseUserByEmail(email: string): Promise<string | null> {
  // Primary: query auth.users via pg (fastest, no extra HTTP hop)
  try {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM auth.users WHERE email = lower($1) LIMIT 1`,
      [email],
    )
    if (rows[0]) return rows[0].id
    return null
  } catch (dbErr: any) {
    // auth schema may not be accessible from this role — fall back to admin API
  }

  // Fallback: Supabase Admin REST API
  // Note: the list endpoint doesn't support filtering by email in query params
  // so we use a page size of 1 and rely on server-side filtering via the filter param.
  // If this also fails, we conservatively assume the user does NOT exist
  // (better to attempt a migration that fails with "already registered" than
  //  to silently skip migration for a real new user).
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users?filter=email%3D${encodeURIComponent(email)}&per_page=1`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    )
    if (!res.ok) return null
    const body = await res.json() as { users?: Array<{ id: string }> }
    return body.users?.[0]?.id ?? null
  } catch {
    return null
  }
}

// ─── Supabase admin — create user ─────────────────────────────────────────────

interface SupabaseCreatedUser {
  id: string
}

/**
 * Create a Supabase Auth user via the admin API.
 * email_confirm: true bypasses the confirmation email — safe because we have
 * already verified the user's identity via the Firebase token.
 *
 * Throws a typed error if the user already exists (status 422).
 */
async function createSupabaseAuthUser(
  email: string,
  password: string,
  firebaseUid: string,
): Promise<SupabaseCreatedUser> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        migrated_from_firebase: true,
        legacy_firebase_uid: firebaseUid,
      },
    }),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({})) as { message?: string }
    const isAlreadyRegistered =
      response.status === 422 &&
      errBody.message?.toLowerCase().includes('already registered')

    if (isAlreadyRegistered) {
      const err = new Error('User already registered in Supabase') as any
      err.code = 'USER_ALREADY_EXISTS'
      throw err
    }

    throw new Error(
      `Supabase admin user creation failed (${response.status}): ${errBody.message ?? 'unknown'}`,
    )
  }

  const created = await response.json() as { id: string }
  return { id: created.id }
}

// ─── App users row — idempotent upsert ────────────────────────────────────────

/**
 * Ensure the app users table has a row for this migrated user.
 *
 * Uses INSERT … ON CONFLICT so it is safe to call multiple times.
 * Records migration metadata for audit and future cleanup.
 */
async function upsertMigratedAppUser(
  supabaseId: string,
  firebaseUid: string,
): Promise<void> {
  await db.query(
    `INSERT INTO users (
       id, migrated_from_firebase, legacy_firebase_uid, migrated_at,
       onboarding_completed, created_at, updated_at
     )
     VALUES ($1, true, $2, NOW(), false, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE
       SET migrated_from_firebase = true,
           legacy_firebase_uid    = COALESCE(EXCLUDED.legacy_firebase_uid, users.legacy_firebase_uid),
           migrated_at            = COALESCE(users.migrated_at, NOW()),
           updated_at             = NOW()`,
    [supabaseId, firebaseUid],
  )
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /auth/migrate-firebase
   *
   * Called by the mobile app after:
   *   1. supabase.auth.signInWithPassword returned 400
   *   2. Firebase legacy sign-in succeeded (credentials are valid)
   *
   * The client passes email + password + firebase_id_token.
   * This endpoint is the single source of truth for whether the user
   * already exists in Supabase or needs to be created.
   */
  app.post('/auth/migrate-firebase', async (request, reply) => {
    const parse = migrateBodySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(400).send({
        error: 'INVALID_BODY',
        message: parse.error.flatten().fieldErrors,
      })
    }

    const { email, password, firebase_id_token } = parse.data
    const normalizedEmail = email.toLowerCase().trim()

    // ── 1. Verify Firebase token ──────────────────────────────────────────
    let firebaseUser: FirebaseVerifiedUser
    try {
      firebaseUser = await verifyFirebaseIdToken(firebase_id_token)
    } catch (err: any) {
      app.log.warn({ email: normalizedEmail }, '[auth/migrate] Firebase token verification failed: %s', err.message)
      return reply.status(401).send({
        error: 'INVALID_FIREBASE_TOKEN',
        message: 'Firebase token could not be verified.',
      })
    }

    // ── 2. Guard: email in request must match email in token ──────────────
    if (firebaseUser.email.toLowerCase() !== normalizedEmail) {
      app.log.warn({ email: normalizedEmail }, '[auth/migrate] Email mismatch with Firebase token')
      return reply.status(400).send({
        error: 'EMAIL_MISMATCH',
        message: 'Email does not match the provided Firebase token.',
      })
    }

    // ── 3. Check if user already exists in Supabase ───────────────────────
    const existingSupabaseId = await findSupabaseUserByEmail(normalizedEmail)

    if (existingSupabaseId) {
      // User already exists in Supabase. The client's Supabase sign-in
      // failed, which means the password is wrong (different from Supabase).
      // We do NOT overwrite the Supabase password — the user must reset it.
      app.log.info({ email: normalizedEmail }, '[auth/migrate] User already in Supabase — wrong Supabase password')
      return reply.status(200).send({ status: 'already_in_supabase' })
    }

    // ── 4. Create Supabase auth user ──────────────────────────────────────
    let supabaseUser: SupabaseCreatedUser
    try {
      supabaseUser = await createSupabaseAuthUser(normalizedEmail, password, firebaseUser.uid)
    } catch (err: any) {
      if (err.code === 'USER_ALREADY_EXISTS') {
        // Race condition: another request created the user between steps 3 and 4.
        // Treat as already_in_supabase — the client's sign-in will resolve it.
        app.log.info({ email: normalizedEmail }, '[auth/migrate] Race condition — user created concurrently')
        return reply.status(200).send({ status: 'already_in_supabase' })
      }

      app.log.error({ email: normalizedEmail, err: err.message }, '[auth/migrate] Supabase user creation failed')
      return reply.status(500).send({
        error: 'MIGRATION_FAILED',
        message: 'Could not create account. Please try again.',
      })
    }

    // ── 5. Upsert app users row ───────────────────────────────────────────
    try {
      await upsertMigratedAppUser(supabaseUser.id, firebaseUser.uid)
    } catch (err: any) {
      // Non-fatal: profile will be created when the user calls GET /me.
      // The Supabase auth user was already created, so this is recoverable.
      app.log.warn({ email: normalizedEmail, err: err.message }, '[auth/migrate] App users row upsert failed — non-fatal')
    }

    app.log.info({ email: normalizedEmail, supabaseId: supabaseUser.id }, '[auth/migrate] Migration complete')
    return reply.status(200).send({ status: 'created' })
  })
}
