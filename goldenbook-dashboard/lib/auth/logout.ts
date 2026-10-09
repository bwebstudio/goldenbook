import { markLoggingOut } from "@/lib/api/client";
import { CSRF_HEADER } from "@/lib/auth/session-policy";
import { purgePersistedSupabaseSessions } from "@/lib/auth/supabaseClient";

/**
 * Shared logout for the employee sidebar and the business portal.
 *
 * The browser holds no tokens any more (httpOnly cookies), so the Supabase
 * sign-out that supabase-js used to do here now happens in /api/auth/logout,
 * which revokes the session and clears the cookies. Never throws.
 */
export async function logoutSession(): Promise<void> {
  // Signal the API client to stop all requests immediately.
  markLoggingOut();
  purgePersistedSupabaseSessions();
  try {
    await fetch("/api/auth/logout", { method: "POST", headers: { [CSRF_HEADER]: "1" } });
  } catch {
    // Network error: the cookies stay until they expire, but the user is sent
    // to /login regardless.
  }
}
