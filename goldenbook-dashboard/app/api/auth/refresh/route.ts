import { NextRequest, NextResponse } from "next/server";
import { refreshDashboardSession } from "@/lib/api/auth";
import { applySessionCookies, clearSessionCookies } from "@/lib/auth/cookies";
import { AUTH_COOKIE_NAMES } from "@/lib/api/auth";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(AUTH_COOKIE_NAMES.refreshToken)?.value;

  if (!refreshToken) {
    const response = NextResponse.json({ message: "Session expired." }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  try {
    const session = await refreshDashboardSession(refreshToken);
    const response = NextResponse.json({ ok: true });
    applySessionCookies(response, session);
    return response;
  } catch {
    // Do NOT clear the session cookies here. A failure is often transient —
    // a concurrent refresh that rotated the token a moment earlier ("Already
    // Used"), or a brief network blip. Wiping the cookies on every failure
    // turns a recoverable hiccup into a forced logout. We return 401 so the
    // caller can surface an error / retry; if the session is truly dead the
    // proxy redirects to /login on the next navigation and the cookies expire
    // on their own.
    return NextResponse.json({ message: "Session expired." }, { status: 401 });
  }
}
