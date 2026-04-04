/**
 * Database operations for auth tokens.
 *
 * All tokens are stored as SHA-256 hashes — the plain token is NEVER persisted.
 * Callers generate a crypto-random token, pass the plain value to the email,
 * and store only the hash here.
 */

import { randomBytes, createHash } from 'node:crypto'
import { db } from '../../db/postgres'

// ─── Helpers ────────────────────────────────────────────────────────────────

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ─── Email Verification Tokens ─���────────────────────────────────────────────

export async function createEmailVerificationToken(userId: string): Promise<string> {
  // Delete any existing tokens for this user first
  await db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId])

  const plainToken = generateToken()
  const tokenHash = hashToken(plainToken)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

  await db.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()],
  )

  return plainToken
}

export async function verifyEmailToken(plainToken: string): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(plainToken)

  const { rows } = await db.query<{ id: string; user_id: string; expires_at: string }>(
    `SELECT id, user_id, expires_at FROM email_verification_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  )

  const row = rows[0]
  if (!row) return null
  if (new Date(row.expires_at) < new Date()) {
    // Expired — clean up
    await db.query('DELETE FROM email_verification_tokens WHERE id = $1', [row.id])
    return null
  }

  // Single-use: delete token after successful verification
  await db.query('DELETE FROM email_verification_tokens WHERE id = $1', [row.id])
  return { userId: row.user_id }
}

// ─── User Invites ───────────────────────────────────────────────────────────

export async function createInvite(
  email: string,
  role: 'editor' | 'business',
  createdBy: string,
): Promise<string> {
  const plainToken = generateToken()
  const tokenHash = hashToken(plainToken)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h

  await db.query(
    `INSERT INTO user_invites (email, role, token_hash, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [email.toLowerCase().trim(), role, tokenHash, expiresAt.toISOString(), createdBy],
  )

  return plainToken
}

export async function findInviteByToken(plainToken: string): Promise<{
  id: string
  email: string
  role: 'editor' | 'business'
  expires_at: string
  accepted_at: string | null
} | null> {
  const tokenHash = hashToken(plainToken)

  const { rows } = await db.query<{
    id: string
    email: string
    role: 'editor' | 'business'
    expires_at: string
    accepted_at: string | null
  }>(
    `SELECT id, email, role, expires_at, accepted_at FROM user_invites
     WHERE token_hash = $1`,
    [tokenHash],
  )

  return rows[0] ?? null
}

export async function markInviteAccepted(inviteId: string): Promise<void> {
  await db.query(
    'UPDATE user_invites SET accepted_at = now() WHERE id = $1',
    [inviteId],
  )
}

export async function listInvites(): Promise<Array<{
  id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}>> {
  const { rows } = await db.query(
    `SELECT id, email, role, expires_at, accepted_at, created_at
     FROM user_invites ORDER BY created_at DESC LIMIT 100`,
  )
  return rows
}

// ���── Password Reset Tokens ──────────────────────────────────────────────────

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Delete any existing unused tokens for this user
  await db.query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used = false',
    [userId],
  )

  const plainToken = generateToken()
  const tokenHash = hashToken(plainToken)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h

  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()],
  )

  return plainToken
}

export async function verifyPasswordResetToken(plainToken: string): Promise<{ userId: string; tokenId: string } | null> {
  const tokenHash = hashToken(plainToken)

  const { rows } = await db.query<{ id: string; user_id: string; expires_at: string; used: boolean }>(
    `SELECT id, user_id, expires_at, used FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  )

  const row = rows[0]
  if (!row) return null
  if (row.used) return null
  if (new Date(row.expires_at) < new Date()) return null

  return { userId: row.user_id, tokenId: row.id }
}

export async function markPasswordResetUsed(tokenId: string): Promise<void> {
  await db.query(
    'UPDATE password_reset_tokens SET used = true WHERE id = $1',
    [tokenId],
  )
}
