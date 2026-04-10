import axios from 'axios';
import { router } from 'expo-router';
import { getAuthToken } from '@/auth/tokenStorage';
import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__
  ? 'http://localhost:3001/api/v1'
  : 'https://api.goldenbook.app/api/v1'
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
    if (error?.response?.status === 401 && !isHandling401) {
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
    return Promise.reject(error);
  }
);
