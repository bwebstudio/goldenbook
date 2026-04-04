import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { query } from '@/lib/db'

function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; password?: string }
    const { token, password } = body

    if (!token || !password || password.length < 8) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Token and password (min 8 chars) are required.' },
        { status: 400 },
      )
    }

    // Validate token
    const tokenHash = hashToken(token)
    const rows = await query<{ id: string; user_id: string; expires_at: string; used: boolean }>(
      'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = $1',
      [tokenHash],
    )

    const row = rows[0]
    if (!row || row.used || new Date(row.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'This reset link is invalid, expired, or has already been used.' },
        { status: 400 },
      )
    }

    // Update password via Supabase Admin API
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'CONFIG_ERROR', message: 'Server configuration error.' },
        { status: 500 },
      )
    }

    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${row.user_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ password }),
    })

    if (!updateRes.ok) {
      return NextResponse.json(
        { error: 'UPDATE_FAILED', message: 'Could not update password. Please try again.' },
        { status: 500 },
      )
    }

    // Mark token as used
    await query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [row.id])

    return NextResponse.json({ status: 'ok', message: 'Password has been reset.' })
  } catch {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
