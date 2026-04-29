import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_NAMESPACE } from './storage';

// Generic versioned cache layer on top of AsyncStorage.
//
// Use this for data flows that are NOT backed by React Query (e.g. NOW
// recommendation, Concierge bootstrap). React Query hooks should keep using
// `meta: { cacheable: true }` — the React Query persister already gives them
// stale-while-revalidate semantics out of the box.
//
// Each entry is wrapped in an envelope so we can:
//   • bump CACHE_VERSION to invalidate every entry on schema change without
//     touching individual keys.
//   • tell apart "no cache" from "expired cache" from "stale but usable".
//
// All keys live under `${STORAGE_NAMESPACE}cache:` so a future bulk wipe can
// scope itself to caches without touching the React Query persisted blob or
// the mutation queue.

export const CACHE_VERSION = 1;
export const CACHE_PREFIX = `${STORAGE_NAMESPACE}cache:`;

interface CacheEnvelope<T> {
  v: number;        // CACHE_VERSION at write time
  ts: number;       // ms epoch of write
  ttl?: number;     // optional ms — if omitted, entry never auto-expires
  data: T;
}

export interface CachedResult<T> {
  data: T;
  /** ms epoch when the entry was written. */
  cachedAt: number;
  /** True if the entry is past its TTL but still returned (for SWR). */
  isStale: boolean;
}

function fullKey(key: string): string {
  return key.startsWith(CACHE_PREFIX) ? key : `${CACHE_PREFIX}${key}`;
}

/** Stable string key from heterogeneous parts. Skips null / undefined parts
 *  so callers don't have to. */
export function cacheKey(...parts: Array<string | number | null | undefined>): string {
  return parts.filter((p) => p != null && p !== '').join(':');
}

/**
 * Read a cached value. Returns `null` if missing, version-mismatched, or
 * malformed. By default returns the entry even when stale — the caller
 * decides whether stale is OK (it usually is for offline UX).
 */
export async function getCached<T>(
  key: string,
  options: { allowStale?: boolean } = {},
): Promise<CachedResult<T> | null> {
  const { allowStale = true } = options;
  try {
    const raw = await AsyncStorage.getItem(fullKey(key));
    if (!raw) return null;

    const env = JSON.parse(raw) as CacheEnvelope<T>;
    if (env?.v !== CACHE_VERSION) return null;
    if (env.data === undefined) return null;

    const isStale = env.ttl != null ? Date.now() - env.ts > env.ttl : false;
    if (isStale && !allowStale) return null;

    return { data: env.data, cachedAt: env.ts, isStale };
  } catch {
    // Corrupt entry. Best effort: blow it away so we don't keep tripping.
    try { await AsyncStorage.removeItem(fullKey(key)); } catch { /* noop */ }
    return null;
  }
}

/**
 * Write a cached value. Pass `ttl` (ms) to enable staleness checks on read.
 * Omit `ttl` for "cache until manually replaced or version-busted" semantics.
 */
export async function setCached<T>(
  key: string,
  data: T,
  ttl?: number,
): Promise<void> {
  if (data == null) return;
  const env: CacheEnvelope<T> = {
    v: CACHE_VERSION,
    ts: Date.now(),
    ...(ttl != null ? { ttl } : {}),
    data,
  };
  try {
    await AsyncStorage.setItem(fullKey(key), JSON.stringify(env));
  } catch {
    // Storage full / quota error — non-fatal. The next successful fetch will
    // either succeed in writing or the user will fall through to live data.
  }
}

export async function removeCached(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(fullKey(key));
  } catch {
    /* noop */
  }
}

/** Wipe every key under our cache prefix. Leaves the React Query persisted
 *  blob and mutation queue alone. */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    /* noop */
  }
}

interface GetOrFetchOptions {
  /** Time-to-live for freshness checks. Omit to never auto-expire. */
  ttl?: number;
  /**
   * Stale-while-revalidate. When true (default) and a cached entry exists:
   *   • return the cache immediately,
   *   • fire the fetcher in the background to refresh disk,
   *   • the caller is expected to re-read on next mount / pull-to-refresh.
   *
   * When false: cache is only used as a fallback if the fetcher throws.
   */
  staleWhileRevalidate?: boolean;
  /**
   * Skip the network call entirely. Use when NetInfo says offline so we
   * don't waste a 10s timeout on every screen mount.
   */
  offline?: boolean;
}

export interface FetchResult<T> {
  data: T | null;
  /** True if `data` came from disk (vs a fresh network response). */
  fromCache: boolean;
  /** Present when offline AND no cache. The caller decides how to render. */
  error: unknown;
  cachedAt: number | null;
}

/**
 * Read-through cache. The shape matches what most screens want:
 *
 *   1. If a cache entry exists and SWR is on → return it immediately,
 *      kick off a background refetch.
 *   2. If we're offline → return whatever cache we have; surface `error`
 *      only if even the cache is missing.
 *   3. If we're online and there's no cache → await the fetcher; on success
 *      write to disk and return; on failure return `{ data: null, error }`.
 *
 * Returning early from cache means the caller MUST be tolerant of late
 * background updates. For React-state flows, prefer the `useCachedAsync`
 * hook which schedules the re-render for you.
 */
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: GetOrFetchOptions = {},
): Promise<FetchResult<T>> {
  const { ttl, staleWhileRevalidate = true, offline = false } = options;

  const cached = await getCached<T>(key, { allowStale: true });

  if (offline) {
    if (cached) {
      return { data: cached.data, fromCache: true, error: null, cachedAt: cached.cachedAt };
    }
    return { data: null, fromCache: false, error: new Error('offline'), cachedAt: null };
  }

  // Stale-while-revalidate: fire and forget. We don't await — the in-memory
  // hook can call us again next mount and pick up the freshly written entry.
  if (cached && staleWhileRevalidate) {
    void (async () => {
      try {
        const fresh = await fetcher();
        await setCached(key, fresh, ttl);
      } catch {
        /* keep the previous cache */
      }
    })();
    return { data: cached.data, fromCache: true, error: null, cachedAt: cached.cachedAt };
  }

  try {
    const fresh = await fetcher();
    await setCached(key, fresh, ttl);
    return { data: fresh, fromCache: false, error: null, cachedAt: Date.now() };
  } catch (err) {
    if (cached) {
      return { data: cached.data, fromCache: true, error: err, cachedAt: cached.cachedAt };
    }
    return { data: null, fromCache: false, error: err, cachedAt: null };
  }
}
