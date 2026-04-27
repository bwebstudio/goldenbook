import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { useNetworkStore } from '@/store/networkStore';
import { useMutationQueueStore } from '@/store/mutationQueueStore';
import { savedApi } from '../api';
import { useSaved, SAVED_QUERY_KEY } from './useSaved';
import { track } from '@/analytics/track';
import type { SavedResponse, SavedPlaceDTO } from '@/types/api';

interface UseSavePlaceOptions {
  snapshot?: Partial<SavedPlaceDTO> & { id: string };
}

export function useSavePlace(placeId: string, options: UseSavePlaceOptions = {}) {
  const queryClient = useQueryClient();
  const locale = useSettingsStore((s) => s.locale);
  const { data: saved, isLoading: savedLoading } = useSaved();

  const isSaved = !!placeId && (saved?.savedPlaces.some((p) => p.id === placeId) ?? false);

  // Use a ref so mutationFn always reads the CURRENT isSaved, not the
  // stale closure from the render where mutation was created.
  const isSavedRef = useRef(isSaved);
  isSavedRef.current = isSaved;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!placeId) throw new Error('placeId is required');
      // Read from ref, not from the closure — fixes the race condition
      // where isSaved was stale because useSaved() hadn't loaded yet.
      const currentlySaved = isSavedRef.current;
      track(currentlySaved ? 'favorite_remove' : 'favorite_add', { placeId });

      const kind = currentlySaved ? 'unsavePlace' : 'savePlace';
      const isOnline = useNetworkStore.getState().isOnline;

      // The snapshot lets the cold-start replay reconstruct a meaningful
      // saved-screen row (name, image, slug) even if the optimistic write
      // to the persisted RQ cache didn't reach disk before a force-quit.
      // Always passed through to the queue so behaviour is the same on
      // the network-error fall-through path below.
      const snapshot = options.snapshot
        ? {
            slug: options.snapshot.slug,
            name: options.snapshot.name,
            shortDescription: options.snapshot.shortDescription,
            image: options.snapshot.image ?? null,
          }
        : undefined;

      // Offline path: the optimistic update applied in onMutate IS the UX.
      // We persist the intent in the queue so it'll replay against the
      // server the moment we reconnect. From the user's perspective the
      // heart turned red instantly; the network round-trip is invisible.
      if (!isOnline) {
        useMutationQueueStore.getState().enqueueSave(kind, placeId, snapshot);
        return;
      }

      try {
        return currentlySaved
          ? await savedApi.unsavePlace(placeId)
          : await savedApi.savePlace(placeId);
      } catch (err: any) {
        // Network error (no response from server) — keep the optimistic
        // update and enqueue for replay. Distinguishes from a real 4xx
        // rejection by `err.response` being undefined.
        if (!err?.response) {
          useMutationQueueStore.getState().enqueueSave(kind, placeId, snapshot);
          return;
        }
        throw err;
      }
    },

    onMutate: async () => {
      const key = SAVED_QUERY_KEY(locale);
      await queryClient.cancelQueries({ queryKey: ['saved'] });
      const prev = queryClient.getQueryData<SavedResponse>(key);

      // If the saved list hasn't loaded yet, seed the cache with an empty
      // response so the optimistic update still applies. This is the fix
      // for the "nothing happens on slow devices" bug: on iPhone XS the
      // useSaved query often hasn't returned by the time the user taps.
      const base: SavedResponse = prev ?? { savedPlaces: [], savedRoutes: [] };
      const currentlySaved = isSavedRef.current;

      const next: SavedResponse = currentlySaved
        ? {
            ...base,
            savedPlaces: base.savedPlaces.filter((p) => p.id !== placeId),
          }
        : {
            ...base,
            savedPlaces: [
              {
                id: placeId,
                slug: options.snapshot?.slug ?? '',
                name: options.snapshot?.name ?? '',
                shortDescription: options.snapshot?.shortDescription ?? null,
                savedAt: new Date().toISOString(),
                image: options.snapshot?.image ?? null,
              },
              ...base.savedPlaces,
            ],
          };
      queryClient.setQueryData<SavedResponse>(key, next);
      return { prev };
    },

    onError: (err, _vars, ctx) => {
      console.warn('[useSavePlace] mutation failed:', err);
      if (ctx?.prev) {
        queryClient.setQueryData(SAVED_QUERY_KEY(locale), ctx.prev);
      }
    },

    onSettled: () => {
      // Only invalidate if we're online — otherwise the refetch would
      // immediately fail and React Query would retry, which on slow
      // mobile networks delays the next user-initiated render. The
      // queue's flush() invalidates again on reconnect (see _layout).
      if (useNetworkStore.getState().isOnline) {
        queryClient.invalidateQueries({ queryKey: ['saved'] });
      }
    },
  });

  const toggle = useCallback(() => {
    if (!placeId || mutation.isPending) return;
    mutation.mutate();
  }, [placeId, mutation]);

  return {
    isSaved,
    toggle,
    isPending: mutation.isPending,
    isReady: !savedLoading,
  };
}
