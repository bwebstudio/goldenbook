import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';
import { StorageKeys } from './storage';

// ─── Persister for React Query ────────────────────────────────────────────
// Backs the React Query cache with AsyncStorage so previously fetched data
// survives cold start. The `cacheable: true` query meta flag is the opt-in
// used by `dehydrateOptions.shouldDehydrateQuery` below — anything not
// explicitly marked cacheable (e.g. search, NOW recommendations, content
// version polling) is excluded so the persisted blob stays small.
//
// `maxAge` here bounds the WHOLE persisted blob — if it sat untouched for
// longer than `MAX_AGE_MS` the persister discards it on hydrate. Per-entry
// freshness is decided separately by `staleTime` on each query and by the
// "stale data" UX surfaced via `dataUpdatedAt`.

export const PERSISTER_VERSION = 'v1';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: StorageKeys.reactQueryCache,
  // 200ms is a deliberate compromise: long enough to coalesce a burst of
  // cache writes (e.g. discover + saved + place-detail all populating on
  // resume), short enough that the on-disk copy of an optimistic save /
  // unsave is durable before a typical user can tap-and-force-quit. The
  // mutation queue is the eventual-consistency safety net even if this
  // window is missed.
  throttleTime: 200,
});

/**
 * Whether a query should be written to AsyncStorage. Opt-in via
 * `meta: { cacheable: true }` on the `useQuery` config.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  if (query.meta?.cacheable !== true) return false;
  // Don't persist queries that errored on their last attempt — the data is
  // either undefined or a stale fragment from `placeholderData`. We only
  // want successfully fetched payloads on disk.
  if (query.state.status === 'error') return false;
  // Skip queries that have no data yet (pending on first run).
  if (query.state.data === undefined) return false;
  return true;
}

export const persistOptions = {
  persister: queryPersister,
  maxAge: MAX_AGE_MS,
  // Bumping `buster` invalidates every persisted client — use it when the
  // shape of cached payloads changes incompatibly (e.g. a queryKey rename).
  buster: PERSISTER_VERSION,
  dehydrateOptions: {
    shouldDehydrateQuery,
  },
};

export type PersistedRQClient = PersistedClient;
