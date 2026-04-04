/**
 * Central email service — Resend.
 *
 * All transactional emails (verification, invites, password reset)
 * go through this module. No other email path should exist.
 *
 * Deliverability requirements (configured in Resend + DNS):
 *   - Sending domain goldenbook.app verified in Resend
 *   - SPF record authorising Resend for goldenbook.app
 *   - DKIM CNAME records published (provided by Resend)
 *   - DMARC TXT at _dmarc.goldenbook.app  (v=DMARC1; p=none)
 *   - No Supabase-hosted auth emails active (disable in dashboard)
 */

import { Resend } from 'resend'
import { env } from '../../config/env'
import { verifyEmailTemplate, inviteTemplate, resetPasswordTemplate } from './templates'

let resendClient: Resend | null = null

function getResend(): Resend {
  if (!resendClient) {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured')
    }
    resendClient = new Resend(env.RESEND_API_KEY)
  }
  return resendClient
}

// From must match the verified domain in Resend.
// "Goldenbook GO" as the display name — consistent with app branding.
const FROM = env.EMAIL_FROM ?? 'Goldenbook GO <noreply@goldenbook.app>'
const REPLY_TO = 'hello@goldenbook.app'

async function send(
  to: string,
  template: { subject: string; html: string; text: string },
): Promise<void> {
  const resend = getResend()
  const { error } = await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    // Resend tags help with analytics, not deliverability,
    // but they confirm the email is transactional in their system.
    tags: [{ name: 'category', value: 'transactional' }],
  })
  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await send(to, verifyEmailTemplate(verifyUrl))
}

export async function sendInviteEmail(to: string, setPasswordUrl: string): Promise<void> {
  await send(to, inviteTemplate(setPasswordUrl))
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await send(to, resetPasswordTemplate(resetUrl))
}
