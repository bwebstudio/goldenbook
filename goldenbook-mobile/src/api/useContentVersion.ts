// useContentVersion — keeps mobile caches in sync with editorial edits made
// in the dashboard. Polls GET /api/v1/content/version on app foreground and
// on major list-screen mounts (via useInvalidateOnVersionChange). When the
// returned version differs from the last-observed value, React Query caches
// for editorial data are invalidated so the very next render hits the API.
//
// Why polling instead of Realtime for v1:
//   • Zero new infra. No websockets on mobile. Works on cellular.
//   • Deterministic: a single foreground transition guarantees a check.
//   • Realtime is additive (Phase 2) — the same hook will subscribe when
//     Supabase Realtime is enabled on the `content_version` row, and the
//     polling fallback guarantees correctness if the subscription drops.

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { supabase } from '@/auth/supabaseClient';

interface VersionResponse { global: number; updated_at: string }

const VERSION_INVALIDATE_KEYS: readonly string[] = [
  'place',      // place detail
  'places',     // lists
  'discover',   // discover feed
  'routes',     // routes list + detail
  'route',
  'categories', // category listings
  'map',        // map markers
  'search',     // cached search results
  'saved',      // "Saved" tab
];

let lastSeenVersion = 0;

/**
 * Fetch the current global content version. Never throws.
 * Returns `null` if the endpoint is unreachable.
 */
export async function fetchContentVersion(): Promise<number | null> {
  try {
    const { data } = await apiClient.get<VersionResponse>('/content/version');
    return typeof data?.global === 'number' ? data.global : null;
  } catch {
    return null;
  }
}

/**
 * Invalidate every editorial React Query cache. Used when the content
 * version bumps — safe to call even when nothing changed (React Query will
 * simply re-validate queries that are actively mounted).
 */
export function invalidateEditorialCaches(qc: ReturnType<typeof useQueryClient>): void {
  for (const key of VERSION_INVALIDATE_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/**
 * Mount ONCE in app/_layout.tsx. Sync strategy:
 *   1. Polls on app foreground transitions (primary, always-on).
 *   2. Subscribes to Supabase Realtime on `content_version` (additive, Phase 2).
 *      A realtime push triggers cache invalidation without waiting for the
 *      next foreground. Falls back to polling if the channel drops.
 *
 * Screens that render large editorial lists may additionally call
 * `useInvalidateOnVersionChange()` for belt-and-braces freshness.
 */
export function useContentVersionSync(): void {
  const qc       = useQueryClient();
  const inFlight = useRef(false);

  useEffect(() => {
    async function check(source: 'initial' | 'foreground' | 'realtime') {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const v = await fetchContentVersion();
        if (v != null && v !== lastSeenVersion) {
          const prev = lastSeenVersion;
          lastSeenVersion = v;
          if (prev !== 0) {
            if (__DEV__) {
              console.log(`[content-version] bump ${prev} → ${v} (${source}); invalidating caches`);
            }
            invalidateEditorialCaches(qc);
          }
        }
      } finally {
        inFlight.current = false;
      }
    }

    check('initial');

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') check('foreground');
    });

    // ─── Supabase Realtime subscription (additive) ──────────────────────────
    // A single-row subscription. Requires Realtime to be enabled on the
    // `content_version` table in the Supabase dashboard. Degrades gracefully
    // if the channel never connects — the foreground poll still runs.
    const channel = supabase
      .channel('content-version-global')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'content_version',
          filter: 'scope=eq.global',
        },
        () => {
          // The trigger bumps `version`; we don't trust the payload here.
          // A round-trip to /content/version is the canonical path and
          // also serves to confirm the backend agrees.
          check('realtime');
        },
      )
      .subscribe((status) => {
        if (__DEV__) console.log('[content-version] realtime:', status);
      });

    return () => {
      sub.remove();
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

/**
 * Screen-scoped version check. Call in list screens (Discover, Map, Saved,
 * Search results) to guarantee the list reflects editorial state on mount.
 */
export function useInvalidateOnVersionChange(): void {
  const qc = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    fetchContentVersion().then((v) => {
      if (cancelled || v == null) return;
      if (v !== lastSeenVersion) {
        const prev = lastSeenVersion;
        lastSeenVersion = v;
        if (prev !== 0) invalidateEditorialCaches(qc);
      }
    });
    return () => { cancelled = true; };
  }, [qc]);
}
