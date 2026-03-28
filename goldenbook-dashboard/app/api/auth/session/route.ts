import { NextRequest, NextResponse } from "next/server";
import { applySessionCookies, clearSessionCookies } from "@/lib/auth/cookies";
import { fetchCurrentUser } from "@/lib/api/auth";

export async function POST(request: NextRequest) {
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
