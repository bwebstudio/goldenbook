import type { DashboardMeResponse, DashboardSession, DashboardUser } from "@/types/auth";

/**
 * Backend base URL. Missing protocol is tolerated (a bare host in the env var
 * used to cause ERR_INVALID_URL).
 */
export function resolveApiBaseUrl(): string {
  let url = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

const API_BASE_URL = resolveApiBaseUrl();
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const AUTH_COOKIE_NAMES = {
  accessToken: "gb_access_token",
  refreshToken: "gb_refresh_token",
  expiresAt: "gb_expires_at",
} as const;

interface SupabaseTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** A Supabase token-endpoint failure. `status` is 0 for network errors. */
export class SupabaseAuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "SupabaseAuthError";
  }

  /**
   * True when Supabase definitively rejected the grant (expired, revoked or
   * already-used refresh token). False for outages and network blips, which
   * are worth retrying.
   */
  get isRejection(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }
}

function assertPublicEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in goldenbook-dashboard/.env.local"
    );
  }
}

function toSession(data: SupabaseTokenResponse): DashboardSession {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error_description?: string; msg?: string; message?: string };
    return data.error_description ?? data.msg ?? data.message ?? "Authentication failed.";
  } catch {
    return "Authentication failed.";
  }
}

async function callSupabaseTokenEndpoint(body: Record<string, unknown>): Promise<DashboardSession> {
  assertPublicEnv();

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${body.grant_type}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    throw new SupabaseAuthError(err instanceof Error ? err.message : "Network error", 0);
  }

  if (!response.ok) {
    throw new SupabaseAuthError(await parseErrorMessage(response), response.status);
  }

  const data = (await response.json()) as SupabaseTokenResponse;
  return toSession(data);
}

export async function refreshDashboardSession(refreshToken: string): Promise<DashboardSession> {
  return callSupabaseTokenEndpoint({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function fetchCurrentUser(accessToken: string): Promise<DashboardUser | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Could not load the current user.");
  }

  const data = (await response.json()) as DashboardMeResponse;
  return mapCurrentUser(data);
}

export function mapCurrentUser(data: DashboardMeResponse): DashboardUser | null {
  const places = data.places ?? [];

  // Admin users get their dashboardRole directly
  if (data.dashboardRole) {
    return {
      id: data.id,
      email: data.email,
      displayName: data.displayName,
      fullName: data.fullName,
      name: data.fullName ?? data.displayName ?? data.email,
      role: data.dashboardRole,
      places,
    };
  }

  // Business clients get access via businessClient field or place_users
  if (data.businessClient || places.length > 0) {
    return {
      id: data.id,
      email: data.email,
      displayName: data.displayName,
      fullName: data.fullName,
      name: data.fullName ?? data.displayName ?? data.email,
      role: "business_client",
      businessClient: data.businessClient,
      places,
    };
  }

  return null;
}

export function getCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Best-effort server-side sign-out: revokes the refresh token at Supabase so a
 * copy of the cookie stops working too. Never throws.
 */
export async function revokeSupabaseSession(accessToken: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !accessToken) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    // The cookies are cleared anyway; the token expires on its own.
  }
}
