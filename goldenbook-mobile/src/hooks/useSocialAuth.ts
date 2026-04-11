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
import { Alert, Platform } from 'react-native';
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

/**
 * Process a callback URL — used both by the WebBrowser path and by the
 * parallel `Linking.addEventListener('url', …)` listener. Returns:
 *   • { ok: true }                  → session created, user is now signed in
 *   • { ok: false, message: '…' }   → caller should show this in the UI
 *   • { ok: false, silent: true }   → user-initiated cancel, do nothing
 */
async function handleCallbackUrl(rawUrl: string): Promise<
  | { ok: true }
  | { ok: false; message: string; silent?: false }
  | { ok: false; silent: true }
> {
  if (__DEV__) console.log('[useGoogleSignIn] handling callback URL:', rawUrl);

  const parsed = parseOAuthCallback(rawUrl);
  if (__DEV__) {
    console.log('[useGoogleSignIn] parsed callback:', {
      hasCode:         !!parsed.code,
      hasAccessToken:  !!parsed.accessToken,
      hasRefreshToken: !!parsed.refreshToken,
      errorCode:       parsed.errorCode,
    });
  }

  if (parsed.errorCode) {
    if (parsed.errorCode === 'access_denied') {
      return { ok: false, silent: true };
    }
    return { ok: false, message: parsed.errorDescription || parsed.errorCode };
  }

  if (parsed.code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (exchangeError) {
      if (__DEV__) console.warn('[useGoogleSignIn] exchangeCodeForSession error:', exchangeError);
      return {
        ok: false,
        message: `${(exchangeError as any).code ?? 'exchange_failed'}: ${exchangeError.message}`,
      };
    }
    return { ok: true };
  }

  if (parsed.accessToken && parsed.refreshToken) {
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token:  parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (setSessionError) {
      return { ok: false, message: setSessionError.message };
    }
    return { ok: true };
  }

  return {
    ok: false,
    message: `No session token in callback: ${rawUrl.substring(0, 160)}`,
  };
}

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const signIn = async () => {
    setLoading(true);
    setError('');

    // ── Parallel deep-link listener ──────────────────────────────────────
    //
    // CRITICAL: We attach a Linking listener BEFORE opening the WebBrowser
    // because of a known race condition with `expo-web-browser` 14.0.2 +
    // ASWebAuthenticationSession on iOS:
    //
    //   When the user already has an active Google Safari session (so the
    //   OAuth round-trip completes in milliseconds with no UI), the URL
    //   handoff back to `WebBrowser.openAuthSessionAsync` can race with the
    //   system's deep-link delivery. The promise sometimes resolves with
    //   `{ type: 'dismiss' }` BEFORE the URL is attached to it, while iOS
    //   ALSO fires the `url` event on the standard React Native Linking
    //   bridge. If we only listen on `openAuthSessionAsync`, we silently
    //   throw the auth code away and the user falls back to the login screen.
    //
    // The fix is to race the two channels:
    //   • `firstUrlPromise`            → resolves on the first Linking 'url' event
    //   • `WebBrowser.openAuthSessionAsync(...)` → resolves with its own result
    //
    // Whichever resolves first AND yields a parseable callback URL wins.
    let urlListener: { remove: () => void } | null = null;
    const firstUrlPromise = new Promise<string>((resolve) => {
      urlListener = Linking.addEventListener('url', (event) => {
        if (__DEV__) console.log('[useGoogleSignIn] Linking url event:', event.url);
        if (event.url && event.url.startsWith('goldenbook://')) {
          resolve(event.url);
        }
      });
    });

    const cleanupListener = () => {
      try {
        urlListener?.remove();
      } catch {
        // ignore
      }
      urlListener = null;
    };

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

      // 2. Open the system web auth session AND race it against the deep-link
      //    listener we attached above. We do NOT `await` openAuthSessionAsync
      //    on its own — we put it in a Promise.race against `firstUrlPromise`
      //    so whichever channel delivers the callback URL first wins.
      const browserResultPromise = WebBrowser.openAuthSessionAsync(
        data.url,
        OAUTH_REDIRECT_URI,
        { showInRecents: true },
      );

      // Wrap the WebBrowser promise so the race resolves with a uniform shape.
      const wrappedBrowser = browserResultPromise.then((result) => {
        if (__DEV__) console.log('[useGoogleSignIn] WebBrowser result:', JSON.stringify(result));
        return { source: 'browser' as const, result };
      });

      const wrappedListener = firstUrlPromise.then((url) => ({
        source: 'listener' as const,
        url,
      }));

      const winner = await Promise.race([wrappedBrowser, wrappedListener]);

      // 3a. Listener got the URL first — process it directly.
      if (winner.source === 'listener') {
        if (__DEV__) console.log('[useGoogleSignIn] Linking listener won the race');
        // Try to dismiss any in-flight Safari session that didn't notice
        // the URL was already handled. This is best-effort; failures are fine.
        try {
          WebBrowser.dismissAuthSession();
        } catch {
          // ignore
        }
        const outcome = await handleCallbackUrl(winner.url);
        if (outcome.ok) return;
        if ('silent' in outcome && outcome.silent) return;
        throw new Error(outcome.message);
      }

      // 3b. WebBrowser resolved first.
      const result = winner.result;

      // 3b.i. User cancelled — but BEFORE giving up, give the Linking
      //       listener a 250ms grace period in case the URL is in flight.
      //       Some iOS versions report `cancel`/`dismiss` but the deep
      //       link still arrives a few hundred ms later.
      if (result.type === 'cancel' || result.type === 'dismiss') {
        if (__DEV__) {
          console.log('[useGoogleSignIn] WebBrowser said cancel/dismiss; waiting 250ms for late URL');
        }
        const lateUrl = await Promise.race([
          firstUrlPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 250)),
        ]);
        if (typeof lateUrl === 'string') {
          if (__DEV__) console.log('[useGoogleSignIn] late URL arrived after cancel:', lateUrl);
          const outcome = await handleCallbackUrl(lateUrl);
          if (outcome.ok) return;
          if ('silent' in outcome && outcome.silent) return;
          throw new Error(outcome.message);
        }
        return; // genuine cancel — silent
      }

      if (result.type !== 'success') {
        throw new Error(`Unexpected OAuth result: ${result.type}`);
      }
      if (!result.url) {
        throw new Error('OAuth callback returned no URL.');
      }

      const outcome = await handleCallbackUrl(result.url);
      if (outcome.ok) return;
      if ('silent' in outcome && outcome.silent) return;
      throw new Error(outcome.message);
    } catch (e: any) {
      if (__DEV__) console.warn('[useGoogleSignIn] failed:', e);
      const message =
        e?.message ??
        (typeof e === 'string' ? e : 'Google sign-in failed. Please try again.');
      setError(message);
      // Also surface the error via a native Alert so it's impossible to miss
      // — the in-screen banner can be obscured by the keyboard or by the
      // user being on a different screen by the time we resolve.
      try {
        Alert.alert('Google sign-in', message);
      } catch {
        // ignore
      }
    } finally {
      cleanupListener();
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
