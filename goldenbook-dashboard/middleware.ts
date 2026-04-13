import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshDashboardSession, shouldRefreshSession } from "@/lib/api/auth";
import { applySessionCookies, clearSessionCookies, getSessionFromRequest } from "@/lib/auth/cookies";

const PROTECTED_PREFIXES = ["/dashboard", "/places", "/categories", "/routes", "/users", "/settings", "/placements", "/placement-requests", "/analytics", "/portal", "/review-queue", "/pricing"] as const;

// Public auth pages that should NOT redirect to dashboard even if logged in
const PUBLIC_AUTH_PATHS = ["/forgot-password", "/reset-password", "/set-password"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
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

  // Public auth paths — always allow through
  if (isPublicAuthPath(pathname)) {
    return NextResponse.next();
  }

  if (!protectedPath && !loginPath) {
    return NextResponse.next();
  }

  const currentSession = getSessionFromRequest(request);
  let session = currentSession;

  // Only attempt refresh if we have a real refresh token AND a non-zero expiresAt.
  // expiresAt === 0 means the session data is corrupted — skip straight to redirect.
  const hasValidRefreshToken = !!(session?.refreshToken && session.expiresAt > 0);

  if (hasValidRefreshToken && shouldRefreshSession(session!.expiresAt)) {
    try {
      const refreshedSession = await refreshDashboardSession(session!.refreshToken);
      session = refreshedSession;
      const response = loginPath
        ? NextResponse.redirect(new URL("/dashboard", request.url))
        : NextResponse.next();
      applySessionCookies(response, refreshedSession);
      return response;
    } catch {
      // Refresh failed — likely "Already Used" from a concurrent request.
      // If we still have an access token (it may still be valid for a few
      // more seconds), let this request through instead of kicking the
      // user to login. The next request will retry the refresh.
      if (session?.accessToken && !loginPath) {
        return NextResponse.next();
      }

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
  matcher: ["/login", "/forgot-password", "/reset-password", "/set-password", "/dashboard/:path*", "/places/:path*", "/categories/:path*", "/routes/:path*", "/users/:path*", "/settings/:path*", "/placements/:path*", "/placement-requests/:path*", "/analytics/:path*", "/portal/:path*", "/review-queue/:path*", "/pricing/:path*"],
};
