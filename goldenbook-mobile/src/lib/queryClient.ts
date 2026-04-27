import { QueryClient } from '@tanstack/react-query';

// gcTime governs how long an inactive query stays in the in-memory + on-disk
// cache. Has to be at least as long as the persister's `maxAge` for the
// persisted entry to be re-mounted on next launch — otherwise React Query
// will drop the rehydrated entry as expired before any consumer subscribes.
const GC_TIME_OFFLINE = 1000 * 60 * 60 * 24 * 30; // 30 days

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: GC_TIME_OFFLINE,
      // Don't burn battery / data retrying on every flaky request. The
      // OfflineBanner + cache fall-through cover the offline UX; a single
      // retry handles transient hiccups without doubling the wait time
      // before the user sees cached data.
      retry: 1,
      // The default `online` setting pauses queries when NetInfo reports
      // offline. We want them to ATTEMPT the request anyway so we get a
      // proper error → cache-fall-through → "offline mode" banner cycle
      // even if NetInfo's signal lags reality (it sometimes does for the
      // first second after airplane mode is toggled). Cached data is what
      // the user sees in the meantime.
      networkMode: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
      networkMode: 'always',
    },
  },
});
