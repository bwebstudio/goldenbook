// Central API client for the Goldenbook backend.
//
// Two transports, one API:
//   - Server (server components, route handlers): straight to the backend with
//     the access token read from the httpOnly cookie.
//   - Browser: same-origin calls to the backend proxy (app/api/backend), which
//     attaches the token server-side. Browser JS never sees the tokens.
//
// Backend base URL: NEXT_PUBLIC_API_BASE_URL (see resolveApiBaseUrl).

import { AUTH_COOKIE_NAMES, getCookieValue, resolveApiBaseUrl } from "@/lib/api/auth";
import { createRefreshCoordinator } from "@/lib/auth/refresh-coordinator";
import {
  AUTH_STATE,
  AUTH_STATE_HEADER,
  BACKEND_PROXY_PREFIX,
  CSRF_HEADER,
  PROXY_MAX_BODY_BYTES,
  SERVER_NOW_HEADER,
  SESSION_MARKER_HEADER,
  parseExpiresAt,
} from "@/lib/auth/session-policy";

const BASE_URL = resolveApiBaseUrl();

const isBrowser = () => typeof window !== "undefined";

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

const PLACE_ID_COOKIE = "gb_active_place_id";

function getActivePlaceId(): string | null {
  if (!isBrowser()) return null;
  return getCookieValue(document.cookie, PLACE_ID_COOKIE);
}

export function setActivePlaceId(placeId: string) {
  if (!isBrowser()) return;
  document.cookie = `${PLACE_ID_COOKIE}=${encodeURIComponent(placeId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/** Full URL for `path` (+ query) on the transport this environment uses. */
function buildUrl(path: string, params?: Record<string, string>): string {
  const qs = params ? new URLSearchParams(params).toString() : "";
  const query = qs ? `${path.includes("?") ? "&" : "?"}${qs}` : "";
  return isBrowser() ? `${BACKEND_PROXY_PREFIX}${path}${query}` : `${BASE_URL}${path}${query}`;
}

async function buildHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  if (isBrowser()) {
    const placeId = getActivePlaceId();
    return {
      ...(extraHeaders ?? {}),
      [CSRF_HEADER]: "1",
      ...(placeId ? { "X-Place-Id": placeId } : {}),
    };
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null;
  return {
    ...(extraHeaders ?? {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

// ─── Session refresh (browser) ───────────────────────────────────────────────
// See lib/auth/refresh-coordinator.ts for why this is single-flight within a
// tab and serialised across tabs with a Web Lock.

// Server clock minus client clock, in seconds. Learned from our own routes so a
// skewed laptop clock does not trigger a refresh on every request.
let _clockOffsetS = 0;

function rememberServerTime(response: Response) {
  const server = Number(response.headers.get(SERVER_NOW_HEADER));
  if (Number.isFinite(server) && server > 0) {
    _clockOffsetS = server - Math.floor(Date.now() / 1000);
  }
}

function readSessionMarker(): number | null {
  if (!isBrowser()) return null;
  return parseExpiresAt(getCookieValue(document.cookie, AUTH_COOKIE_NAMES.expiresAt));
}

interface LockManagerLike {
  request: (name: string, cb: () => Promise<unknown>) => Promise<unknown>;
}

// HTTP status of the last /api/auth/refresh call (0 = network error). Lets
// /auth/recover tell a dead session (401) from an outage (503 / 0).
let _lastRefreshStatus: number | null = null;

const refreshCoordinator = createRefreshCoordinator({
  readMarker: readSessionMarker,
  now: () => Math.floor(Date.now() / 1000) + _clockOffsetS,
  callRefresh: async (failedMarker) => {
    _lastRefreshStatus = 0;
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      cache: "no-store",
      headers: {
        [CSRF_HEADER]: "1",
        ...(failedMarker !== null ? { [SESSION_MARKER_HEADER]: String(failedMarker) } : {}),
      },
    });
    _lastRefreshStatus = response.status;
    rememberServerTime(response);
    return response.ok;
  },
  withLock: <T,>(fn: () => Promise<T>): Promise<T> => {
    const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
    // The lock resolves with fn's own result.
    return locks?.request ? (locks.request("gb-token-refresh", fn) as Promise<T>) : fn();
  },
});

/**
 * Run the serialised refresh from outside the API client (used by
 * /auth/recover after proxy.ts lost a refresh race on navigation).
 */
export async function refreshSessionNow(
  staleMarker: number | null,
): Promise<{ ok: boolean; definitive: boolean }> {
  _lastRefreshStatus = null;
  // `staleMarker` is the generation proxy.ts failed to refresh. If the cookie
  // already holds a newer one, it is adopted without spending a token.
  const ok = await refreshCoordinator.refreshAfterRejection(staleMarker ?? readSessionMarker());
  // null: no refresh call was needed (another tab had already rotated).
  const status = _lastRefreshStatus as number | null;
  const definitive = !ok && status !== null && status !== 0 && status !== 503 && status < 500;
  return { ok, definitive };
}

function loggingOutResponse(): Response {
  return new Response(JSON.stringify({ error: "LOGGING_OUT" }), { status: 401 });
}

async function requestWithAuthRetry(url: string, init: RequestInit): Promise<Response> {
  if (_loggingOut) return loggingOutResponse();

  if (!isBrowser()) {
    return fetch(url, init);
  }

  // Refresh BEFORE sending when the session is about to expire. Saves a 401
  // round trip and, for uploads, sending the body twice.
  await refreshCoordinator.ensureFresh();
  if (_loggingOut) return loggingOutResponse();

  // The generation this request goes out with. If it is rejected, the refresh
  // path compares against it to detect a rotation done by another tab.
  const usedMarker = readSessionMarker();
  let response = await fetch(url, init);
  rememberServerTime(response);

  if (response.status !== 401 || _loggingOut) return response;

  const state = response.headers.get(AUTH_STATE_HEADER);
  if (state !== AUTH_STATE.refreshRequired && state !== AUTH_STATE.tokenRejected) {
    return response; // no session at all: refreshing cannot help
  }

  const refreshed = await refreshCoordinator.refreshAfterRejection(usedMarker);
  if (!refreshed || _loggingOut) return response;

  // Headers carry no token in the browser (the proxy adds it from the fresh
  // cookie), so the same init can be replayed. Bodies are strings or Blobs,
  // both of which can be sent again.
  response = await fetch(url, init);
  rememberServerTime(response);
  return response;
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const res = await requestWithAuthRetry(buildUrl(path, params), {
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
  const res = await requestWithAuthRetry(buildUrl(path), {
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
  const res = await requestWithAuthRetry(buildUrl(path), {
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
  const res = await requestWithAuthRetry(buildUrl(path), {
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

/**
 * POST a binary body (e.g. an image) with its own Content-Type. Same auth,
 * X-Place-Id and refresh handling as the JSON helpers.
 */
export async function apiPostBinary<T>(
  path: string,
  body: Blob,
  contentType: string,
  params?: Record<string, string>,
): Promise<T> {
  // In the browser the body goes through the backend proxy, which runs on
  // Vercel Functions (4.5 MB request cap). Image preparation keeps uploads
  // below PROXY_MAX_BODY_BYTES; fail clearly here rather than with an opaque
  // 413 from the platform.
  if (isBrowser() && body.size > PROXY_MAX_BODY_BYTES) {
    throw new ApiError(413, `File too large for upload (${body.size} bytes)`, { error: "PAYLOAD_TOO_LARGE" });
  }

  const res = await requestWithAuthRetry(buildUrl(path, params), {
    method: "POST",
    headers: await buildHeaders({ "Content-Type": contentType }),
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `API error ${res.status} for POST ${path}`;
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

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiWrite<T>("POST", path, body);
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiWrite<T>("PUT", path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiWrite<T>("PATCH", path, body);
}
