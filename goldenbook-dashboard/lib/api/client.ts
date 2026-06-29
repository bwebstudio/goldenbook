// Central API client for the Goldenbook backend.
// Base URL is read from NEXT_PUBLIC_API_BASE_URL (set in .env.local).
// Backend runs on port 3000 by default.

import { AUTH_COOKIE_NAMES, getBrowserAccessToken, getCookieValue } from "@/lib/api/auth";

function resolveBaseUrl(): string {
  let url = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
  // Ensure protocol is present — missing https:// causes ERR_INVALID_URL
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

const BASE_URL = resolveBaseUrl();

// ─── Logout guard ───────────────────────────────────────────────────────────
// When set to true, ALL outbound API requests are blocked immediately.
// This prevents cascading fetches during the logout → redirect transition.
let _loggingOut = false;

export function markLoggingOut() {
  _loggingOut = true;
}

export function isLoggingOut() {
  return _loggingOut;
}

export class ApiError extends Error {
  public readonly data: Record<string, unknown>;

  constructor(
    public readonly status: number,
    message: string,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.data = data ?? {};
  }
}

async function getAccessToken(): Promise<string | null> {
  if (typeof window !== "undefined") {
    return getBrowserAccessToken();
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null;
}

const PLACE_ID_COOKIE = "gb_active_place_id";

function getActivePlaceId(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${PLACE_ID_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setActivePlaceId(placeId: string) {
  if (typeof window === "undefined") return;
  document.cookie = `${PLACE_ID_COOKIE}=${encodeURIComponent(placeId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

async function buildHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  const placeId = getActivePlaceId();

  return {
    ...(extraHeaders ?? {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(placeId ? { "X-Place-Id": placeId } : {}),
  };
}

// ─── Single-flight + cross-tab refresh ───────────────────────────────────────
// Parallel requests (e.g. Promise.all on a page) can all 401 at the same time
// when the access token has just expired. If each one independently POSTs to
// /api/auth/refresh, they race on the SAME refresh token. Supabase rotates
// refresh tokens (single use), so the first call invalidates the token and the
// others fail with "Invalid Refresh Token: Already Used".
//
// Two layers of protection:
//   1. `_refreshInFlight` coalesces concurrent refreshes WITHIN a tab.
//   2. The Web Locks API (`navigator.locks`) serializes refreshes ACROSS tabs,
//      so opening the dashboard in several tabs no longer breaks the session
//      (the multi-tab "Already Used" 401 that broke saves / image loads).
// Plus: before and after each refresh we compare the cookie token — if another
// tab already rotated it, we simply reuse the new token instead of refreshing
// again (which would fail "Already Used").
let _refreshInFlight: Promise<boolean> | null = null;

function readAccessToken(): string | null {
  if (typeof document === "undefined") return null;
  return getCookieValue(document.cookie, AUTH_COOKIE_NAMES.accessToken);
}

// `usedToken` is the access token the 401'd request was sent with. If the cookie
// already holds a different token, another tab refreshed it — reuse it.
async function refreshBrowserSession(usedToken?: string | null): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  if (_refreshInFlight) {
    return _refreshInFlight;
  }

  const doRefresh = async (): Promise<boolean> => {
    // Another tab may have rotated the cookie since this request was sent.
    const current = readAccessToken();
    if (usedToken && current && current !== usedToken) {
      return true;
    }

    try {
      const response = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
      if (response.ok) return true;
    } catch {
      // fall through to the cross-tab check below
    }

    // Refresh failed (commonly "Already Used" when another tab won the race).
    // If the cookie changed underneath us, that other tab succeeded — reuse it.
    const after = readAccessToken();
    return !!(after && after !== usedToken);
  };

  _refreshInFlight = (async () => {
    try {
      const locks = (typeof navigator !== "undefined"
        ? (navigator as unknown as { locks?: { request?: <T>(name: string, cb: () => Promise<T>) => Promise<T> } }).locks
        : undefined);
      if (locks?.request) {
        return await locks.request("gb-token-refresh", doRefresh);
      }
      return await doRefresh();
    } catch {
      return false;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

async function requestWithAuthRetry(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  // Abort immediately if we're in the middle of logging out
  if (_loggingOut) {
    return new Response(JSON.stringify({ error: "LOGGING_OUT" }), { status: 401 });
  }

  let response = await fetch(input, init);

  if (response.status !== 401 || typeof window === "undefined" || _loggingOut) {
    return response;
  }

  // The token this request was sent with — lets the refresh path detect whether
  // another tab already rotated the cookie (avoids the multi-tab "Already Used").
  const usedToken = readAccessToken();

  const refreshed = await refreshBrowserSession(usedToken);
  if (!refreshed || _loggingOut) {
    return response;
  }

  response = await fetch(input, {
    ...init,
    headers: await buildHeaders(init.headers as Record<string, string> | undefined),
  });

  return response;
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await requestWithAuthRetry(url.toString(), {
    // next: { revalidate: 60 } — enable ISR caching if desired
    cache: "no-store",
    headers: await buildHeaders(),
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API error ${res.status} for ${path}`);
  }

  return res.json() as Promise<T>;
}

async function apiWrite<T>(method: "POST" | "PUT" | "PATCH", path: string, body: unknown): Promise<T> {
  const res = await requestWithAuthRetry(`${BASE_URL}${path}`, {
    method,
    headers: await buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `API error ${res.status} for ${method} ${path}`;
    let data: Record<string, unknown> = {};
    try {
      const json = await res.json() as Record<string, unknown>;
      if (json.message && typeof json.message === "string") message = json.message;
      data = json;
    } catch { /* ignore parse failure */ }
    throw new ApiError(res.status, message, data);
  }

  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await requestWithAuthRetry(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: await buildHeaders(),
    cache: "no-store",
  });

  if (!res.ok && res.status !== 204) {
    let message = `API error ${res.status} for DELETE ${path}`;
    try {
      const json = await res.json() as { message?: string };
      if (json.message) message = json.message;
    } catch { /* ignore parse failure */ }
    throw new ApiError(res.status, message);
  }
}

export async function apiPutVoid(path: string, body: unknown): Promise<void> {
  const res = await requestWithAuthRetry(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: await buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok && res.status !== 204) {
    let message = `API error ${res.status} for PUT ${path}`;
    try {
      const json = await res.json() as { message?: string };
      if (json.message) message = json.message;
    } catch { /* ignore parse failure */ }
    throw new ApiError(res.status, message);
  }
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiWrite<T>("POST", path, body);
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiWrite<T>("PUT", path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiWrite<T>("PATCH", path, body);
}
