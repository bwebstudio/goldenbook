import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/auth/supabaseClient';
import { removeAuthToken, setAuthToken } from '@/auth/tokenStorage';
import { useAppStore } from '@/store/appStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { api } from '@/api/endpoints';

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

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        await setAuthToken(session.access_token).catch(() => {});
      } else {
        await removeAuthToken().catch(() => {});
      }
      set({ session, user: session?.user ?? null });
    });
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

      console.warn('[signUp] register failed:', { status, serverError, raw: err?.message });

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

    // Do NOT auto-sign-in. The user must verify their email first.
    // The register screen will show a pending-verification state.
  },

  // ── Sign In ──────────────────────────────────────────────────────────────
  // Signs in via Supabase, then checks email verification status.
  // If the email is not verified, signs out immediately and throws.

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.session?.access_token) {
      await setAuthToken(data.session.access_token).catch(() => {});
    }

    // Check email verification status via our backend
    try {
      const { email_verified } = await api.verificationStatus();

      if (!email_verified) {
        // Not verified — sign out immediately and block access
        await supabase.auth.signOut().catch(() => {});
        await removeAuthToken().catch(() => {});

        const e = new Error('EMAIL_NOT_VERIFIED');
        (e as any).code = 'EMAIL_NOT_VERIFIED';
        throw e;
      }
    } catch (err: any) {
      // If the error is our EMAIL_NOT_VERIFIED, re-throw it
      if (err?.code === 'EMAIL_NOT_VERIFIED') throw err;
      // For any other error (network, 404, etc.), allow login to proceed.
      // The verification check is best-effort — we don't want to block
      // users if the backend is temporarily down.
      console.warn('[signIn] verification check failed, allowing login:', err?.message);
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
      console.warn('[AuthStore] signOut error (session may have already been invalidated):', err);
    }
    await cleanupLocalState(set);
  },
}));
