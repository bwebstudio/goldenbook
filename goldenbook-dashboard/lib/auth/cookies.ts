import type { NextRequest, NextResponse } from "next/server";
import type { DashboardSession } from "@/types/auth";
import { AUTH_COOKIE_NAMES } from "@/lib/api/auth";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function applySessionCookies(response: NextResponse, session: DashboardSession): void {
  response.cookies.set(AUTH_COOKIE_NAMES.accessToken, session.accessToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  response.cookies.set(AUTH_COOKIE_NAMES.refreshToken, session.refreshToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  response.cookies.set(AUTH_COOKIE_NAMES.expiresAt, String(session.expiresAt), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAMES.accessToken, "", { path: "/", maxAge: 0 });
  response.cookies.set(AUTH_COOKIE_NAMES.refreshToken, "", { path: "/", maxAge: 0 });
  response.cookies.set(AUTH_COOKIE_NAMES.expiresAt, "", { path: "/", maxAge: 0 });
}

export function getSessionFromRequest(request: NextRequest): DashboardSession | null {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null;
  const refreshToken = request.cookies.get(AUTH_COOKIE_NAMES.refreshToken)?.value ?? null;
  const expiresAtValue = request.cookies.get(AUTH_COOKIE_NAMES.expiresAt)?.value ?? null;
  const expiresAt = expiresAtValue ? Number(expiresAtValue) : null;

  if (!accessToken && !refreshToken) {
    return null;
  }

  return {
    accessToken: accessToken ?? "",
    refreshToken: refreshToken ?? "",
    expiresAt: Number.isFinite(expiresAt) ? expiresAt! : 0,
  };
}
