// Central API client for the Goldenbook backend.
// Base URL is read from NEXT_PUBLIC_API_BASE_URL (set in .env.local).
// Backend runs on port 3000 by default.

import { AUTH_COOKIE_NAMES, getBrowserAccessToken } from "@/lib/api/auth";

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

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

async function refreshBrowserSession(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    cache: "no-store",
  });

  return response.ok;
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

  const refreshed = await refreshBrowserSession();
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
