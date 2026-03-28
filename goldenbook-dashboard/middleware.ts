import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshDashboardSession, shouldRefreshSession } from "@/lib/api/auth";
import { applySessionCookies, clearSessionCookies, getSessionFromRequest } from "@/lib/auth/cookies";

const PROTECTED_PREFIXES = ["/dashboard", "/places", "/categories", "/routes", "/users", "/settings"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function buildLoginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPath = isProtectedPath(pathname);
  const loginPath = pathname === "/login";

  if (!protectedPath && !loginPath) {
    return NextResponse.next();
  }

  const currentSession = getSessionFromRequest(request);
  let session = currentSession;

  if (session?.refreshToken && shouldRefreshSession(session.expiresAt)) {
    try {
      const refreshedSession = await refreshDashboardSession(session.refreshToken);
      session = refreshedSession;
      const response = loginPath
        ? NextResponse.redirect(new URL("/dashboard", request.url))
        : NextResponse.next();
      applySessionCookies(response, refreshedSession);
      return response;
    } catch {
      if (loginPath) {
        const response = NextResponse.next();
        clearSessionCookies(response);
        return response;
      }

      const redirectResponse = NextResponse.redirect(buildLoginRedirect(request));
      clearSessionCookies(redirectResponse);
      return redirectResponse;
    }
  }

  if (!session?.accessToken) {
    if (loginPath) {
      const response = NextResponse.next();
      clearSessionCookies(response);
      return response;
    }

    const redirectResponse = NextResponse.redirect(buildLoginRedirect(request));
    clearSessionCookies(redirectResponse);
    return redirectResponse;
  }

  if (loginPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/places/:path*", "/categories/:path*", "/routes/:path*", "/users/:path*", "/settings/:path*"],
};
