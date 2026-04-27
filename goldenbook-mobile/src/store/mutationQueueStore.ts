import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage, StorageKeys } from '@/lib/storage';
import { useNetworkStore } from '@/store/networkStore';
import { api } from '@/api/endpoints';
import type { SavedResponse } from '@/types/api';

// ─── Offline mutation queue ───────────────────────────────────────────────
//
// Persists "the user tapped save / unsave while offline" so we can replay
// the call against the backend the moment connectivity returns. This is
// fire-and-forget from the user's point of view — the optimistic update on
// the saved-list cache (handled by useSavePlace / useSaveRoute) is what
// makes the heart turn red immediately; this queue just guarantees
// eventual consistency with the server.
//
// Dedup rules:
//   • Only one pending op per (kind, resourceId). A second tap on the same
//     place collapses with the existing op:
//       save then save  → idempotent, keep one
//       save then unsave → cancels (drop both)
//       unsave then save → cancels (drop both)
//       unsave then unsave → idempotent, keep one
//   • This matches the optimistic UX: the user can toggle freely while
//     offline and the queue resolves to the *net* desired state.
//
// Failure handling:
//   • Network error during flush → leave op in queue, try again on next
//     online transition.
//   • 4xx response → drop the op. The server has rejected; retrying will
//     not help, and surfacing the error from a background sync is more
//     surprising than letting the saved list resync on next /me/saved
//     fetch (which the queryClient invalidates after flush completes).
//   • 5xx response → leave in queue, try again. Treat the same as network.

export type SaveKind =
  | 'savePlace'
  | 'unsavePlace'
  | 'saveRoute'
  | 'unsaveRoute';

/**
 * Optional minimal projection of the resource the user toggled, captured
 * at enqueue time so the saved-screen list can render meaningful content
 * (name + image + slug) on cold-start replay before the server confirms.
 *
 * Place ops use {name, shortDescription}; route ops use {title, summary}.
 * Anything missing falls back to '' / null in the optimistic SavedResponse
 * row, mirroring how `useSavePlace` already degrades when no snapshot is
 * supplied.
 */
export interface QueuedSavedSnapshot {
  slug?: string;
  name?: string;
  shortDescription?: string | null;
  title?: string;
  summary?: string | null;
  image?: { bucket: string; path: string } | null;
}

export interface QueuedMutation {
  /** Stable id so we can find this op in the queue without indexing tricks. */
  id: string;
  kind: SaveKind;
  resourceId: string;
  /** ms since epoch — used for ordering on flush. */
  createdAt: number;
  /** Snapshot of the saved resource as it appeared when the user tapped.
   *  Used by `applyQueueToSaved` for cold-start replay; never sent to the
   *  server. */
  snapshot?: QueuedSavedSnapshot;
}

interface MutationQueueState {
  queue: QueuedMutation[];
  isFlushing: boolean;
  /** True once persist() has rehydrated from disk. Components shouldn't
   *  inspect `queue` for "do I have a pending op?" until this is true. */
  isHydrated: boolean;
  enqueueSave: (
    kind: SaveKind,
    resourceId: string,
    snapshot?: QueuedSavedSnapshot,
  ) => void;
  flush: () => Promise<void>;
  _setHydrated: () => void;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isOpposite(a: SaveKind, b: SaveKind): boolean {
  return (
    (a === 'savePlace' && b === 'unsavePlace') ||
    (a === 'unsavePlace' && b === 'savePlace') ||
    (a === 'saveRoute' && b === 'unsaveRoute') ||
    (a === 'unsaveRoute' && b === 'saveRoute')
  );
}

function sameKindFamily(a: SaveKind, b: SaveKind): boolean {
  const placeOps = a.endsWith('Place') && b.endsWith('Place');
  const routeOps = a.endsWith('Route') && b.endsWith('Route');
  return placeOps || routeOps;
}

async function executeOp(op: QueuedMutation): Promise<'ok' | 'retry' | 'drop'> {
  try {
    switch (op.kind) {
      case 'savePlace':   await api.savePlace(op.resourceId);   break;
      case 'unsavePlace': await api.unsavePlace(op.resourceId); break;
      case 'saveRoute':   await api.saveRoute(op.resourceId);   break;
      case 'unsaveRoute': await api.unsaveRoute(op.resourceId); break;
    }
    return 'ok';
  } catch (err: any) {
    const status: number | undefined = err?.response?.status;
    // Network failure / no response → keep and retry later.
    if (status === undefined) return 'retry';
    // Auth / not-found / conflict → drop. The next /me/saved fetch will
    // reconcile whatever the server thinks is true.
    if (status === 401 || status === 403 || status === 404 || status === 409) {
      return 'drop';
    }
    // Other 4xx → drop (server rejected; no point retrying).
    if (status >= 400 && status < 500) return 'drop';
    // 5xx → retry.
    return 'retry';
  }
}

export const useMutationQueueStore = create<MutationQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isFlushing: false,
      isHydrated: false,

      enqueueSave: (kind, resourceId, snapshot) => {
        const existing = get().queue;
        // Look for an op on the same resource that we should collapse with.
        const idx = existing.findIndex(
          (q) => q.resourceId === resourceId && sameKindFamily(q.kind, kind),
        );
        if (idx === -1) {
          set({
            queue: [
              ...existing,
              { id: newId(), kind, resourceId, createdAt: Date.now(), snapshot },
            ],
          });
          return;
        }
        const prev = existing[idx];
        if (prev.kind === kind) {
          // Same op already queued — idempotent, do nothing.
          return;
        }
        if (isOpposite(prev.kind, kind)) {
          // save then unsave (or vice versa) — drop both, the user is back
          // to the original state.
          set({ queue: existing.filter((_, i) => i !== idx) });
          return;
        }
        // Different op on same resource (shouldn't happen given families)
        // — replace.
        set({
          queue: existing.map((q, i) =>
            i === idx
              ? { id: newId(), kind, resourceId, createdAt: Date.now(), snapshot }
              : q,
          ),
        });
      },

      flush: async () => {
        if (get().isFlushing) return;
        if (get().queue.length === 0) return;
        if (!useNetworkStore.getState().isOnline) return;
        // Pull ops OUT of the queue before awaiting the network. Two
        // reasons:
        //   1. If the user taps the opposite action mid-flush (offline
        //      enqueue while the request is in flight), enqueueSave's
        //      "opposite cancels" logic must NOT reach back and cancel
        //      the in-flight op — otherwise the user's last tap is lost
        //      because we already sent the original to the server.
        //   2. Re-entering flush() while one is in progress is guarded
        //      by `isFlushing`, but a fresh enqueue while we're awaiting
        //      can still race with the queue.filter() at the end.
        // By detaching the snapshot from the queue, in-flight ops become
        // private to this flush call; new ops land on the (empty-ish)
        // queue and are picked up next round.
        set({ isFlushing: true });
        const snapshot = [...get().queue].sort((a, b) => a.createdAt - b.createdAt);
        const snapshotIds = new Set(snapshot.map((o) => o.id));
        set({ queue: get().queue.filter((q) => !snapshotIds.has(q.id)) });
        const requeue: QueuedMutation[] = [];
        try {
          for (const op of snapshot) {
            // Bail if we go offline mid-flush so we don't burn through
            // every op only for them all to fail.
            if (!useNetworkStore.getState().isOnline) {
              requeue.push(op);
              continue;
            }
            const result = await executeOp(op);
            if (result === 'retry') requeue.push(op);
            // 'ok' / 'drop' → forget this op.
          }
        } finally {
          if (requeue.length > 0) {
            // Put retry-eligible ops back at the front (preserves causal
            // order against any new ops appended during flush).
            set({ queue: [...requeue, ...get().queue] });
          }
          set({ isFlushing: false });
        }
      },

      _setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: StorageKeys.mutationQueue,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ queue: state.queue }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);

// ─── Replay helper ─────────────────────────────────────────────────────────
//
// Pure, idempotent projection of the persisted queue onto a SavedResponse.
// Used at cold start to close the gap between (a) the user toggling save
// while offline and (b) the React Query persister flushing the optimistic
// `['saved', locale]` cache to disk before they force-quit. The mutation
// queue is persisted within ~10ms of the tap; the RQ cache is persisted
// within ~200ms (see `throttleTime` in lib/persister.ts). On the unlucky
// force-quit between those two windows the queue still has the op but the
// on-disk RQ cache is stale — replaying the queue here reconciles them
// without firing any network requests.
//
// Idempotency contract:
//   • savePlace / saveRoute → no-op if the resource is already in the list.
//   • unsavePlace / unsaveRoute → no-op if the resource is already absent.
//   • Calling applyQueueToSaved twice with the same queue + base produces
//     the same SavedResponse (ref-equal-ish: array order is stable, no
//     duplicates).
//
// The function is pure — it does not call setQueryData / dispatch / fetch.
// The caller (useReplayPendingSaves) decides where to write the result.

export function applyQueueToSaved(
  base: SavedResponse | undefined,
  queue: QueuedMutation[],
): SavedResponse {
  let next: SavedResponse = base ?? { savedPlaces: [], savedRoutes: [] };

  for (const op of queue) {
    switch (op.kind) {
      case 'savePlace': {
        if (next.savedPlaces.some((p) => p.id === op.resourceId)) break;
        const snap = op.snapshot;
        next = {
          ...next,
          savedPlaces: [
            {
              id: op.resourceId,
              slug: snap?.slug ?? '',
              name: snap?.name ?? '',
              shortDescription: snap?.shortDescription ?? null,
              savedAt: new Date(op.createdAt).toISOString(),
              image: snap?.image ?? null,
            },
            ...next.savedPlaces,
          ],
        };
        break;
      }
      case 'unsavePlace': {
        if (!next.savedPlaces.some((p) => p.id === op.resourceId)) break;
        next = {
          ...next,
          savedPlaces: next.savedPlaces.filter((p) => p.id !== op.resourceId),
        };
        break;
      }
      case 'saveRoute': {
        if (next.savedRoutes.some((r) => r.id === op.resourceId)) break;
        const snap = op.snapshot;
        next = {
          ...next,
          savedRoutes: [
            {
              id: op.resourceId,
              slug: snap?.slug ?? '',
              title: snap?.title ?? '',
              summary: snap?.summary ?? null,
              savedAt: new Date(op.createdAt).toISOString(),
              image: snap?.image ?? null,
            },
            ...next.savedRoutes,
          ],
        };
        break;
      }
      case 'unsaveRoute': {
        if (!next.savedRoutes.some((r) => r.id === op.resourceId)) break;
        next = {
          ...next,
          savedRoutes: next.savedRoutes.filter((r) => r.id !== op.resourceId),
        };
        break;
      }
    }
  }

  return next;
}
