/**
 * useSocialAuth — Google and Apple sign-in hooks
 *
 * Google: Supabase OAuth (PKCE) via expo-web-browser ASWebAuthenticationSession
 * Apple:  expo-apple-authentication + Supabase signInWithIdToken (iOS only)
 *
 * The session is set via onAuthStateChange in authStore automatically
 * after each successful sign-in. No extra store action needed.
 *
 * Requirements (installed via `npx expo install`):
 *   expo-web-browser, expo-auth-session, expo-apple-authentication, expo-linking
 *
 * Supabase dashboard requirements:
 *   - Google provider enabled under Authentication → Providers
 *   - Apple provider enabled under Authentication → Providers
 *   - Redirect URL in each provider: goldenbook://auth-callback
 */

import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from '@/auth/supabaseClient';

// Required for WebBrowser to complete auth sessions correctly on iOS.
WebBrowser.maybeCompleteAuthSession();

// ─── Google ───────────────────────────────────────────────────────────────────

/**
 * Stable, well-formed deep-link redirect URI for the OAuth callback.
 *
 * IMPORTANT: we deliberately do NOT use the bare `goldenbook://` URL produced
 * by `makeRedirectUri({ scheme: 'goldenbook' })`. A custom-scheme URL with no
 * authority + no path is technically valid per RFC 3986 but causes real-world
 * problems with `ASWebAuthenticationSession` on certain iOS versions: when
 * the system hands the URL back to the app, query parameters can be dropped
 * or reordered, leaving the parser with a URL that contains no `code=…`.
 *
 * The Supabase server then receives a /token POST with an empty/garbled
 * auth_code, looks up the corresponding flow_state row, finds nothing, and
 * returns:
 *
 *     HTTP 404
 *     { "error_code": "flow_state_not_found",
 *       "msg":        "invalid flow state, no valid flow state found" }
 *
 * Adding an explicit path (`/auth-callback`) gives ASWebAuthenticationSession
 * a hierarchical URL (`goldenbook://auth-callback?code=…`) which it round-trips
 * reliably across every iOS version we've seen this on.
 *
 * If you change this constant you MUST also add the new value to:
 *   • Supabase dashboard → Authentication → URL Configuration → Redirect URLs
 *
 * Both the bare `goldenbook://` and `goldenbook://auth-callback` should be
 * whitelisted there during the transition; once the build is verified you
 * can remove the bare entry.
 */
const OAUTH_REDIRECT_URI = 'goldenbook://auth-callback';

/**
 * Parse the deep-link callback URL returned by `WebBrowser.openAuthSessionAsync`.
 *
 * Handles every callback shape we may legitimately see:
 *   • PKCE flow         → `goldenbook://auth-callback?code=…&state=…`
 *   • Implicit flow     → `goldenbook://auth-callback#access_token=…&refresh_token=…&token_type=bearer&expires_in=…`
 *   • OAuth error reply → `goldenbook://auth-callback?error=…&error_description=…` (or in fragment)
 *
 * We deliberately do NOT use `new URL(result.url)` because the React Native
 * URL polyfill is inconsistent about custom schemes and about parsing the
 * hash fragment. We manually split, AND we cross-check with `Linking.parse`
 * (from expo-linking) so we have two independent parsers — if the manual
 * one misses a param due to a weird URL shape, the expo one usually catches it.
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

  // Defensive cross-check using expo-linking's parser as a second opinion.
  // If our manual split missed something, this picks it up.
  let linkingQuery: Record<string, string> = {};
  try {
    const parsed = Linking.parse(rawUrl);
    if (parsed.queryParams) {
      for (const [k, v] of Object.entries(parsed.queryParams)) {
        if (typeof v === 'string') linkingQuery[k] = v;
      }
    }
  } catch {
    // expo-linking failed to parse — fine, we still have the manual result.
  }

  const pickQuery = (key: string): string | null =>
    queryParams.get(key) ?? linkingQuery[key] ?? null;

  return {
    code:             pickQuery('code'),
    accessToken:      hashParams.get('access_token')  ?? pickQuery('access_token'),
    refreshToken:     hashParams.get('refresh_token') ?? pickQuery('refresh_token'),
    errorCode:        pickQuery('error')              ?? hashParams.get('error'),
    errorDescription: pickQuery('error_description')  ?? hashParams.get('error_description'),
  };
}

// makeRedirectUri is intentionally unused now — kept imported only for the
// historical record in case we ever need to roll back. Suppress the lint hint.
void makeRedirectUri;

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const signIn = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Ask Supabase for the Google OAuth URL.
      //
      // We do NOT pass `skipBrowserRedirect: true`. The supabase-js source
      // shows that flag is only honored inside `if (isBrowser())`, so on
      // React Native it does nothing — except leak `skip_http_redirect=true`
      // into Google's OAuth URL, which is noise that some intermediate URL
      // parsers misinterpret. Omitting it keeps the OAuth URL clean.
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: OAUTH_REDIRECT_URI,
          // PKCE is set globally via flowType: 'pkce' in supabaseClient.ts,
          // so this call will automatically include code_challenge in the URL.
        },
      });

      if (oauthError) {
        if (__DEV__) console.warn('[useGoogleSignIn] signInWithOAuth error:', oauthError);
        throw oauthError;
      }
      if (!data?.url) {
        throw new Error('No OAuth URL returned from Supabase.');
      }

      if (__DEV__) console.log('[useGoogleSignIn] opening OAuth URL:', data.url);

      // 2. Open the system web auth session.
      //
      // We pass the same redirect URI as the second arg so iOS knows which
      // deep link to intercept and return to the app.
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        OAUTH_REDIRECT_URI,
        {
          // showInRecents: keeps the auth session in the iOS app switcher
          // momentarily while it's running, which makes the flow feel smoother.
          showInRecents: true,
        },
      );

      if (__DEV__) console.log('[useGoogleSignIn] WebBrowser result:', JSON.stringify(result));

      // 3. User cancelled the iOS web auth permission alert or closed Safari.
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return; // silent
      }

      if (result.type !== 'success') {
        throw new Error(`Unexpected OAuth result: ${result.type}`);
      }

      if (!result.url) {
        throw new Error('OAuth callback returned no URL.');
      }

      // 4. Parse the callback URL.
      const parsed = parseOAuthCallback(result.url);
      if (__DEV__) {
        console.log('[useGoogleSignIn] parsed callback:', {
          hasCode:         !!parsed.code,
          hasAccessToken:  !!parsed.accessToken,
          hasRefreshToken: !!parsed.refreshToken,
          errorCode:       parsed.errorCode,
        });
      }

      // 5. Provider returned an explicit OAuth error.
      if (parsed.errorCode) {
        throw new Error(parsed.errorDescription || parsed.errorCode);
      }

      // 6. PKCE flow: exchange the code for a session.
      if (parsed.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.code);
        if (exchangeError) {
          if (__DEV__) console.warn('[useGoogleSignIn] exchangeCodeForSession error:', exchangeError);
          // Surface the actual server error code so we know if it's e.g.
          // `flow_state_not_found` (PKCE verifier mismatch / lost) vs.
          // `bad_code_verifier` (verifier in storage is wrong).
          throw exchangeError;
        }
        // onAuthStateChange in authStore fires and updates session automatically.
        return;
      }

      // 7. Implicit-flow fallback: Supabase returned #access_token=…&refresh_token=…
      // Should not happen now that flowType is 'pkce', but kept as a defensive
      // net so a future SDK regression doesn't silently re-introduce the bug.
      if (parsed.accessToken && parsed.refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token:  parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (setSessionError) throw setSessionError;
        return;
      }

      // 8. Got back a callback URL we don't recognise — surface it loudly.
      if (__DEV__) console.warn('[useGoogleSignIn] Unparseable callback URL:', result.url);
      throw new Error(
        `Sign-in completed but no session token was returned. Callback URL: ${result.url.substring(0, 200)}`,
      );
    } catch (e: any) {
      if (__DEV__) console.warn('[useGoogleSignIn] failed:', e);
      // Prefer the explicit Supabase error code when present so the user
      // sees something actionable instead of a generic message.
      const message =
        e?.message ??
        (typeof e === 'string' ? e : 'Google sign-in failed. Please try again.');
      setError(message);
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
