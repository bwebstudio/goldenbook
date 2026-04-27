import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/auth/supabaseClient';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { sessionStart, track } from '@/analytics/track';
import { api } from '@/api/endpoints';

interface AuthState {
  session: Session | null;
  user: User | null;
  /** True while the very first hydration is in flight. Flips to false once
   *  Supabase has either restored a session from SecureStore, confirmed
   *  there's none, or errored. The splash gate and navigation guard wait on
   *  this. */
  isLoading: boolean;
  /** True after the first auth resolution. The feed query — and any other
   *  query that depends on `session` — must be gated on this so it never
   *  fires before Supabase has had a chance to restore the persisted
   *  session, which used to manifest as the false "Could not load your feed"
   *  error after a cold start. */
  isHydrated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

// ─── Post-login session identify ───────────────────────────────────────────
//
// Why this exists: `useSessionLifecycle` runs once at app boot and fires
// `sessionStart()` + `track('app_session_start')` with whatever auth state
// exists at that moment. If the user signs in *after* boot, neither the
// `user_sessions` row nor the `app_session_start` event gets a user_id,
// and the analytics DAU/WAU count — which relies on `analytics_events.user_id`
// with a session-JOIN fallback — under-reports that user until they navigate
// somewhere else that fires a tracked event.
function identifyCurrentSession() {
  const ctx = {
    locale:     useSettingsStore.getState().locale,
    city:       useAppStore.getState().selectedCity ?? undefined,
    appVersion: Constants.expoConfig?.version,
    deviceType: (Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web') as
      'ios' | 'android' | 'web',
  };
  sessionStart(ctx);
  track('app_session_start', { metadata: ctx });
}

function logAuthEvent(event: string, session: Session | null) {
  if (!__DEV__) return;
  const expiresAt = session?.expires_at ?? null;
  const secondsUntilExpiry =
    expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : null;
  console.log('[AuthStore]', event, {
    hasSession: !!session,
    secondsUntilExpiry,
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────

let hasInitialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isHydrated: false,

  initialize: async () => {
    // Idempotent — calling initialize() twice (e.g. fast refresh) must not
    // double-subscribe to onAuthStateChange or produce duplicate analytics.
    if (hasInitialized) return;
    hasInitialized = true;

    // ── React Native auto-refresh wiring ───────────────────────────────────
    // supabase-js's `autoRefreshToken: true` only refreshes while the JS
    // realm is foregrounded. On React Native we have to suspend the timer
    // when the app backgrounds and resume it on `active`, otherwise the
    // refresh that was supposed to happen at minute 55 of a 60-minute
    // access_token never fires while the app is in the background, the
    // user returns hours later, and the very first request to `/discover`
    // 401s. Wire this once at boot.
    supabase.auth.startAutoRefresh();
    AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    // Subscribe FIRST so we never miss an INITIAL_SESSION / TOKEN_REFRESHED
    // event that fires while getSession() is still in flight. Previously the
    // listener was attached after getSession() resolved, which meant a
    // recovered session arriving slightly after a transient storage error
    // could leave the store inconsistent.
    supabase.auth.onAuthStateChange((event, session) => {
      logAuthEvent(`onAuthStateChange:${event}`, session);

      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
        isHydrated: true,
      });

      // Only fire identify on a genuine sign-in, not on INITIAL_SESSION /
      // TOKEN_REFRESHED / SIGNED_OUT / USER_UPDATED. `useSessionLifecycle`
      // already handles the already-signed-in boot path on mount.
      if (event === 'SIGNED_IN' && session?.user) {
        identifyCurrentSession();
      }
    });

    try {
      const { data, error } = await supabase.auth.getSession();
      logAuthEvent('initialize:getSession', data?.session ?? null);

      if (error) {
        // A getSession() error is almost always a transient SecureStore read
        // failure or a malformed cached payload. We DO NOT wipe local state
        // here — the onAuthStateChange listener above is already wired up,
        // so if Supabase eventually recovers the session it will re-broadcast
        // it. Wiping here is what produced the cold-start "feed won't load"
        // bug: the manual token was deleted while supabase-js still held a
        // valid in-memory session.
        if (__DEV__) console.warn('[AuthStore] getSession error (non-fatal):', error.message);
      }

      // If onAuthStateChange has already fired (it usually does within a few
      // ms of subscription on supabase-js v2), `isHydrated` is already true
      // and this set() is a no-op. If not, we still need to flip the flags
      // so the splash can complete.
      if (!get().isHydrated) {
        set({
          session: data?.session ?? null,
          user: data?.session?.user ?? null,
          isLoading: false,
          isHydrated: true,
        });
      }
    } catch (err) {
      if (__DEV__) console.warn('[AuthStore] initialize threw:', err);
      // Last-resort: never leave the splash hanging forever.
      if (!get().isHydrated) {
        set({ session: null, user: null, isLoading: false, isHydrated: true });
      }
    }
  },

  // ── Sign Up ──────────────────────────────────────────────────────────────
  // Registers the user via our backend. Does NOT sign in automatically.
  // The user must verify their email before they can sign in.
  signUp: async (email, password) => {
    try {
      await api.register(email, password);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverBody = err?.response?.data;
      const serverError = typeof serverBody === 'object' && serverBody !== null
        ? serverBody.error
        : undefined;

      if (__DEV__) console.warn('[signUp] register failed:', { status, serverError, raw: err?.message });

      if (status === 409) {
        if (serverError === 'EMAIL_UNVERIFIED') {
          const e = new Error('EMAIL_UNVERIFIED');
          (e as any).code = 'EMAIL_UNVERIFIED';
          throw e;
        }
        const e = new Error('EMAIL_ALREADY_EXISTS');
        (e as any).code = 'EMAIL_ALREADY_EXISTS';
        throw e;
      }

      if (status === 400) {
        throw new Error('Please check your email and password.');
      }

      const e = new Error('SIGNUP_FAILED');
      (e as any).code = 'SIGNUP_FAILED';
      throw e;
    }
  },

  // ── Sign In ──────────────────────────────────────────────────────────────
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // No manual token persistence — supabase-js + onAuthStateChange handles
    // both the SecureStore write and the store update.

    try {
      const { email_verified } = await api.verificationStatus();

      if (!email_verified) {
        await supabase.auth.signOut().catch(() => {});

        const e = new Error('EMAIL_NOT_VERIFIED');
        (e as any).code = 'EMAIL_NOT_VERIFIED';
        throw e;
      }
    } catch (err: any) {
      if (err?.code === 'EMAIL_NOT_VERIFIED') throw err;
      // Verification check is best-effort — don't block login on backend
      // hiccups. The session itself is already valid.
      if (__DEV__) console.warn('[signIn] verification check failed, allowing login:', err?.message);
    }

    set({ session: data.session, user: data.user });
  },

  resetPassword: async (email) => {
    await api.forgotPassword(email);
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      if (__DEV__) console.warn('[AuthStore] signOut error (session may have already been invalidated):', err);
    }
    // Local state is updated by the SIGNED_OUT onAuthStateChange event, but
    // we also clear synchronously here so any code reading the store on the
    // very next tick sees a logged-out state.
    useAppStore.getState().resetLocalitySelection();
    set({ session: null, user: null });
  },
}));
