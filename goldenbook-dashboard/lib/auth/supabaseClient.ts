import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in goldenbook-dashboard/.env.local"
    );
  }

  return { url, anonKey };
}

/**
 * Supabase client used ONLY for the password sign-in on /login.
 *
 * It keeps nothing: no localStorage, no auto refresh. The tokens it returns are
 * handed straight to /api/auth/session, which stores them in httpOnly cookies,
 * and from then on the server owns the session. A persisted copy here would be
 * readable by any script on the page (and used to be: persistSession: true put
 * the refresh token in localStorage) and would race the server's refreshes.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getSupabaseConfig();

  browserClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return browserClient;
}

/**
 * Remove sessions that older builds persisted in localStorage
 * (`sb-<project>-auth-token`), so a refresh token does not linger there.
 */
export function purgePersistedSupabaseSessions(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && /^sb-.+-auth-token(-code-verifier)?$/.test(key)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage blocked (private mode, policy): nothing persisted there either.
  }
}
