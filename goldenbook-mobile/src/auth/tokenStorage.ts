import { supabase } from '@/auth/supabaseClient';

// Single source of truth: the Supabase session. We used to maintain a parallel
// copy of the access_token in SecureStore (`goldenbook_auth_token`), which
// could desynchronise from Supabase's own storage on transient SecureStore
// errors, on background refresh, or on cold start while a refresh was in
// flight. The result was the request interceptor sending an empty
// Authorization header (or a stale token) and the backend replying 401 —
// which the global 401 handler then translated into a forced signOut.
//
// Now we always derive the token from `supabase.auth.getSession()` (cheap
// after first hydration — reads from in-memory cache) and proactively call
// `refreshSession()` when the token is within REFRESH_LEEWAY_S of expiry.
// supabase-js dedupes concurrent refreshes internally, so it is safe for the
// interceptor to call this on every request.

const REFRESH_LEEWAY_S = 60;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function isExpiringSoon(expiresAt: number | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt - nowSec() <= REFRESH_LEEWAY_S;
}

/**
 * Returns a non-stale access token for outgoing API calls, or null if the
 * user has no session. Refreshes proactively when the cached token is at or
 * past `expires_at - REFRESH_LEEWAY_S`. Never throws.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;

    if (isExpiringSoon(data.session.expires_at)) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        // Refresh failed — caller will get null and the request will go out
        // unauthenticated. The 401 response handler will then sign the user
        // out cleanly (refresh_token revoked / expired).
        if (__DEV__) {
          console.warn('[tokenStorage] refresh failed:', refreshError?.message);
        }
        return null;
      }
      return refreshed.session.access_token;
    }

    return data.session.access_token;
  } catch (err) {
    if (__DEV__) console.warn('[tokenStorage] getAuthToken threw:', err);
    return null;
  }
}

/**
 * Returns metadata about the current session without exposing the token.
 * Used for safe diagnostic logging.
 */
export async function getSessionDiagnostics(): Promise<{
  hasSession: boolean;
  expiresAt: number | null;
  secondsUntilExpiry: number | null;
}> {
  try {
    const { data } = await supabase.auth.getSession();
    const expiresAt = data.session?.expires_at ?? null;
    return {
      hasSession: !!data.session,
      expiresAt,
      secondsUntilExpiry: expiresAt ? expiresAt - nowSec() : null,
    };
  } catch {
    return { hasSession: false, expiresAt: null, secondsUntilExpiry: null };
  }
}
