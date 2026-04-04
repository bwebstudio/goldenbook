'use client'

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'

const NAVY = '#1C1F2E'
const GOLD = '#D4B78F'

export default function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const passwordsMatch = password === confirm
  const canSubmit = token && password.length >= 8 && passwordsMatch && !loading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = (await res.json()) as { error?: string; message?: string }

      if (!res.ok) {
        setError(
          data.error === 'INVALID_TOKEN'
            ? 'This reset link is invalid, expired, or has already been used.'
            : (data.message ?? 'Could not reset password. Please try again.'),
        )
        return
      }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <Shell>
        <Icon color="#EF4444" bg="#FEF2F2" border="#FECACA">!</Icon>
        <H1>Invalid link</H1>
        <P>This password reset link is incomplete or broken.</P>
        <Btn href="goldenbook://auth/reset-password">Request a new link</Btn>
        <Sub>If the app doesn&apos;t open, open it and request a new link from there.</Sub>
      </Shell>
    )
  }

  if (success) {
    return (
      <Shell>
        <Icon color="#16A34A" bg="#ECFDF5" border="#BBF7D0">&#10003;</Icon>
        <H1>Password updated</H1>
        <P>Your password has been reset successfully. You can now sign in.</P>
        <Btn href="goldenbook://auth/login">Open Goldenbook GO</Btn>
        <Sub>If the app doesn&apos;t open, open it manually and sign in.</Sub>
      </Shell>
    )
  }

  return (
    <Shell>
      <H1>Set new password</H1>
      <P>Choose a new password for your account.</P>
      <form onSubmit={handleSubmit} style={{ marginTop: 24, textAlign: 'left' }}>
        <label style={labelStyle}>New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
          disabled={loading}
          style={inputStyle}
        />
        <label style={{ ...labelStyle, marginTop: 16 }}>Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          autoComplete="new-password"
          disabled={loading}
          style={inputStyle}
        />
        {confirm.length > 0 && !passwordsMatch && (
          <p style={{ fontSize: 12, color: '#EF4444', margin: '6px 0 0' }}>Passwords do not match</p>
        )}
        {error && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 8,
            backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
            fontSize: 13, color: '#DC2626', lineHeight: '18px',
          }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            display: 'block', width: '100%', marginTop: 24,
            backgroundColor: canSubmit ? NAVY : '#CCC',
            color: '#FFF', fontSize: 15, fontWeight: 600,
            padding: '14px 0', borderRadius: 12, border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: GOLD }}>
            Goldenbook
          </span>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: '#FFF' }}>
            {' '}GO
          </span>
        </div>
        <div style={{
          backgroundColor: '#FFF', borderRadius: 16,
          padding: '44px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}>
          {children}
        </div>
        <p style={{ marginTop: 24, fontSize: 12, color: '#707070' }}>goldenbook.app</p>
      </div>
    </div>
  )
}

function Icon({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: 32, backgroundColor: bg,
      border: `2px solid ${border}`, display: 'flex', alignItems: 'center',
      justifyContent: 'center', margin: '0 auto 24px', fontSize: 28, fontWeight: 700, color,
    }}>
      {children}
    </div>
  )
}

function H1({ children }: { children: React.ReactNode }) {
  return <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: NAVY, margin: '0 0 12px' }}>{children}</h1>
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: '#555', lineHeight: '24px', margin: '0 0 8px' }}>{children}</p>
}

function Btn({ children, href }: { children: React.ReactNode; href: string }) {
  return <a href={href} style={{ display: 'inline-block', marginTop: 24, backgroundColor: NAVY, color: '#FFF', fontSize: 15, fontWeight: 600, textDecoration: 'none', padding: '14px 44px', borderRadius: 12 }}>{children}</a>
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p style={{ marginTop: 14, fontSize: 12, color: '#AAA' }}>{children}</p>
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '12px 16px', fontSize: 15, border: '1.5px solid #DDD', borderRadius: 10, outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif" }
