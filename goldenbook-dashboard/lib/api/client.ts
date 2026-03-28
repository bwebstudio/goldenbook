// Central API client for the Goldenbook backend.
// Base URL is read from NEXT_PUBLIC_API_BASE_URL (set in .env.local).
// Backend runs on port 3000 by default.

import { AUTH_COOKIE_NAMES, getBrowserAccessToken } from "@/lib/api/auth";

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
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

async function buildHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();

  return {
    ...(extraHeaders ?? {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
  let response = await fetch(input, init);

  if (response.status !== 401 || typeof window === "undefined") {
    return response;
  }

  const refreshed = await refreshBrowserSession();
  if (!refreshed) {
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

async function apiWrite<T>(method: "POST" | "PUT", path: string, body: unknown): Promise<T> {
  const res = await requestWithAuthRetry(`${BASE_URL}${path}`, {
    method,
    headers: await buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `API error ${res.status} for ${method} ${path}`;
    try {
      const json = await res.json() as { message?: string };
      if (json.message) message = json.message;
    } catch { /* ignore parse failure */ }
    throw new ApiError(res.status, message);
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
