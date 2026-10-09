import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES, revokeSupabaseSession } from "@/lib/api/auth";
import { clearSessionCookies } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/session-policy";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  // The browser no longer holds a Supabase session (tokens are httpOnly), so
  // the sign-out that supabase-js used to do client-side happens here.
  const accessToken = request.cookies.get(AUTH_COOKIE_NAMES.accessToken)?.value;
  if (accessToken) await revokeSupabaseSession(accessToken);

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
