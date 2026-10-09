import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshDashboardSession } from "@/lib/api/auth";
import { applySessionCookies, clearSessionCookies, getSessionFromRequest } from "@/lib/auth/cookies";
import { buildRecoverPath, classifyPath, decideNavigation, nowSeconds } from "@/lib/auth/session-policy";

function redirectTo(request: NextRequest, pathAndQuery: string) {
  return NextResponse.redirect(new URL(pathAndQuery, request.url));
}

function loginRedirect(request: NextRequest) {
  const response = redirectTo(request, "/login");
  clearSessionCookies(response);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const kind = classifyPath(pathname);

  if (kind === "public") {
    return NextResponse.next();
  }

  const session = getSessionFromRequest(request);
  const decision = decideNavigation(session, nowSeconds());

  if (kind === "login") {
    if (decision.action === "pass") return redirectTo(request, "/dashboard");
    if (decision.action === "refresh") {
      try {
        const refreshed = await refreshDashboardSession(session!.refreshToken);
        const response = redirectTo(request, "/dashboard");
        applySessionCookies(response, refreshed);
        return response;
      } catch {
        // Fall through: show the login form with a clean slate.
      }
    }
    const response = NextResponse.next();
    if (session) clearSessionCookies(response);
    return response;
  }

  // Protected page.
  if (decision.action === "pass") return NextResponse.next();
  if (decision.action === "login") return loginRedirect(request);

  try {
    const refreshed = await refreshDashboardSession(session!.refreshToken);
    // Cookies set here are visible to this request's server components too
    // (Next forwards them via x-middleware-set-cookie).
    const response = NextResponse.next();
    applySessionCookies(response, refreshed);
    return response;
  } catch {
    // The refresh failed. Most often another tab, or the browser client, spent
    // this single-use refresh token a moment earlier ("Already Used") and the
    // browser already holds the rotated cookies; sometimes it is a blip, and
    // sometimes the session is really dead.
    //
    // Rendering now would use a token we know is stale: server components get
    // a 401 and the page shows PlaceLoadError. Instead, hand over to
    // /auth/recover, which runs the browser's serialised refresh (it adopts a
    // rotation made by another tab) and comes back here, or goes to /login if
    // the session is gone. Cookies are NOT cleared: the failure may be
    // transient.
    return redirectTo(request, buildRecoverPath(pathname, search, session!.expiresAt));
  }
}

export const config = {
  // Every page except Next internals, API routes and static files. Which pages
  // are public is decided in classifyPath (lib/auth/session-policy.ts), so a
  // new section (as /campaigns and /curated-routes once were) cannot be
  // forgotten here.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
