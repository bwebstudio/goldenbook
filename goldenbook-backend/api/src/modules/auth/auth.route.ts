/**
 * auth.route.ts
 *
 * Complete auth system:
 *   - POST /auth/migrate-firebase   (legacy — delete after migration window)
 *   - POST /auth/register           (app user signup + email verification)
 *   - GET  /auth/verify-email       (confirm email token)
 *   - POST /auth/resend-verification
 *   - POST /auth/invite             (admin → editor/business)
 *   - GET  /auth/invite-info        (resolve invite token for UI)
 *   - POST /auth/set-password       (accept invite)
 *   - POST /auth/forgot-password
 *   - POST /auth/reset-password
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../../config/env'
import { db } from '../../db/postgres'
import { AppError } from '../../shared/errors/AppError'
import { authenticate } from '../../shared/auth/authPlugin'
import { authenticateDashboardUser } from '../../shared/auth/dashboardAuth'
import {
  createEmailVerificationToken,
  verifyEmailToken,
  createInvite,
  findInviteByToken,
  markInviteAccepted,
  listInvites,
  createPasswordResetToken,
  verifyPasswordResetToken,
  markPasswordResetUsed,
} from './auth-tokens.query'
import {
  sendVerificationEmail,
  sendInviteEmail,
  sendPasswordResetEmail,
} from '../../services/email/email.service'

// ─── Rate limiting (in-memory, per-IP) ──────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, maxRequests: number, windowMs: number): void {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  entry.count++
  if (entry.count > maxRequests) {
    throw new AppError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED')
  }
}

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key)
  }
}, 10 * 60 * 1000)

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDashboardUrl(): string {
  return env.DASHBOARD_URL ?? 'http://localhost:3001'
}

function getAppUrl(): string {
  // Deep link for mobile, with web fallback
  return env.APP_URL ?? 'https://goldenbook.app'
}

// ─── Firebase migration (legacy) ────────────────────────────────────────────

const migrateBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firebase_id_token: z.string().min(1),
})

interface FirebaseVerifiedUser {
  uid: string
  email: string
}

async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseVerifiedUser> {
  if (!env.FIREBASE_API_KEY) {
    throw new Error('FIREBASE_API_KEY is not configured')
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

async function findSupabaseUserByEmail(email: string): Promise<string | null> {
  // Primary: query auth.users directly via the database connection
  try {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM auth.users WHERE email = lower($1) LIMIT 1`,
      [email],
    )
    if (rows[0]) return rows[0].id
    return null
  } catch {
    // auth schema not accessible from this connection role — fall back to Admin API
  }

  // Fallback: Supabase Admin REST API — list users and filter by email
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    )
    if (!res.ok) return null
    const body = await res.json() as { users?: Array<{ id: string; email?: string }> }
    const match = body.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    )
    return match?.id ?? null
  } catch {
    return null
  }
}

interface SupabaseCreatedUser {
  id: string
}

async function createSupabaseAuthUser(
  email: string,
  password: string,
  metadata?: Record<string, unknown>,
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
      user_metadata: metadata ?? {},
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

async function updateSupabaseUserPassword(userId: string, password: string): Promise<void> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ password }),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(
      `Supabase password update failed (${response.status}): ${errBody.message ?? 'unknown'}`,
    )
  }
}

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

// ─── Route ──────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY: Firebase → Supabase migration
  // ═══════════════════════════════════════════════════════════════════════════

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

    if (firebaseUser.email.toLowerCase() !== normalizedEmail) {
      return reply.status(400).send({
        error: 'EMAIL_MISMATCH',
        message: 'Email does not match the provided Firebase token.',
      })
    }

    const existingSupabaseId = await findSupabaseUserByEmail(normalizedEmail)

    if (existingSupabaseId) {
      return reply.status(200).send({ status: 'already_in_supabase' })
    }

    let supabaseUser: SupabaseCreatedUser
    try {
      supabaseUser = await createSupabaseAuthUser(normalizedEmail, password, {
        migrated_from_firebase: true,
        legacy_firebase_uid: firebaseUser.uid,
      })
    } catch (err: any) {
      if (err.code === 'USER_ALREADY_EXISTS') {
        return reply.status(200).send({ status: 'already_in_supabase' })
      }

      app.log.error({ email: normalizedEmail, err: err.message }, '[auth/migrate] Supabase user creation failed')
      return reply.status(500).send({
        error: 'MIGRATION_FAILED',
        message: 'Could not create account. Please try again.',
      })
    }

    try {
      await upsertMigratedAppUser(supabaseUser.id, firebaseUser.uid)
    } catch (err: any) {
      app.log.warn({ email: normalizedEmail, err: err.message }, '[auth/migrate] App users row upsert failed — non-fatal')
    }

    app.log.info({ email: normalizedEmail, supabaseId: supabaseUser.id }, '[auth/migrate] Migration complete')
    return reply.status(200).send({ status: 'created' })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // APP USER REGISTRATION (with email verification)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/auth/register', async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: body.error.flatten().fieldErrors,
      })
    }

    const { email, password } = body.data
    const normalizedEmail = email.toLowerCase().trim()

    // Check if email already exists in Supabase
    const existingId = await findSupabaseUserByEmail(normalizedEmail)
    if (existingId) {
      // Check if the user exists in our app table and whether they're verified
      const { rows } = await db.query<{ email_verified: boolean }>(
        'SELECT email_verified FROM users WHERE id = $1',
        [existingId],
      )
      const appUser = rows[0]

      // Treat as "unverified" if:
      //   - user row exists with email_verified = false, OR
      //   - user row doesn't exist at all (created outside our register flow)
      const isVerified = appUser?.email_verified === true

      if (!isVerified) {
        // Ensure the users row exists for this account
        if (!appUser) {
          try {
            await db.query(
              `INSERT INTO users (id, email_verified, onboarding_completed, created_at, updated_at)
               VALUES ($1, false, false, NOW(), NOW())
               ON CONFLICT (id) DO NOTHING`,
              [existingId],
            )
          } catch (err: any) {
            app.log.error({ err: err.message }, '[auth/register] users row upsert failed for existing unverified user')
          }
        }

        // Resend verification email — required for the response to be truthful
        try {
          const token = await createEmailVerificationToken(existingId)
          const verifyUrl = `${getAppUrl()}/auth/verify-email?token=${token}`
          await sendVerificationEmail(normalizedEmail, verifyUrl)
        } catch (err: any) {
          app.log.error({ err: err.message }, '[auth/register] Resend verification email FAILED')
          // Still return EMAIL_UNVERIFIED — the account exists, even if email failed
        }

        return reply.status(409).send({
          error: 'EMAIL_UNVERIFIED',
          message: 'This email is already registered but not yet verified. We have sent a new confirmation email.',
        })
      }

      return reply.status(409).send({
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists.',
      })
    }

    // Create Supabase auth user (email_confirm: true so they can log in, but we track our own verification)
    let supabaseUser: SupabaseCreatedUser
    try {
      supabaseUser = await createSupabaseAuthUser(normalizedEmail, password)
    } catch (err: any) {
      if (err.code === 'USER_ALREADY_EXISTS') {
        // Race condition: user was created between our check and this call
        return reply.status(409).send({
          error: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists.',
        })
      }
      app.log.error({ email: normalizedEmail, err: err.message }, '[auth/register] Supabase user creation failed')
      return reply.status(500).send({
        error: 'REGISTRATION_FAILED',
        message: 'Could not create account. Please try again.',
      })
    }

    // ── Step 2: Create app user row ─────────────────────────────────────
    // REQUIRED — if this fails, the account is unusable.
    try {
      await db.query(
        `INSERT INTO users (id, email_verified, onboarding_completed, created_at, updated_at)
         VALUES ($1, false, false, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [supabaseUser.id],
      )
    } catch (err: any) {
      app.log.error({ err: err.message }, '[auth/register] users row insert FAILED')
      return reply.status(500).send({
        error: 'REGISTRATION_FAILED',
        message: 'Could not create account. Please try again.',
      })
    }

    // ── Step 3: Create verification token ────────────────────────────────
    // REQUIRED — if this fails, the user can never verify.
    let verifyUrl: string
    try {
      const token = await createEmailVerificationToken(supabaseUser.id)
      verifyUrl = `${getAppUrl()}/auth/verify-email?token=${token}`
    } catch (err: any) {
      app.log.error({ err: err.message }, '[auth/register] Token creation FAILED')
      return reply.status(500).send({
        error: 'REGISTRATION_FAILED',
        message: 'Could not create account. Please try again.',
      })
    }

    // ── Step 4: Send verification email ──────────────────────────────────
    // REQUIRED — if this fails, the user never receives the link.
    try {
      await sendVerificationEmail(normalizedEmail, verifyUrl)
    } catch (err: any) {
      app.log.error({ err: err.message }, '[auth/register] Verification email FAILED')
      return reply.status(500).send({
        error: 'REGISTRATION_FAILED',
        message: 'Account created but we could not send the verification email. Please try again or contact support.',
      })
    }

    // ── All steps succeeded ──────────────────────────────────────────────
    return reply.status(201).send({
      status: 'created',
      email_sent: true,
      message: 'Account created. Please check your email to verify your account.',
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFY EMAIL
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/auth/verify-email', async (request, reply) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(request.query)

    const result = await verifyEmailToken(token)

    if (!result) {
      return reply.status(400).send({
        error: 'INVALID_TOKEN',
        message: 'This verification link is invalid or has expired.',
      })
    }

    // Mark user as verified
    await db.query(
      'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
      [result.userId],
    )

    return reply.send({
      status: 'verified',
      message: 'Email verified successfully.',
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // RESEND VERIFICATION EMAIL
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/auth/resend-verification', { preHandler: [authenticate] }, async (request, reply) => {
    const ip = request.ip
    checkRateLimit(`resend:${ip}`, 3, 15 * 60 * 1000) // 3 per 15 min

    const userId = request.user.sub
    const email = request.user.email

    // Check if already verified
    const { rows } = await db.query<{ email_verified: boolean }>(
      'SELECT email_verified FROM users WHERE id = $1',
      [userId],
    )
    if (rows[0]?.email_verified) {
      return reply.send({ status: 'already_verified' })
    }

    const token = await createEmailVerificationToken(userId)
    const verifyUrl = `${getAppUrl()}/auth/verify-email?token=${token}`
    await sendVerificationEmail(email, verifyUrl)

    return reply.send({ status: 'sent', message: 'Verification email sent.' })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // INVITE (admin only → editor/business)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/auth/invite', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    app.log.info('[auth/invite] Request received from %s (role: %s)', request.user.email, request.adminUser?.dashboardRole)

    if (request.adminUser?.dashboardRole !== 'super_admin') {
      throw new AppError(403, 'Only super admins can send invitations', 'FORBIDDEN')
    }

    const body = z.object({
      email: z.string().email(),
      role: z.enum(['editor', 'business']),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: body.error.flatten().fieldErrors,
      })
    }

    const { email, role } = body.data
    const normalizedEmail = email.toLowerCase().trim()
    app.log.info('[auth/invite] Creating invite for %s (role: %s)', normalizedEmail, role)

    // Check if email already has a Supabase account
    const existingId = await findSupabaseUserByEmail(normalizedEmail)
    if (existingId) {
      const { rows } = await db.query(
        'SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)',
        [normalizedEmail],
      )
      if (rows.length > 0) {
        app.log.info('[auth/invite] Blocked — user already has dashboard access: %s', normalizedEmail)
        return reply.status(409).send({
          error: 'USER_EXISTS',
          message: 'This user already has dashboard access.',
        })
      }
    }

    // Step 1: Create invite token
    const token = await createInvite(normalizedEmail, role, request.user.sub)
    app.log.info('[auth/invite] Token created for %s', normalizedEmail)

    // Step 2: Build invite URL
    const setPasswordUrl = `${getDashboardUrl()}/set-password?token=${token}`
    app.log.info('[auth/invite] Invite URL: %s', setPasswordUrl)

    // Step 3: Send email — MUST succeed
    try {
      await sendInviteEmail(normalizedEmail, setPasswordUrl)
      app.log.info('[auth/invite] Email sent successfully to %s', normalizedEmail)
    } catch (err: any) {
      app.log.error({ err: err.message }, '[auth/invite] EMAIL SEND FAILED for %s', normalizedEmail)
      return reply.status(500).send({
        error: 'EMAIL_FAILED',
        message: 'Invite created but the email could not be sent. Please try resending.',
      })
    }

    return reply.status(201).send({
      status: 'invited',
      message: `Invitation sent to ${normalizedEmail}`,
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST INVITES (admin only)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/auth/invites', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    if (request.adminUser?.dashboardRole !== 'super_admin') {
      throw new AppError(403, 'Only super admins can view invitations', 'FORBIDDEN')
    }

    const invites = await listInvites()
    return reply.send({ items: invites })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // RESEND INVITE (admin only)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/auth/invite/resend', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    if (request.adminUser?.dashboardRole !== 'super_admin') {
      throw new AppError(403, 'Only super admins can resend invitations', 'FORBIDDEN')
    }

    const body = z.object({
      email: z.string().email(),
      role: z.enum(['editor', 'business']),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: body.error.flatten().fieldErrors,
      })
    }

    const { email, role } = body.data
    const normalizedEmail = email.toLowerCase().trim()

    const token = await createInvite(normalizedEmail, role, request.user.sub)
    const setPasswordUrl = `${getDashboardUrl()}/set-password?token=${token}`

    try {
      await sendInviteEmail(normalizedEmail, setPasswordUrl)
      app.log.info('[auth/invite/resend] Email sent to %s', normalizedEmail)
    } catch (err: any) {
      app.log.error({ err: err.message }, '[auth/invite/resend] EMAIL SEND FAILED for %s', normalizedEmail)
      return reply.status(500).send({
        error: 'EMAIL_FAILED',
        message: 'Could not send the invitation email. Please try again.',
      })
    }

    return reply.status(200).send({
      status: 'resent',
      message: `Invitation resent to ${normalizedEmail}`,
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // INVITE INFO (public — used by set-password page to show email)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/auth/invite-info', async (request, reply) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(request.query)

    const invite = await findInviteByToken(token)

    if (!invite) {
      return reply.status(400).send({
        error: 'INVALID_TOKEN',
        message: 'This invitation link is invalid.',
      })
    }

    if (invite.accepted_at) {
      return reply.status(400).send({
        error: 'ALREADY_USED',
        message: 'This invitation has already been used.',
      })
    }

    if (new Date(invite.expires_at) < new Date()) {
      return reply.status(400).send({
        error: 'EXPIRED',
        message: 'This invitation has expired. Please request a new one.',
      })
    }

    return reply.send({
      email: invite.email,
      role: invite.role,
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SET PASSWORD (from invite)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/auth/set-password', async (request, reply) => {
    const body = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: body.error.flatten().fieldErrors,
      })
    }

    const { token, password } = body.data
    const invite = await findInviteByToken(token)

    if (!invite) {
      return reply.status(400).send({
        error: 'INVALID_TOKEN',
        message: 'This invitation link is invalid.',
      })
    }

    if (invite.accepted_at) {
      return reply.status(400).send({
        error: 'ALREADY_USED',
        message: 'This invitation has already been used.',
      })
    }

    if (new Date(invite.expires_at) < new Date()) {
      return reply.status(400).send({
        error: 'EXPIRED',
        message: 'This invitation has expired. Please request a new one.',
      })
    }

    // Check if user already exists in Supabase
    let supabaseId = await findSupabaseUserByEmail(invite.email)

    if (!supabaseId) {
      // Create new Supabase auth user
      try {
        const created = await createSupabaseAuthUser(invite.email, password, {
          invited_role: invite.role,
        })
        supabaseId = created.id
      } catch (err: any) {
        if (err.code === 'USER_ALREADY_EXISTS') {
          supabaseId = await findSupabaseUserByEmail(invite.email)
          if (supabaseId) {
            await updateSupabaseUserPassword(supabaseId, password)
          }
        } else {
          app.log.error({ err: err.message }, '[auth/set-password] User creation failed')
          return reply.status(500).send({
            error: 'ACCOUNT_CREATION_FAILED',
            message: 'Could not create account. Please try again.',
          })
        }
      }
    } else {
      // User exists — update password
      await updateSupabaseUserPassword(supabaseId, password)
    }

    if (!supabaseId) {
      return reply.status(500).send({
        error: 'ACCOUNT_CREATION_FAILED',
        message: 'Could not create account. Please try again.',
      })
    }

    // Create admin_users row for the role
    const adminRole = invite.role === 'editor' ? 'editor' : 'super_admin' // business gets managed differently
    if (invite.role === 'editor') {
      await db.query(
        `INSERT INTO admin_users (email, role, full_name, created_at, updated_at)
         VALUES ($1, $2, NULL, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET role = $2, updated_at = NOW()`,
        [invite.email, adminRole],
      )
    }

    // For business role, the admin must separately link the user to a place
    // via the business_clients table (which requires a place_id).
    // The Supabase auth account is now ready — the admin assigns them to
    // a place through the business portal management UI.

    // Mark invite as accepted
    await markInviteAccepted(invite.id)

    app.log.info({ email: invite.email, role: invite.role }, '[auth/set-password] Invite accepted')

    return reply.send({
      status: 'password_set',
      message: 'Account activated. You can now sign in.',
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/auth/forgot-password', async (request, reply) => {
    const ip = request.ip
    checkRateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000) // 5 per 15 min

    const body = z.object({
      email: z.string().email(),
      source: z.enum(['app', 'dashboard']).default('app'),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: body.error.flatten().fieldErrors,
      })
    }

    const { email, source } = body.data
    const normalizedEmail = email.toLowerCase().trim()

    // Always return success to prevent email enumeration
    const userId = await findSupabaseUserByEmail(normalizedEmail)

    if (userId) {
      try {
        const token = await createPasswordResetToken(userId)
        const baseUrl = source === 'dashboard' ? getDashboardUrl() : getAppUrl()
        const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`
        await sendPasswordResetEmail(normalizedEmail, resetUrl)
      } catch (err: any) {
        app.log.error({ email: normalizedEmail, err: err.message }, '[auth/forgot-password] Failed to send reset email')
      }
    }

    // Always return success (don't leak whether email exists)
    return reply.send({
      status: 'sent',
      message: 'If an account with that email exists, a reset link has been sent.',
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET PASSWORD
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/auth/reset-password', async (request, reply) => {
    const body = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: body.error.flatten().fieldErrors,
      })
    }

    const { token, password } = body.data

    const result = await verifyPasswordResetToken(token)

    if (!result) {
      return reply.status(400).send({
        error: 'INVALID_TOKEN',
        message: 'This reset link is invalid, has expired, or has already been used.',
      })
    }

    // Update password in Supabase
    await updateSupabaseUserPassword(result.userId, password)

    // Mark token as used
    await markPasswordResetUsed(result.tokenId)

    return reply.send({
      status: 'reset',
      message: 'Password has been reset successfully. You can now sign in.',
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK EMAIL VERIFICATION STATUS (for app to restrict actions)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/auth/verification-status', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.sub

    const { rows } = await db.query<{ email_verified: boolean }>(
      'SELECT email_verified FROM users WHERE id = $1',
      [userId],
    )

    return reply.send({
      email_verified: rows[0]?.email_verified ?? false,
    })
  })
}
