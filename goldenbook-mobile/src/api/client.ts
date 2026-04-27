import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAuthToken, getSessionDiagnostics } from '@/auth/tokenStorage';

// NOTE: Do NOT statically import `@/store/authStore` or `expo-router` here.
// `authStore` imports `@/api/endpoints` which imports this file, which would
// create a load-order cycle (client → authStore → endpoints → client). In
// Metro's production bundle that cycle has been observed to leave the
// `useAuthStore` binding undefined at the time the 401 interceptor first
// fires, throwing inside an async response handler and crashing the app
// immediately after the splash. Both modules are now resolved lazily inside
// the response handler below, which runs long after every module has
// finished evaluating.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__
  ? 'http://localhost:3001/api/v1'
  : 'https://goldenbook-production.up.railway.app/api/v1'
);

// Stable session ID for NOW anti-repetition tracking and analytics. Lives for
// the process lifetime; a new ID is generated on cold boot.
export const SESSION_ID = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEVICE_TYPE: 'ios' | 'android' | 'web' =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request flag we set on a config object after one refresh-and-retry attempt
// so a second 401 propagates instead of looping forever.
type RetriableConfig = InternalAxiosRequestConfig & { _gbRetried?: boolean };

apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['x-session-id']  = SESSION_ID;
  config.headers['x-device-type'] = DEVICE_TYPE;
  config.headers['x-app-version'] = APP_VERSION;

  // Auto-inject the user's current locale as a query param on GET requests
  // that don't already specify one. Eliminates the silent `locale='en'`
  // default that was masking the wrong-language bug.
  try {
    if ((config.method ?? 'get').toLowerCase() === 'get') {
      const params = (config.params = config.params ?? {});
      if (params.locale == null) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useSettingsStore } =
          require('@/store/settingsStore') as typeof import('@/store/settingsStore');
        const locale = useSettingsStore.getState().locale;
        if (locale) params.locale = locale;
      }
    }
  } catch {
    // Best-effort. If the settings store isn't ready yet we simply omit
    // the locale param and the backend falls back to its own default.
  }

  return config;
});

// ─── Refresh-and-retry on 401 ─────────────────────────────────────────────
//
// When the API rejects a request with 401 the user's access_token is either
// expired or revoked. We used to immediately sign the user out, which is
// what produced the field bug where users saw "Could not load your feed"
// after returning to the app: their access_token had expired but their
// refresh_token was still valid, so the right move is to refresh and retry.
//
// Strategy:
//   1. First 401 → flag the request, call supabase.auth.refreshSession().
//      If refresh succeeds, replay the original request with the new token.
//   2. If the refresh fails (refresh_token revoked / network error after
//      token expiry / etc) OR the replay hits another 401 → sign out, route
//      to /auth, and surface the 401 to the caller so React Query renders
//      the "session expired" branch instead of pretending the request
//      succeeded.
//
// The `inFlightRefresh` promise dedupes concurrent refresh attempts when a
// burst of requests all 401 at the same time.

let inFlightRefresh: Promise<boolean> | null = null;
let isHandlingForcedSignOut = false;

async function refreshSessionOnce(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { supabase } = require('@/auth/supabaseClient') as typeof import('@/auth/supabaseClient');
      const { data, error } = await supabase.auth.refreshSession();
      if (__DEV__) {
        console.log('[apiClient] refreshSession', {
          ok: !error && !!data.session,
          err: error?.message,
        });
      }
      return !error && !!data.session;
    } catch (err) {
      if (__DEV__) console.warn('[apiClient] refreshSession threw:', err);
      return false;
    } finally {
      // Allow another refresh on the next 401 burst.
      setTimeout(() => { inFlightRefresh = null; }, 0);
    }
  })();
  return inFlightRefresh;
}

async function forceSignOutAndRoute() {
  if (isHandlingForcedSignOut) return;
  isHandlingForcedSignOut = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('@/store/authStore') as typeof import('@/store/authStore');
    const hasSession = !!useAuthStore.getState().session;
    if (hasSession) {
      try {
        await useAuthStore.getState().signOut();
      } catch {
        // best-effort
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { router } = require('expo-router') as typeof import('expo-router');
        router.replace('/auth' as any);
      } catch {
        // Router may not be ready during early bootstrap; the navigation
        // guard will route correctly via the auth state change.
      }
    }
  } catch (handlerError) {
    if (__DEV__) console.warn('[apiClient] forceSignOut handler failed:', handlerError);
  } finally {
    setTimeout(() => { isHandlingForcedSignOut = false; }, 1000);
  }
}

apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__ && response.config.url) {
      // eslint-disable-next-line no-console
      console.log('[apiClient]', response.status, response.config.url);
    }
    return response;
  },
  async (error: AxiosError) => {
    try {
      const status = error?.response?.status;
      const config = error.config as RetriableConfig | undefined;

      if (__DEV__) {
        const diag = await getSessionDiagnostics();
        // eslint-disable-next-line no-console
        console.warn('[apiClient]', status ?? 'NETWORK', config?.url, {
          retried: !!config?._gbRetried,
          ...diag,
        });
      }

      if ((status === 401 || status === 403) && config && !config._gbRetried) {
        config._gbRetried = true;

        const refreshed = await refreshSessionOnce();
        if (refreshed) {
          // Re-read the (now refreshed) token and retry the original request
          // exactly once. The request interceptor would attach it
          // automatically on the replay, but we set it here too so the new
          // header is unambiguously the post-refresh token.
          const newToken = await getAuthToken();
          if (newToken) {
            config.headers = config.headers ?? {};
            (config.headers as any).Authorization = `Bearer ${newToken}`;
          }
          return apiClient.request(config);
        }

        // Refresh failed → session is genuinely gone. Sign out + route.
        await forceSignOutAndRoute();
      }
    } catch (handlerError) {
      if (__DEV__) console.warn('[apiClient] response handler failed:', handlerError);
    }
    return Promise.reject(error);
  }
);
