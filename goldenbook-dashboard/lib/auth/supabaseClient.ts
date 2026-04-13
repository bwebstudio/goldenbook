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

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getSupabaseConfig();

  browserClient = createClient(url, anonKey, {
    auth: {
      // The Next.js middleware already handles token refresh via
      // refreshDashboardSession(). If the browser client ALSO tries to
      // auto-refresh, the two race and Supabase rejects the second
      // attempt with "Invalid Refresh Token: Already Used".
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return browserClient;
}
