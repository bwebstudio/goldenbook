import type { DashboardMeResponse, DashboardSession, DashboardUser } from "@/types/auth";
import { getSupabaseBrowserClient } from "@/lib/auth/supabaseClient";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
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

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${body.grant_type}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
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
  if (!data.dashboardRole) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    displayName: data.displayName,
    fullName: data.fullName,
    name: data.fullName ?? data.displayName ?? data.email,
    role: data.dashboardRole,
  };
}

export function getCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getBrowserAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? getCookieValue(document.cookie, AUTH_COOKIE_NAMES.accessToken);
  } catch {
    return getCookieValue(document.cookie, AUTH_COOKIE_NAMES.accessToken);
  }
}

export function shouldRefreshSession(expiresAt: number | null | undefined, bufferSeconds = 60): boolean {
  if (!expiresAt) return true;
  return expiresAt <= Math.floor(Date.now() / 1000) + bufferSeconds;
}
