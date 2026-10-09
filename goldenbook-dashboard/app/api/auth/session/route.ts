import { NextRequest, NextResponse } from "next/server";
import { applySessionCookies, clearSessionCookies } from "@/lib/auth/cookies";
import { fetchCurrentUser } from "@/lib/api/auth";
import { isSameOriginRequest } from "@/lib/auth/session-policy";

// Exchanges the tokens from a fresh password sign-in (done in the browser by
// supabase-js with persistSession: false) for httpOnly cookies. After this the
// browser forgets the tokens.
export async function POST(request: NextRequest) {
  // Without this, a cross-site form could plant an attacker's session
  // (login CSRF).
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: number;
    };

    const accessToken = body.accessToken ?? "";
    const refreshToken = body.refreshToken ?? "";
    const expiresAt = body.expiresAt ?? 0;

    if (!accessToken || !refreshToken || !expiresAt) {
      return NextResponse.json({ message: "Missing session data." }, { status: 400 });
    }

    const user = await fetchCurrentUser(accessToken);
    if (!user) {
      const response = NextResponse.json(
        { message: "Your account is valid, but it does not have dashboard access." },
        { status: 403 }
      );
      clearSessionCookies(response);
      return response;
    }

    const response = NextResponse.json({ user });
    applySessionCookies(response, {
      accessToken,
      refreshToken,
      expiresAt,
    });
    return response;
  } catch {
    return NextResponse.json({ message: "Could not save the session." }, { status: 500 });
  }
}
