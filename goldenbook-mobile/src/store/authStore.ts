import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/auth/supabaseClient';
import { removeAuthToken, setAuthToken } from '@/auth/tokenStorage';
import { useAppStore } from '@/store/appStore';
import { useOnboardingStore } from '@/store/onboardingStore';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

// ─── Local cleanup — always runs regardless of whether Supabase signOut succeeded ──

async function cleanupLocalState(set: (state: Partial<AuthState>) => void) {
  try {
    await removeAuthToken();
  } catch {
    // Non-fatal — token key may already be absent
  }
  useAppStore.getState().resetLocalitySelection();
  useOnboardingStore.getState().resetOnboarding();
  set({ session: null, user: null });
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,

  initialize: async () => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        // Stored session is corrupted or the refresh token is already invalid.
        // Clear local state immediately so the navigation guard redirects to /auth.
        console.warn('[AuthStore] getSession error — clearing local state:', error.message);
        await cleanupLocalState(set);
        return;
      }

      const session = data.session;
      if (session?.access_token) {
        await setAuthToken(session.access_token).catch(() => {});
      }
      set({ session, user: session?.user ?? null, isLoading: false });
    } catch (err) {
      console.warn('[AuthStore] initialize failed:', err);
      set({ session: null, user: null, isLoading: false });
    }

    // Subscribe to future auth state changes (token refresh, sign-in, sign-out).
    // Supabase emits SIGNED_OUT when auto-refresh fails, so this is the
    // authoritative source for session validity after initialize().
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        await setAuthToken(session.access_token).catch(() => {});
      } else {
        await removeAuthToken().catch(() => {});
      }
      set({ session, user: session?.user ?? null });
    });
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // If email confirmation is disabled, a session is returned immediately.
    // If confirmation is required, data.session is null — the user must verify
    // their email before signing in. Either way we don't throw.
    if (data.session?.access_token) {
      await setAuthToken(data.session.access_token).catch(() => {});
      set({ session: data.session, user: data.user });
    }
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session?.access_token) {
      await setAuthToken(data.session.access_token).catch(() => {});
    }
    set({ session: data.session, user: data.user });
  },

  signOut: async () => {
    // Attempt a server-side sign-out to invalidate the refresh token.
    // If the session is already gone (expired, revoked, or dev-reset), the
    // Supabase SDK throws "Invalid Refresh Token" — we catch it and continue
    // with local cleanup so the app is never left in a broken state.
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthStore] signOut error (session may have already been invalidated):', err);
    }
    await cleanupLocalState(set);
  },
}));
