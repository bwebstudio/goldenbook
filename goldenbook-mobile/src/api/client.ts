import axios from 'axios';
import { getAuthToken } from '@/auth/tokenStorage';

// NOTE: Do NOT statically import `@/store/authStore` or `expo-router` here.
// `authStore` imports `@/api/endpoints` which imports this file, which would
// create a load-order cycle (client → authStore → endpoints → client). In
// Metro's production bundle that cycle has been observed to leave the
// `useAuthStore` binding undefined at the time the 401 interceptor first
// fires, throwing inside an async response handler and crashing the app
// immediately after the splash. Both modules are now resolved lazily inside
// the 401 callback below, which runs long after every module has finished
// evaluating.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__
  ? 'http://localhost:3001/api/v1'
  : 'https://goldenbook-production.up.railway.app/api/v1'
);

// Stable session ID for NOW anti-repetition tracking (persists until app restart)
const SESSION_ID = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['x-session-id'] = SESSION_ID;
  return config;
});

// ─── Global 401 handler ───────────────────────────────────────────────────
// When the API rejects a request with 401, the user's session has expired
// or been revoked. We sign out locally (clears the persisted token + auth
// store) and redirect them to /auth so they can sign back in. The flag
// prevents a burst of in-flight 401s from triggering multiple redirects.

let isHandling401 = false;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // The entire handler is wrapped in a try/catch so a thrown error inside
    // the interceptor itself can never escape as an unhandled async rejection
    // and crash the app at startup.
    try {
      if (error?.response?.status === 401 && !isHandling401) {
        // Lazy require — see the file-top NOTE about the circular dep.
        // By the time any HTTP request returns, both modules are fully
        // initialised, so this is always safe.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useAuthStore } = require('@/store/authStore') as typeof import('@/store/authStore');

        // Only act if there is actually a session to clear — avoids
        // bouncing the user away from a public screen on a stray 401.
        const hasSession = !!useAuthStore.getState().session;
        if (hasSession) {
          isHandling401 = true;
          try {
            await useAuthStore.getState().signOut();
          } catch {
            // signOut is best-effort — local cleanup runs even if Supabase fails
          }
          try {
            // Lazy require so we don't pull expo-router into the module
            // graph at load time. Router may also not be ready during early
            // bootstrap — the navigation guard in _layout.tsx will recover
            // via the auth state change.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { router } = require('expo-router') as typeof import('expo-router');
            router.replace('/auth' as any);
          } catch {
            // Router may not be ready during early bootstrap; the auth state
            // change will route us correctly via the navigation guard.
          }
          // Reset the flag on the next tick so subsequent sessions can also
          // be handled if the user signs in again later in the same app run.
          setTimeout(() => { isHandling401 = false; }, 1000);
        }
      }
    } catch (handlerError) {
      // Defensive — never let the 401 handler itself throw.
      if (__DEV__) console.warn('[apiClient] 401 handler failed:', handlerError);
    }
    return Promise.reject(error);
  }
);
