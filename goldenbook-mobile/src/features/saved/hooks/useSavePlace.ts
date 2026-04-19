import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
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
    mutationFn: () => {
      if (!placeId) throw new Error('placeId is required');
      // Read from ref, not from the closure — fixes the race condition
      // where isSaved was stale because useSaved() hadn't loaded yet.
      const currentlySaved = isSavedRef.current;
      track(currentlySaved ? 'favorite_remove' : 'favorite_add', { placeId });
      return currentlySaved
        ? savedApi.unsavePlace(placeId)
        : savedApi.savePlace(placeId);
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
      queryClient.invalidateQueries({ queryKey: ['saved'] });
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
