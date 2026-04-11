import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// ─── Public Supabase config ────────────────────────────────────────────────────
// These values are publishable / anon — explicitly safe to ship in client builds
// (see .env.example). They are duplicated here as hard fallbacks so a misconfigured
// EAS env block can never crash the JS bundle on import. Without these fallbacks,
// `createClient(undefined, undefined)` throws synchronously at module load and the
// app crashes before the splash can render.
const FALLBACK_SUPABASE_URL = 'https://ltdhyshuhkvicsvtssjm.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_Ri9l7farexx8MG6P70HZxA_BkSNq6ru';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

if (__DEV__ && (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)) {
  console.warn('[supabaseClient] EXPO_PUBLIC_SUPABASE_URL/ANON_KEY missing — using hardcoded fallback.');
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
