import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Verify your email - Goldenbook GO',
}

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001'

interface VerifyResult {
  ok: boolean
  error?: string
}

async function verifyToken(token: string): Promise<VerifyResult> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    )
    if (res.ok) return { ok: true }
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: body?.error ?? 'UNKNOWN' }
  } catch {
    return { ok: false, error: 'NETWORK' }
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token

  if (!token) {
    return <Shell><ErrorState message="missing" /></Shell>
  }

  const result = await verifyToken(token)

  if (result.ok) {
    return <Shell><SuccessState /></Shell>
  }

  return <Shell><ErrorState message={result.error ?? 'UNKNOWN'} /></Shell>
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
        {/* Wordmark */}
        <div style={{ marginBottom: 32 }}>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 28,
            fontWeight: 700,
            color: '#D4B78F',
            letterSpacing: '0.3px',
          }}>
            Goldenbook
          </span>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 28,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '0.3px',
          }}>
            {' '}GO
          </span>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: '44px 36px',
          boxShadow: '0 2px 24px rgba(0,0,0,0.12)',
        }}>
          {children}
        </div>

        {/* Footer */}
        <p style={{ marginTop: 24, fontSize: 12, color: '#707070', lineHeight: '18px' }}>
          goldenbook.app
        </p>
      </div>
    </div>
  )
}

// ─── Success ────────────────────────────────────────────────────────────────

function SuccessState() {
  return (
    <>
      <div style={{
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        border: '2px solid rgba(34, 197, 94, 0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px', fontSize: 28, color: '#22C55E',
      }}>
        &#10003;
      </div>
      <h1 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 26, fontWeight: 700, color: '#1C1F2E',
        margin: '0 0 12px', lineHeight: '32px',
      }}>
        Email confirmed
      </h1>
      <p style={{ fontSize: 15, color: '#555', lineHeight: '24px', margin: '0 0 28px' }}>
        Your email has been successfully verified.<br />
        You can now sign in to Goldenbook GO.
      </p>
      <a
        href="goldenbook://auth/login"
        style={{
          display: 'inline-block', backgroundColor: '#1C1F2E', color: '#FFFFFF',
          fontSize: 15, fontWeight: 600, textDecoration: 'none',
          padding: '14px 40px', borderRadius: 12, letterSpacing: '0.2px',
        }}
      >
        Open Goldenbook GO
      </a>
      <p style={{ marginTop: 16, fontSize: 12, color: '#999' }}>
        If the app doesn&apos;t open, sign in manually.
      </p>
    </>
  )
}

// ─── Error ──────────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  const isMissing = message === 'missing'

  return (
    <>
      <div style={{
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '2px solid rgba(239, 68, 68, 0.20)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px', fontSize: 24, color: '#EF4444',
      }}>
        !
      </div>
      <h1 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 26, fontWeight: 700, color: '#1C1F2E',
        margin: '0 0 12px', lineHeight: '32px',
      }}>
        {isMissing ? 'Invalid link' : 'Verification failed'}
      </h1>
      <p style={{ fontSize: 15, color: '#555', lineHeight: '24px', margin: '0 0 28px' }}>
        {isMissing
          ? 'This verification link is incomplete or broken.'
          : 'This link is no longer valid. It may have expired or already been used.'}
      </p>
      <a
        href="goldenbook://auth/verify-email"
        style={{
          display: 'inline-block', backgroundColor: '#1C1F2E', color: '#FFFFFF',
          fontSize: 15, fontWeight: 600, textDecoration: 'none',
          padding: '14px 40px', borderRadius: 12, letterSpacing: '0.2px',
        }}
      >
        Request a new link
      </a>
      <p style={{ marginTop: 16, fontSize: 12, color: '#999' }}>
        If the app doesn&apos;t open, sign in and resend from there.
      </p>
    </>
  )
}
