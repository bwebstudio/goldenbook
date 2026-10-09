// ─── Same-origin backend proxy ───────────────────────────────────────────────
//
// Browser code calls /api/backend/api/v1/... instead of the backend directly.
// This handler reads the httpOnly access-token cookie, forwards the request to
// the backend with `Authorization: Bearer`, and streams the response back.
//
// It deliberately does NOT refresh the session. Supabase refresh tokens are
// single use, and parallel requests (one page's Promise.all, several tabs) land
// on different serverless instances that cannot coordinate. Instead, an
// expired session is answered with 401 + `x-gb-auth: refresh-required`, and the
// browser client runs its serialised refresh (single-flight + Web Lock) and
// retries. A 401 from the backend itself is tagged `token-rejected` for the
// same treatment.

import type { NextRequest } from "next/server";
import { resolveApiBaseUrl } from "@/lib/api/auth";
import { getSessionFromRequest } from "@/lib/auth/cookies";
import {
  AUTH_STATE_HEADER,
  AUTH_STATE,
  PROXY_MAX_BODY_BYTES,
  SERVER_NOW_HEADER,
  buildBackendUrl,
  buildUpstreamHeaders,
  decideBackendAuth,
  filterResponseHeaders,
  isNullBodyStatus,
  isSameOriginRequest,
  nowSeconds,
} from "@/lib/auth/session-policy";

const API_BASE_URL = resolveApiBaseUrl();

function jsonError(status: number, body: Record<string, unknown>, authState?: string): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    [SERVER_NOW_HEADER]: String(nowSeconds()),
  });
  if (authState) headers.set(AUTH_STATE_HEADER, authState);
  return new Response(JSON.stringify(body), { status, headers });
}

async function proxy(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request.headers)) {
    return jsonError(403, { error: "FORBIDDEN", message: "Cross-site request rejected." });
  }

  // Raw URL, not nextUrl: nextUrl re-serialises the query string.
  const raw = new URL(request.url);
  const target = buildBackendUrl(API_BASE_URL, raw.pathname, raw.search);
  if (!target) {
    return jsonError(404, { error: "NOT_FOUND", message: "Unknown API path." });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > PROXY_MAX_BODY_BYTES) {
    return jsonError(413, { error: "PAYLOAD_TOO_LARGE", message: "Request body too large." });
  }

  const auth = decideBackendAuth(getSessionFromRequest(request), nowSeconds());
  if (auth.action === "reject") {
    return jsonError(401, { error: "UNAUTHORIZED", code: auth.state, message: "Session expired." }, auth.state);
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && request.body !== null;

  // `duplex: "half"` is required by Node's fetch to stream a request body.
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: buildUpstreamHeaders(request.headers, auth.accessToken),
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? "half" : undefined,
    cache: "no-store",
    redirect: "manual",
    signal: request.signal,
  };

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return jsonError(502, { error: "UPSTREAM_UNAVAILABLE", message: "Could not reach the Goldenbook API." });
  }

  const headers = filterResponseHeaders(upstream.headers);
  headers.set(SERVER_NOW_HEADER, String(nowSeconds()));
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  if (upstream.status === 401) headers.set(AUTH_STATE_HEADER, AUTH_STATE.tokenRejected);

  return new Response(isNullBodyStatus(upstream.status) ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
