import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES, SupabaseAuthError, refreshDashboardSession } from "@/lib/api/auth";
import { applySessionCookies } from "@/lib/auth/cookies";
import {
  SERVER_NOW_HEADER,
  SESSION_MARKER_HEADER,
  canReuseRotatedSession,
  isSameOriginRequest,
  nowSeconds,
  parseExpiresAt,
} from "@/lib/auth/session-policy";

function json(body: Record<string, unknown>, status = 200): NextResponse {
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  response.headers.set(SERVER_NOW_HEADER, String(nowSeconds()));
  return response;
}

// Rotates the session. Called only by the browser's serialised refresh
// (lib/auth/refresh-coordinator.ts) and /auth/recover.
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) {
    return json({ message: "Forbidden.", code: "csrf" }, 403);
  }

  const refreshToken = request.cookies.get(AUTH_COOKIE_NAMES.refreshToken)?.value;
  if (!refreshToken) {
    // Nothing to clear: no session cookie was sent.
    return json({ message: "Session expired.", code: "no-session" }, 401);
  }

  // The client tells us which generation failed for it. If the cookie it just
  // sent is a different, fresh one, another tab or a page navigation already
  // rotated the session: reuse it instead of spending the new refresh token.
  const now = nowSeconds();
  const cookieExpiresAt = parseExpiresAt(request.cookies.get(AUTH_COOKIE_NAMES.expiresAt)?.value);
  const clientMarker = parseExpiresAt(request.headers.get(SESSION_MARKER_HEADER));
  if (canReuseRotatedSession(cookieExpiresAt, clientMarker, now)) {
    return json({ ok: true, reused: true, expiresAt: cookieExpiresAt });
  }

  try {
    const session = await refreshDashboardSession(refreshToken);
    const response = json({ ok: true, expiresAt: session.expiresAt });
    applySessionCookies(response, session);
    return response;
  } catch (err) {
    // Do NOT clear the session cookies here. A failure is often transient —
    // a concurrent refresh that rotated the token a moment earlier ("Already
    // Used"), or a brief network blip. Wiping the cookies on every failure
    // turns a recoverable hiccup into a forced logout. If the session is truly
    // dead, /auth/recover sends the user to /login, where proxy.ts clears it.
    if (err instanceof SupabaseAuthError && !err.isRejection) {
      return json({ message: "Could not reach the auth service.", code: "unavailable" }, 503);
    }
    return json({ message: "Session expired.", code: "rejected" }, 401);
  }
}
