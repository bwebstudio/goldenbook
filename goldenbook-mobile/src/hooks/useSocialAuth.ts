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
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from '@/auth/supabaseClient';

// Required for WebBrowser to complete auth sessions correctly on iOS.
WebBrowser.maybeCompleteAuthSession();

// ─── Google ───────────────────────────────────────────────────────────────────

/**
 * Parse the deep-link callback URL returned by `WebBrowser.openAuthSessionAsync`.
 *
 * Handles every callback shape we may legitimately see:
 *   • PKCE flow         → `goldenbook://?code=…&state=…`
 *   • Implicit flow     → `goldenbook://#access_token=…&refresh_token=…&token_type=bearer&expires_in=…`
 *   • OAuth error reply → `goldenbook://?error=…&error_description=…` (or in fragment)
 *
 * We deliberately do NOT use `new URL(result.url)` because the React Native
 * URL polyfill is inconsistent about custom schemes (`goldenbook://`) and
 * about parsing the hash fragment. Manual splitting is short and reliable.
 */
function parseOAuthCallback(rawUrl: string): {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  errorCode: string | null;
  errorDescription: string | null;
} {
  const queryIdx = rawUrl.indexOf('?');
  const hashIdx  = rawUrl.indexOf('#');

  let queryStr = '';
  let hashStr  = '';

  if (queryIdx !== -1 && hashIdx !== -1 && queryIdx < hashIdx) {
    queryStr = rawUrl.substring(queryIdx + 1, hashIdx);
    hashStr  = rawUrl.substring(hashIdx + 1);
  } else if (queryIdx !== -1) {
    queryStr = rawUrl.substring(queryIdx + 1);
  } else if (hashIdx !== -1) {
    hashStr = rawUrl.substring(hashIdx + 1);
  }

  const queryParams = new URLSearchParams(queryStr);
  const hashParams  = new URLSearchParams(hashStr);

  return {
    code:             queryParams.get('code'),
    accessToken:      hashParams.get('access_token')  ?? queryParams.get('access_token'),
    refreshToken:     hashParams.get('refresh_token') ?? queryParams.get('refresh_token'),
    errorCode:        queryParams.get('error')             ?? hashParams.get('error'),
    errorDescription: queryParams.get('error_description') ?? hashParams.get('error_description'),
  };
}

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
      if (!data?.url) throw new Error('No OAuth URL returned from Supabase.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      // ── User cancelled the iOS web auth permission alert or closed Safari ──
      if (result.type === 'cancel' || result.type === 'dismiss') {
        // Truly silent — this is a normal user action, not an error.
        return;
      }

      if (result.type !== 'success') {
        throw new Error(`Unexpected OAuth result: ${result.type}`);
      }

      if (!result.url) {
        throw new Error('OAuth callback returned no URL.');
      }

      const parsed = parseOAuthCallback(result.url);

      // ── Provider returned an explicit OAuth error ──
      if (parsed.errorCode) {
        throw new Error(parsed.errorDescription || parsed.errorCode);
      }

      // ── PKCE flow: Supabase returned ?code=… (default after enabling flowType: 'pkce') ──
      if (parsed.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.code);
        if (exchangeError) throw exchangeError;
        // onAuthStateChange in authStore fires and updates session automatically.
        return;
      }

      // ── Implicit-flow fallback: Supabase returned #access_token=…&refresh_token=… ──
      // Should not happen now that flowType is 'pkce', but kept as a defensive
      // net so a future SDK regression doesn't silently re-introduce the bug.
      if (parsed.accessToken && parsed.refreshToken) {
        const { error: setError } = await supabase.auth.setSession({
          access_token:  parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (setError) throw setError;
        return;
      }

      // ── Got back a callback URL we don't recognise — surface it loudly ──
      if (__DEV__) console.warn('[useGoogleSignIn] Unparseable callback URL:', result.url);
      throw new Error('Sign-in completed but no session token was returned. Please try again.');
    } catch (e: any) {
      if (__DEV__) console.warn('[useGoogleSignIn] failed:', e);
      setError(e?.message ?? 'Google sign-in failed. Please try again.');
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
      // Static import is safe here because the iOS check above short-circuits
      // on Android before any native method is called.
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
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
