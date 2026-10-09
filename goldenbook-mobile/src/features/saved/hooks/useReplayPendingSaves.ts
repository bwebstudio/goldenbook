import { useEffect, useRef } from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useMutationQueueStore, applyQueueToSaved, queueForUser } from '@/store/mutationQueueStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import type { SavedResponse } from '@/types/api';
import { SAVED_QUERY_KEY } from './useSaved';

// ─── Cold-start saved-cache replay ─────────────────────────────────────────
//
// Closes the force-quit-within-200ms gap (see persister.ts comment): if the
// user toggled save / unsave while offline and force-quit before the React
// Query persister flushed, the on-disk RQ cache will be missing the
// optimistic update on next launch — but the mutation queue (persisted
// synchronously) still has the intent. This hook walks the queue at startup
// and applies each pending op to whatever the persister did rehydrate, so
// the saved screen renders the user's true intent even before reconnect.
//
// Guarantees:
//   • No network requests. We only read from / write to the React Query
//     in-memory cache via setQueryData. The disabled flag and queryFn are
//     untouched; the next online refetch is what reconciles with the
//     server.
//   • Idempotent. applyQueueToSaved is a pure projection that no-ops on
//     already-applied changes. Re-runs (e.g. on locale change) won't
//     duplicate or invert state.
//   • Only mutates the ['saved', userId, locale] cache for the CURRENT user
//     and locale, using only that user's queued ops.
//     Other locales' caches are left alone — they'll be re-applied if/when
//     the user switches locales (the effect re-fires on locale change).
//
// Mounted exactly once in app/_layout.tsx → AppShell.

export function useReplayPendingSaves(): void {
  const queryClient = useQueryClient();
  // Writing before the persisted cache is restored would make the restore
  // discard the (older) saved list from disk.
  const isRestoring = useIsRestoring();
  const isHydrated  = useMutationQueueStore((s) => s.isHydrated);
  const fullQueue   = useMutationQueueStore((s) => s.queue);
  const locale      = useSettingsStore((s) => s.locale);
  const userId      = useAuthStore((s) => s.user?.id ?? null);

  // Last queue length we replayed against. Used so we don't redundantly
  // setQueryData on every render (queue is referentially stable from
  // zustand, but selectors that take a function close over fresh refs).
  const lastSignature = useRef<string>('');

  useEffect(() => {
    if (!isHydrated || isRestoring) return;
    // Only the signed-in user's own ops are projected onto their own cache.
    const queue = queueForUser(fullQueue, userId);
    if (!userId || queue.length === 0) {
      // Nothing to replay — but we still need to bump the signature so a
      // post-flush state with an empty queue doesn't keep re-running the
      // earlier signature (cosmetic; setQueryData with same data is safe).
      lastSignature.current = '';
      return;
    }

    // Cheap, order-sensitive signature so we only call setQueryData when
    // the queue actually changes (length + last id is enough — the queue
    // only mutates by enqueue / drain).
    const signature = `${userId}:${queue.length}:${queue[queue.length - 1].id}:${locale}`;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;

    const key      = SAVED_QUERY_KEY(userId, locale);
    const existing = queryClient.getQueryData<SavedResponse>(key);
    const next     = applyQueueToSaved(existing, queue);

    // Reference equality short-circuit: if the projection is the same
    // object (no ops applied), don't notify subscribers.
    if (next === existing) return;
    queryClient.setQueryData<SavedResponse>(key, next);
  }, [isHydrated, isRestoring, fullQueue, userId, locale, queryClient]);
}
