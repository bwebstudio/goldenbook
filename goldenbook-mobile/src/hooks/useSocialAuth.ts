/**
 * useSocialAuth — Google and Apple sign-in hooks
 *
 * Google: Supabase OAuth + expo-web-browser (PKCE flow, no client ID needed client-side)
 * Apple:  expo-apple-authentication + Supabase signInWithIdToken (iOS only)
 *
 * The session is set via onAuthStateChange in authStore automatically
 * after each successful sign-in. No extra store action needed.
 *
 * Requirements (installed via `npx expo install`):
 *   expo-web-browser, expo-auth-session, expo-apple-authentication
 *
 * Supabase dashboard requirements:
 *   - Google provider enabled under Authentication → Providers
 *   - Apple provider enabled under Authentication → Providers
 *   - Redirect URL in each provider: goldenbook://
 */

import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import { supabase } from '@/auth/supabaseClient';

// Required for WebBrowser to complete auth sessions correctly on iOS.
WebBrowser.maybeCompleteAuthSession();

// ─── Google ───────────────────────────────────────────────────────────────────

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const signIn = async () => {
    setLoading(true);
    setError('');
    try {
      const redirectTo = makeRedirectUri({ scheme: 'goldenbook' });

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('No OAuth URL returned from Supabase.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        // PKCE: Supabase redirects with ?code=xxx
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          // onAuthStateChange in authStore fires and updates session automatically.
        }
      }
      // result.type === 'cancel' or 'dismiss' → user closed the browser, silently ignore.
    } catch (e: any) {
      setError(e.message ?? 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return { signIn, loading, error };
}

// ─── Apple ────────────────────────────────────────────────────────────────────

export function useAppleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const signIn = async () => {
    if (Platform.OS !== 'ios') return;
    setLoading(true);
    setError('');
    try {
      // Import at call-site: prevents Android native module resolution errors.
      const AppleAuth = await import('expo-apple-authentication');

      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }

      const { error: idTokenError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (idTokenError) throw idTokenError;
      // onAuthStateChange fires and updates session automatically.
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELED') return; // User cancelled — silent.
      setError(e.message ?? 'Apple sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return { signIn, loading, error };
}
