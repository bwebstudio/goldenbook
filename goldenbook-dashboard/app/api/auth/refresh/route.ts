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
    const response = NextResponse.json({ message: "Session expired." }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }
}
