import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMutationQueueStore, applyQueueToSaved } from '@/store/mutationQueueStore';
import { useSettingsStore } from '@/store/settingsStore';
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
//   • Only mutates the ['saved', locale] cache for the CURRENT locale.
//     Other locales' caches are left alone — they'll be re-applied if/when
//     the user switches locales (the effect re-fires on locale change).
//
// Mounted exactly once in app/_layout.tsx → AppShell.

export function useReplayPendingSaves(): void {
  const queryClient = useQueryClient();
  const isHydrated  = useMutationQueueStore((s) => s.isHydrated);
  const queue       = useMutationQueueStore((s) => s.queue);
  const locale      = useSettingsStore((s) => s.locale);

  // Last queue length we replayed against. Used so we don't redundantly
  // setQueryData on every render (queue is referentially stable from
  // zustand, but selectors that take a function close over fresh refs).
  const lastSignature = useRef<string>('');

  useEffect(() => {
    if (!isHydrated) return;
    if (queue.length === 0) {
      // Nothing to replay — but we still need to bump the signature so a
      // post-flush state with an empty queue doesn't keep re-running the
      // earlier signature (cosmetic; setQueryData with same data is safe).
      lastSignature.current = '';
      return;
    }

    // Cheap, order-sensitive signature so we only call setQueryData when
    // the queue actually changes (length + last id is enough — the queue
    // only mutates by enqueue / drain).
    const signature = `${queue.length}:${queue[queue.length - 1].id}:${locale}`;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;

    const key      = SAVED_QUERY_KEY(locale);
    const existing = queryClient.getQueryData<SavedResponse>(key);
    const next     = applyQueueToSaved(existing, queue);

    // Reference equality short-circuit: if the projection is the same
    // object (no ops applied), don't notify subscribers.
    if (next === existing) return;
    queryClient.setQueryData<SavedResponse>(key, next);
  }, [isHydrated, queue, locale, queryClient]);
}
