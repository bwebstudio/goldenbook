import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  AUTH_STATE,
  CSRF_HEADER,
  buildBackendUrl,
  buildRecoverPath,
  buildUpstreamHeaders,
  canReuseRotatedSession,
  classifyPath,
  decideBackendAuth,
  decideNavigation,
  filterResponseHeaders,
  isNullBodyStatus,
  isSameOriginRequest,
  isSessionFresh,
  parseExpiresAt,
  sanitizeNextPath,
} from "../session-policy";

const NOW = 1_800_000_000;
const session = (expiresAt: number, over: Partial<{ accessToken: string; refreshToken: string }> = {}) => ({
  accessToken: "at",
  refreshToken: "rt",
  expiresAt,
  ...over,
});

describe("classifyPath", () => {
  it("treats every page section under (employee) and (business) as protected", () => {
    // Guards against the bug where /campaigns and /curated-routes were missing
    // from a hand-written list of protected prefixes.
    const appDir = join(__dirname, "../../../app");
    const sections = ["(employee)", "(business)"].flatMap((group) =>
      readdirSync(join(appDir, group)).filter((name) => statSync(join(appDir, group, name)).isDirectory()),
    );
    expect(sections).toContain("campaigns");
    expect(sections).toContain("curated-routes");
    for (const section of sections) {
      expect(classifyPath(`/${section}`)).toBe("protected");
      expect(classifyPath(`/${section}/abc/edit`)).toBe("protected");
    }
  });

  it("keeps auth pages public and recognises /login", () => {
    expect(classifyPath("/login")).toBe("login");
    for (const p of ["/", "/forgot-password", "/reset-password", "/set-password/x", "/unauthorized", "/auth/recover"]) {
      expect(classifyPath(p)).toBe("public");
    }
  });

  it("does not confuse prefixes", () => {
    expect(classifyPath("/loginx")).toBe("protected");
    expect(classifyPath("/unauthorized-but-not")).toBe("protected");
  });
});

describe("decideNavigation", () => {
  it("passes a fresh session", () => {
    expect(decideNavigation(session(NOW + 3600), NOW)).toEqual({ action: "pass" });
  });
  it("refreshes within 60s of expiry or after it", () => {
    expect(decideNavigation(session(NOW + 30), NOW)).toEqual({ action: "refresh" });
    expect(decideNavigation(session(NOW - 30), NOW)).toEqual({ action: "refresh" });
  });
  it("sends corrupted or missing sessions to login", () => {
    expect(decideNavigation(null, NOW)).toEqual({ action: "login" });
    expect(decideNavigation(session(0), NOW)).toEqual({ action: "login" });
    expect(decideNavigation(session(NOW - 30, { refreshToken: "" }), NOW)).toEqual({ action: "login" });
  });
});

describe("recover redirect", () => {
  it("round-trips the path and query, and carries the stale generation", () => {
    const path = buildRecoverPath("/places/abc", "?tab=media&x=1", NOW);
    const url = new URL(path, "https://dash.example");
    expect(url.pathname).toBe("/auth/recover");
    expect(url.searchParams.get("next")).toBe("/places/abc?tab=media&x=1");
    expect(url.searchParams.get("stale")).toBe(String(NOW));
  });

  it("only allows same-site relative next paths", () => {
    expect(sanitizeNextPath("/places/abc?x=1")).toBe("/places/abc?x=1");
    expect(sanitizeNextPath("//evil.com")).toBe("/dashboard");
    expect(sanitizeNextPath("https://evil.com")).toBe("/dashboard");
    expect(sanitizeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(sanitizeNextPath("/auth/recover?next=/x")).toBe("/dashboard");
    expect(sanitizeNextPath(null)).toBe("/dashboard");
  });
});

describe("decideBackendAuth", () => {
  it("forwards a fresh access token", () => {
    expect(decideBackendAuth(session(NOW + 600), NOW)).toEqual({ action: "forward", accessToken: "at" });
  });
  it("asks the client to refresh instead of refreshing itself", () => {
    expect(decideBackendAuth(session(NOW + 2), NOW)).toEqual({ action: "reject", state: AUTH_STATE.refreshRequired });
    expect(decideBackendAuth(session(NOW + 600, { accessToken: "" }), NOW)).toEqual({
      action: "reject",
      state: AUTH_STATE.refreshRequired,
    });
  });
  it("reports no session when refreshing cannot help", () => {
    expect(decideBackendAuth(null, NOW)).toEqual({ action: "reject", state: AUTH_STATE.noSession });
    expect(decideBackendAuth(session(NOW - 1, { refreshToken: "" }), NOW)).toEqual({
      action: "reject",
      state: AUTH_STATE.noSession,
    });
  });
});

describe("buildBackendUrl", () => {
  const base = "https://api.example.com";
  it("maps the proxy path and keeps the query string", () => {
    expect(buildBackendUrl(base, "/api/backend/api/v1/admin/places", "?q=a%20b&page=2")?.toString()).toBe(
      "https://api.example.com/api/v1/admin/places?q=a%20b&page=2",
    );
  });
  it("refuses anything outside /api/v1, including traversal", () => {
    expect(buildBackendUrl(base, "/api/backend/health", "")).toBeNull();
    expect(buildBackendUrl(base, "/api/backend/api/v1/../../internal", "")).toBeNull();
    expect(buildBackendUrl(base, "/api/backend//evil.com/api/v1/x", "")).toBeNull();
    expect(buildBackendUrl(base, "/api/other/api/v1/x", "")).toBeNull();
  });
});

describe("header handling", () => {
  it("forwards only allowlisted request headers and adds the bearer token", () => {
    const incoming = new Headers({
      "content-type": "image/jpeg",
      "x-place-id": "p1",
      cookie: "gb_access_token=secret",
      authorization: "Bearer spoofed",
      host: "dash.example",
    });
    const out = buildUpstreamHeaders(incoming, "fresh");
    expect(out.get("content-type")).toBe("image/jpeg");
    expect(out.get("x-place-id")).toBe("p1");
    expect(out.get("authorization")).toBe("Bearer fresh");
    expect(out.get("cookie")).toBeNull();
    expect(out.get("host")).toBeNull();
  });

  it("drops encoding, cookies and CORS headers from the response", () => {
    const out = filterResponseHeaders(
      new Headers({
        "content-type": "application/json",
        "content-encoding": "gzip",
        "content-length": "10",
        "set-cookie": "a=b",
        "access-control-allow-origin": "*",
        "content-disposition": "attachment",
      }),
    );
    expect(out.get("content-type")).toBe("application/json");
    expect(out.get("content-disposition")).toBe("attachment");
    expect(out.get("content-encoding")).toBeNull();
    expect(out.get("content-length")).toBeNull();
    expect(out.get("set-cookie")).toBeNull();
    expect(out.get("access-control-allow-origin")).toBeNull();
  });

  it("knows which statuses cannot carry a body", () => {
    expect(isNullBodyStatus(204)).toBe(true);
    expect(isNullBodyStatus(304)).toBe(true);
    expect(isNullBodyStatus(200)).toBe(false);
  });
});

describe("isSameOriginRequest", () => {
  const h = (init: Record<string, string>) => new Headers(init);
  it("requires the custom header", () => {
    expect(isSameOriginRequest(h({ host: "dash.example" }))).toBe(false);
    expect(isSameOriginRequest(h({ [CSRF_HEADER]: "1", host: "dash.example" }))).toBe(true);
  });
  it("rejects cross-site and same-site-but-cross-origin fetches", () => {
    expect(isSameOriginRequest(h({ [CSRF_HEADER]: "1", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(h({ [CSRF_HEADER]: "1", "sec-fetch-site": "same-site" }))).toBe(false);
    expect(
      isSameOriginRequest(h({ [CSRF_HEADER]: "1", origin: "https://evil.example", host: "dash.example" })),
    ).toBe(false);
  });
  it("accepts a same-origin fetch", () => {
    expect(
      isSameOriginRequest(
        h({ [CSRF_HEADER]: "1", "sec-fetch-site": "same-origin", origin: "https://dash.example", host: "dash.example" }),
      ),
    ).toBe(true);
  });
});

describe("session generation helpers", () => {
  it("parses expiresAt defensively", () => {
    expect(parseExpiresAt("1800000000")).toBe(NOW);
    expect(parseExpiresAt("abc")).toBeNull();
    expect(parseExpiresAt("0")).toBeNull();
    expect(parseExpiresAt(undefined)).toBeNull();
  });

  it("checks freshness against a buffer", () => {
    expect(isSessionFresh(NOW + 61, NOW, 60)).toBe(true);
    expect(isSessionFresh(NOW + 60, NOW, 60)).toBe(false);
    expect(isSessionFresh(null, NOW, 0)).toBe(false);
  });

  it("reuses a rotation made by another tab instead of spending the new token", () => {
    // Client saw generation NOW+10 fail; the cookie now holds NOW+3600.
    expect(canReuseRotatedSession(NOW + 3600, NOW + 10, NOW)).toBe(true);
    // Same generation: nobody rotated, a real refresh is needed.
    expect(canReuseRotatedSession(NOW + 3600, NOW + 3600, NOW)).toBe(false);
    // Different but also stale: refresh.
    expect(canReuseRotatedSession(NOW + 20, NOW + 10, NOW)).toBe(false);
    // Client gave no marker: refresh.
    expect(canReuseRotatedSession(NOW + 3600, null, NOW)).toBe(false);
  });
});
