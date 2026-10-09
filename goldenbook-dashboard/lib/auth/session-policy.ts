// ─── Session policy (pure) ───────────────────────────────────────────────────
//
// Decisions shared by proxy.ts, the same-origin backend proxy
// (app/api/backend/[...path]) and the browser API client. Kept free of Next
// and DOM imports so it can be unit-tested in node.
//
// The model, in one paragraph:
//   - The access and refresh tokens live in httpOnly cookies. Browser JS never
//     sees either of them.
//   - `gb_expires_at` stays readable by JS. It is not a secret (just a unix
//     timestamp) and doubles as the session "generation": it changes on every
//     rotation, so a tab can tell that another tab already refreshed.
//   - Supabase refresh tokens are single use. Only ONE place may spend one at a
//     time, so the browser serialises refreshes (single-flight + Web Lock) and
//     calls /api/auth/refresh. The backend proxy never refreshes on its own: it
//     answers 401 with a code telling the client to do the serialised refresh
//     and retry. proxy.ts still refreshes on document navigations (server
//     components need a fresh cookie on that very request), and when it loses
//     a race it hands over to /auth/recover, which uses the same serialised
//     client path instead of rendering with a token it knows is stale.

/** Header the browser client must send on every call to our own auth/proxy routes. */
export const CSRF_HEADER = "x-gb-csrf";
/** Header set on 401s from our routes so the client knows what to do. */
export const AUTH_STATE_HEADER = "x-gb-auth";
/** Server clock (unix seconds), so the client can correct for a skewed clock. */
export const SERVER_NOW_HEADER = "x-gb-now";
/** Sent by the client to /api/auth/refresh: the session generation it saw fail. */
export const SESSION_MARKER_HEADER = "x-gb-session-marker";

export const AUTH_STATE = {
  /** Access token is expired (by clock) and a refresh token exists: refresh, then retry. */
  refreshRequired: "refresh-required",
  /** Backend rejected the token although the clock said it was valid: refresh, then retry. */
  tokenRejected: "token-rejected",
  /** No session at all. Refreshing will not help. */
  noSession: "no-session",
} as const;

export type AuthState = (typeof AUTH_STATE)[keyof typeof AUTH_STATE];

/** proxy.ts refreshes on navigation when the token expires within this window. */
export const NAVIGATION_REFRESH_BUFFER_S = 60;
/** The browser refreshes before sending a request when expiry is this close. */
export const CLIENT_REFRESH_BUFFER_S = 45;
/** The backend proxy refuses to forward a token this close to expiry. */
export const PROXY_EXPIRY_BUFFER_S = 5;

/**
 * Largest request body the backend proxy will accept. Vercel Functions reject
 * request bodies above 4.5 MB with 413 FUNCTION_PAYLOAD_TOO_LARGE before our
 * code runs, so we stay safely below that and let the client shrink images
 * that would not fit.
 */
export const PROXY_MAX_BODY_BYTES = 4 * 1024 * 1024;

/** Mount point of the same-origin backend proxy. */
export const BACKEND_PROXY_PREFIX = "/api/backend";

export interface SessionCookies {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** True when the session is still valid for at least `bufferSeconds`. */
export function isSessionFresh(expiresAt: number | null | undefined, now: number, bufferSeconds: number): boolean {
  if (!expiresAt || !Number.isFinite(expiresAt)) return false;
  return expiresAt > now + bufferSeconds;
}

export function parseExpiresAt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── Route classification (proxy.ts) ─────────────────────────────────────────

/** Pages that never require a session and must not bounce a logged-in user. */
export const PUBLIC_PATHS = [
  "/forgot-password",
  "/reset-password",
  "/set-password",
  "/unauthorized",
  "/auth/recover",
] as const;

export type PathKind = "login" | "public" | "protected";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Every page is protected unless it is listed as public. This is deliberately
 * an allowlist of PUBLIC pages rather than of protected ones: the old list of
 * protected prefixes silently missed /campaigns and /curated-routes, so those
 * pages never got their cookie refreshed.
 */
export function classifyPath(pathname: string): PathKind {
  if (pathname === "/login") return "login";
  if (pathname === "/") return "public"; // redirects to /login by itself
  if (PUBLIC_PATHS.some((p) => matchesPrefix(pathname, p))) return "public";
  return "protected";
}

export type NavigationDecision =
  | { action: "pass" }
  | { action: "refresh" }
  | { action: "login" };

/** What proxy.ts should do with a navigation to a protected page. */
export function decideNavigation(session: SessionCookies | null, now: number): NavigationDecision {
  if (!session) return { action: "login" };
  if (isSessionFresh(session.expiresAt, now, NAVIGATION_REFRESH_BUFFER_S) && session.accessToken) {
    return { action: "pass" };
  }
  // expiresAt === 0 means the cookie data is corrupted: no point refreshing.
  if (session.refreshToken && session.expiresAt > 0) return { action: "refresh" };
  return { action: "login" };
}

/** Where proxy.ts sends a navigation whose refresh failed. */
export function buildRecoverPath(pathname: string, search: string, staleExpiresAt?: number | null): string {
  const next = `${pathname}${search}`;
  const stale = staleExpiresAt ? `&stale=${staleExpiresAt}` : "";
  return `/auth/recover?next=${encodeURIComponent(next)}${stale}`;
}

/**
 * Validate the `next` parameter of /auth/recover so it can only point back
 * into this site (no `//evil.com`, no `https://...`, no backslash tricks).
 */
export function sanitizeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  if (next === "/auth/recover" || next.startsWith("/auth/recover?") || next.startsWith("/login")) return fallback;
  return next;
}

// ─── Backend proxy ───────────────────────────────────────────────────────────

export type BackendAuthDecision =
  | { action: "forward"; accessToken: string }
  | { action: "reject"; state: AuthState };

/** Whether the backend proxy may forward this request, and with which token. */
export function decideBackendAuth(session: SessionCookies | null, now: number): BackendAuthDecision {
  if (!session || (!session.accessToken && !session.refreshToken)) {
    return { action: "reject", state: AUTH_STATE.noSession };
  }
  if (session.accessToken && isSessionFresh(session.expiresAt, now, PROXY_EXPIRY_BUFFER_S)) {
    return { action: "forward", accessToken: session.accessToken };
  }
  if (session.refreshToken) return { action: "reject", state: AUTH_STATE.refreshRequired };
  return { action: "reject", state: AUTH_STATE.noSession };
}

/**
 * Map `/api/backend/api/v1/...?...` to the backend URL. Only `/api/v1/` paths
 * are forwarded, and the check runs after URL normalisation so `..` segments
 * cannot escape it. Returns null for anything else.
 */
export function buildBackendUrl(baseUrl: string, pathname: string, search: string): URL | null {
  if (!pathname.startsWith(`${BACKEND_PROXY_PREFIX}/`)) return null;
  const rest = pathname.slice(BACKEND_PROXY_PREFIX.length);
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  const target = new URL(rest + search, base.origin);
  if (target.origin !== base.origin) return null;
  if (!target.pathname.startsWith("/api/v1/")) return null;
  return target;
}

/** Request headers the browser may pass through to the backend. */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "if-none-match",
  "if-modified-since",
  "x-place-id",
] as const;

export function buildUpstreamHeaders(incoming: Headers, accessToken: string): Headers {
  const out = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) out.set(name, value);
  }
  out.set("authorization", `Bearer ${accessToken}`);
  return out;
}

/**
 * Response headers that must not be copied back. `content-encoding` and
 * `content-length` go because fetch() already decoded the body; the rest are
 * hop-by-hop, CORS (meaningless same-origin) or cookies the backend has no
 * business setting on the dashboard's origin.
 */
const DROPPED_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding",
  "content-length",
  "set-cookie",
  "upgrade",
  "proxy-authenticate",
  "trailer",
  "te",
]);

export function filterResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  upstream.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (DROPPED_RESPONSE_HEADERS.has(lower)) return;
    if (lower.startsWith("access-control-")) return;
    out.set(name, value);
  });
  return out;
}

/** Statuses that must not carry a body (Response() throws if given one). */
export function isNullBodyStatus(status: number): boolean {
  return status === 101 || status === 204 || status === 205 || status === 304;
}

/**
 * CSRF guard for cookie-authenticated routes. Now that auth rides on cookies,
 * a cross-site page could otherwise make the browser call these routes with
 * the user's session. We require:
 *   - our custom header (a cross-origin page cannot add it without a CORS
 *     preflight, and these routes never answer a preflight with CORS headers);
 *   - and, when the browser says so, a same-origin request.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  if (headers.get(CSRF_HEADER) !== "1") return false;
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Whether /api/auth/refresh can skip spending the refresh token: the client
 * says which generation failed for it (`marker`), and the cookie it sent now
 * carries a different, still fresh generation, because another tab or a
 * navigation already rotated it.
 */
export function canReuseRotatedSession(
  cookieExpiresAt: number | null,
  clientMarker: number | null,
  now: number,
): boolean {
  if (!cookieExpiresAt || clientMarker === null) return false;
  if (cookieExpiresAt === clientMarker) return false;
  return isSessionFresh(cookieExpiresAt, now, CLIENT_REFRESH_BUFFER_S);
}
