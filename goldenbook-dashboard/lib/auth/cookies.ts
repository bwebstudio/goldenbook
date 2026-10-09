import type { NextRequest, NextResponse } from "next/server";
import type { DashboardSession } from "@/types/auth";
import { AUTH_COOKIE_NAMES } from "@/lib/api/auth";
import { parseExpiresAt } from "@/lib/auth/session-policy";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function baseCookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function applySessionCookies(response: NextResponse, session: DashboardSession): void {
  // The tokens are httpOnly: browser code reaches the API through the
  // same-origin proxy (app/api/backend), which reads them server-side. An XSS
  // can no longer read and exfiltrate them.
  response.cookies.set(AUTH_COOKIE_NAMES.accessToken, session.accessToken, {
    ...baseCookieOptions(true),
    maxAge: COOKIE_MAX_AGE,
  });

  response.cookies.set(AUTH_COOKIE_NAMES.refreshToken, session.refreshToken, {
    ...baseCookieOptions(true),
    maxAge: COOKIE_MAX_AGE,
  });

  // Not a secret: a unix timestamp. Left readable on purpose so the browser
  // client can refresh before expiry and detect that another tab rotated the
  // session (it changes on every rotation). See lib/auth/session-policy.ts.
  response.cookies.set(AUTH_COOKIE_NAMES.expiresAt, String(session.expiresAt), {
    ...baseCookieOptions(false),
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAMES.accessToken, "", { ...baseCookieOptions(true), maxAge: 0 });
  response.cookies.set(AUTH_COOKIE_NAMES.refreshToken, "", { ...baseCookieOptions(true), maxAge: 0 });
  response.cookies.set(AUTH_COOKIE_NAMES.expiresAt, "", { ...baseCookieOptions(false), maxAge: 0 });
}

export function getSessionFromRequest(request: NextRequest): DashboardSession | null {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null;
  const refreshToken = request.cookies.get(AUTH_COOKIE_NAMES.refreshToken)?.value ?? null;
  const expiresAt = parseExpiresAt(request.cookies.get(AUTH_COOKIE_NAMES.expiresAt)?.value);

  if (!accessToken && !refreshToken) {
    return null;
  }

  return {
    accessToken: accessToken ?? "",
    refreshToken: refreshToken ?? "",
    expiresAt: expiresAt ?? 0,
  };
}
