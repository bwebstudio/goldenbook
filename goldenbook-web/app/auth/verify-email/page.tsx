import type { Metadata } from 'next'
import { createHash } from 'crypto'
import { query } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Verify your email — Goldenbook GO',
}

// Force dynamic rendering — token verification is stateful
export const dynamic = 'force-dynamic'

// ─── Token verification (direct DB, same logic as backend) ──────────────────

function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex')
}

async function verifyToken(token: string): Promise<'ok' | 'invalid' | 'expired'> {
  const tokenHash = hashToken(token)

  const rows = await query<{ id: string; user_id: string; expires_at: string }>(
    `SELECT id, user_id, expires_at FROM email_verification_tokens WHERE token_hash = $1`,
    [tokenHash],
  )

  const row = rows[0]
  if (!row) return 'invalid'

  if (new Date(row.expires_at) < new Date()) {
    await query('DELETE FROM email_verification_tokens WHERE id = $1', [row.id])
    return 'expired'
  }

  // Mark user as verified + delete token (single-use)
  await query('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [row.user_id])
  await query('DELETE FROM email_verification_tokens WHERE id = $1', [row.id])

  return 'ok'
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token

  if (!token) {
    return <Shell><ErrorUI reason="missing" /></Shell>
  }

  const result = await verifyToken(token)

  if (result === 'ok') {
    return <Shell><SuccessUI /></Shell>
  }

  return <Shell><ErrorUI reason={result} /></Shell>
}

// ─── Shell ──────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        {/* Wordmark: Goldenbook (gold) GO (white) */}
        <div style={{ marginBottom: 32 }}>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 28, fontWeight: 700, color: '#D4B78F',
          }}>
            Goldenbook
          </span>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 28, fontWeight: 700, color: '#FFFFFF',
          }}>
            {' '}GO
          </span>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: '44px 36px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}>
          {children}
        </div>

        {/* Footer */}
        <p style={{ marginTop: 24, fontSize: 12, color: '#707070' }}>
          goldenbook.app
        </p>
      </div>
    </div>
  )
}

// ─── Success ────────────────────────────────────────────────────────────────

function SuccessUI() {
  return (
    <>
      <div style={{
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#ECFDF5', border: '2px solid #BBF7D0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px', fontSize: 28, color: '#16A34A',
      }}>
        &#10003;
      </div>
      <h1 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 26, fontWeight: 700, color: '#1C1F2E',
        margin: '0 0 12px',
      }}>
        Email confirmed
      </h1>
      <p style={{ fontSize: 15, color: '#555', lineHeight: '24px', margin: '0 0 32px' }}>
        Your email has been verified successfully.<br />
        You can now sign in to Goldenbook GO.
      </p>
      <a
        href="goldenbook://auth/login"
        style={{
          display: 'inline-block', backgroundColor: '#1C1F2E', color: '#FFFFFF',
          fontSize: 15, fontWeight: 600, textDecoration: 'none',
          padding: '14px 44px', borderRadius: 12,
        }}
      >
        Open Goldenbook GO
      </a>
      <p style={{ marginTop: 14, fontSize: 12, color: '#AAA' }}>
        If the app doesn&apos;t open, open it manually and sign in.
      </p>
    </>
  )
}

// ─── Error ──────────────────────────────────────────────────────────────────

function ErrorUI({ reason }: { reason: string }) {
  const isMissing = reason === 'missing'
  const isExpired = reason === 'expired'

  return (
    <>
      <div style={{
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#FEF2F2', border: '2px solid #FECACA',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px', fontSize: 24, color: '#DC2626',
        fontWeight: 700,
      }}>
        !
      </div>
      <h1 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 26, fontWeight: 700, color: '#1C1F2E',
        margin: '0 0 12px',
      }}>
        {isMissing ? 'Invalid link' : 'Verification failed'}
      </h1>
      <p style={{ fontSize: 15, color: '#555', lineHeight: '24px', margin: '0 0 32px' }}>
        {isMissing
          ? 'This verification link is incomplete or broken.'
          : isExpired
            ? 'This link has expired. Please request a new one from the app.'
            : 'This link is no longer valid. It may have expired or already been used.'}
      </p>
      <a
        href="goldenbook://auth/verify-email"
        style={{
          display: 'inline-block', backgroundColor: '#1C1F2E', color: '#FFFFFF',
          fontSize: 15, fontWeight: 600, textDecoration: 'none',
          padding: '14px 44px', borderRadius: 12,
        }}
      >
        Request a new link
      </a>
      <p style={{ marginTop: 14, fontSize: 12, color: '#AAA' }}>
        If the app doesn&apos;t open, open it and resend from settings.
      </p>
    </>
  )
}
