// ─── CORS origin resolution ──────────────────────────────────────────────────
//
// Kept free of `env` imports so it stays a pure function and can be tested
// without a full environment.
//
// - CORS_ORIGINS set     → exactly that comma-separated list.
// - production, unset    → safe allowlist: DASHBOARD_URL, APP_URL and the known
//                          production web domains. A warning is returned so the
//                          caller can log it at startup.
// - otherwise (dev/test) → any origin (`true`), as before.
//
// Native mobile clients send no Origin header; @fastify/cors leaves those
// requests untouched regardless of the allowlist.

export const KNOWN_PRODUCTION_ORIGINS = [
  'https://goldenbook.app',
  'https://www.goldenbook.app',
  'https://dashboard.goldenbook.app',
  // The employee dashboard is served from its Vercel production alias and
  // calls the API from the browser.
  'https://goldenbook-dashboard.vercel.app',
] as const

export interface CorsOriginInput {
  nodeEnv: string
  corsOrigins?: string
  dashboardUrl?: string
  appUrl?: string
}

export interface CorsOriginResult {
  origin: true | string[]
  warning?: string
}

function toOrigin(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function resolveCorsOrigins(input: CorsOriginInput): CorsOriginResult {
  const explicit = (input.corsOrigins ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  if (explicit.length > 0) return { origin: explicit }

  if (input.nodeEnv !== 'production') return { origin: true }

  const fallback = new Set<string>(KNOWN_PRODUCTION_ORIGINS)
  for (const url of [input.dashboardUrl, input.appUrl]) {
    const origin = toOrigin(url)
    // DASHBOARD_URL defaults to localhost; never trust that in production.
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) fallback.add(origin)
  }
  const origin = [...fallback]

  return {
    origin,
    warning: `CORS_ORIGINS is not set in production; falling back to allowlist: ${origin.join(', ')}`,
  }
}
