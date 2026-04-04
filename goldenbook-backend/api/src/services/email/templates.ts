/**
 * Transactional email templates — Goldenbook GO
 *
 * Branding: "Goldenbook" in gold, "GO" in white, on dark navy.
 * Design:   minimal, premium, high-contrast card on dark background.
 * Layout:   table-based for max email-client compatibility.
 *
 * Every export returns { subject, html, text }.
 * The `text` part is mandatory for deliverability (multipart/alternative).
 */

// ─── Palette ────────────────────────────────────────────────────────────────

const NAVY = '#1C1F2E'
const GOLD = '#D4B78F'
const WHITE = '#FFFFFF'
const CARD = '#FFFFFF'
const BODY_TEXT = '#3A3A3A'
const MUTED = '#888888'
const RULE = '#E8E8E8'

// ─── Shared layout ──────────────────────────────────────────────────────────

function layout(preheader: string, card: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<title>Goldenbook GO</title>
<style>
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0;mso-table-rspace:0}
body{margin:0;padding:0;width:100%!important}
</style>
</head>
<body style="margin:0;padding:0;background-color:${NAVY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><![endif]-->

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${NAVY};">${preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${NAVY};">
<tr><td align="center" style="padding:40px 20px 32px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">

<!-- Wordmark: Goldenbook GO -->
<tr><td align="center" style="padding-bottom:28px;">
<span style="font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;font-weight:700;letter-spacing:0.3px;color:${GOLD};">Goldenbook</span><span style="font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;font-weight:700;letter-spacing:0.3px;color:${WHITE};"> GO</span>
</td></tr>

<!-- Card -->
<tr><td style="background-color:${CARD};border-radius:12px;padding:36px 32px;">
${card}
</td></tr>

<!-- Footer -->
<tr><td align="center" style="padding-top:24px;">
<p style="margin:0;font-size:12px;line-height:18px;color:#707070;">Goldenbook GO &middot; Curated places, golden experiences.</p>
<p style="margin:6px 0 0;font-size:11px;line-height:16px;color:#585858;">goldenbook.app</p>
</td></tr>

</table>
</td></tr>
</table>

<!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`
}

function btn(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;"><tr><td align="center" style="background-color:${NAVY};border-radius:10px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:${WHITE};text-decoration:none;letter-spacing:0.2px;">${label}</a>
</td></tr></table>`
}

function rule(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;"><tr><td style="height:1px;background-color:${RULE};font-size:0;line-height:0;">&nbsp;</td></tr></table>`
}

// ─── Verify Email ───────────────────────────────────────────────────────────

export function verifyEmailTemplate(verifyUrl: string): { subject: string; html: string; text: string } {
  const subject = 'Confirm your Goldenbook GO account'

  const html = layout(
    'Confirm your email to get started with Goldenbook GO.',
    `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;font-weight:700;line-height:28px;color:${NAVY};">Welcome to Goldenbook GO</p>
<p style="margin:0 0 4px;font-size:15px;line-height:24px;color:${BODY_TEXT};">Your account has been created successfully.</p>
<p style="margin:0;font-size:15px;line-height:24px;color:${BODY_TEXT};">Please confirm your email to continue.</p>
${btn('Confirm account', verifyUrl)}
${rule()}
<p style="margin:20px 0 0;font-size:12px;line-height:18px;color:${MUTED};">This link expires in 24 hours.</p>
<p style="margin:4px 0 0;font-size:12px;line-height:18px;color:${MUTED};">If you did not create this account, you can safely ignore this email.</p>`
  )

  const text = `Welcome to Goldenbook GO

Your account has been created successfully.

Please confirm your email to continue.

Confirm account: ${verifyUrl}

This link expires in 24 hours.
If you did not create this account, you can safely ignore this email.

--
Goldenbook GO - goldenbook.app`

  return { subject, html, text }
}

// ─── Invite ─────────────────────────────────────────────────────────────────

export function inviteTemplate(setPasswordUrl: string): { subject: string; html: string; text: string } {
  const subject = "You've been invited to Goldenbook GO"

  const html = layout(
    'Set your password to activate your Goldenbook GO account.',
    `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;font-weight:700;line-height:28px;color:${NAVY};">You've been invited</p>
<p style="margin:0;font-size:15px;line-height:24px;color:${BODY_TEXT};">Set your password to activate your Goldenbook GO account.</p>
${btn('Set password', setPasswordUrl)}
${rule()}
<p style="margin:20px 0 0;font-size:12px;line-height:18px;color:${MUTED};">This link expires in 48 hours. If you did not expect this, you can safely ignore this email.</p>`
  )

  const text = `You've been invited to Goldenbook GO

Set your password to activate your account.

Set your password: ${setPasswordUrl}

This link expires in 48 hours.
If you did not expect this invitation, you can safely ignore this email.

--
Goldenbook GO - goldenbook.app`

  return { subject, html, text }
}

// ─── Reset Password ─────────────────────────────────────────────────────────

export function resetPasswordTemplate(resetUrl: string): { subject: string; html: string; text: string } {
  const subject = 'Reset your Goldenbook GO password'

  const html = layout(
    'Reset the password for your Goldenbook GO account.',
    `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;font-weight:700;line-height:28px;color:${NAVY};">Reset your password</p>
<p style="margin:0;font-size:15px;line-height:24px;color:${BODY_TEXT};">We received a request to reset the password for your account.</p>
${btn('Reset password', resetUrl)}
${rule()}
<p style="margin:20px 0 0;font-size:12px;line-height:18px;color:${MUTED};">This link expires in 60 minutes. If you did not request this, you can safely ignore this email.</p>`
  )

  const text = `Reset your Goldenbook GO password

We received a request to reset the password for your account.

Reset your password: ${resetUrl}

This link expires in 60 minutes.
If you did not request this, you can safely ignore this email.

--
Goldenbook GO - goldenbook.app`

  return { subject, html, text }
}
