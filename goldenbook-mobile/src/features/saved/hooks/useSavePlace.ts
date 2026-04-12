import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { savedApi } from '../api';
import { useSaved, SAVED_QUERY_KEY } from './useSaved';
import type { SavedResponse, SavedPlaceDTO } from '@/types/api';

interface UseSavePlaceOptions {
  /**
   * Optional snapshot of the place data so optimistic SAVES can also
   * appear immediately in the saved list. Fed by detail screens and
   * cards that already have the data on hand.
   */
  snapshot?: Partial<SavedPlaceDTO> & { id: string };
}

/**
 * Bidirectional optimistic toggle for saving / unsaving a place.
 *
 * Why this exists in this shape:
 * - The previous version only optimistically updated on UNSAVE, which made
 *   SAVE feel completely broken: tapping the heart did nothing visible until
 *   the request round-tripped, and most users assumed the button was dead.
 * - We now patch the cache in BOTH directions and roll back on error.
 */
export function useSavePlace(placeId: string, options: UseSavePlaceOptions = {}) {
  const queryClient = useQueryClient();
  const locale = useSettingsStore((s) => s.locale);
  const { data: saved } = useSaved();

  const isSaved = !!placeId && (saved?.savedPlaces.some((p) => p.id === placeId) ?? false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!placeId) throw new Error('placeId is required');
      return isSaved ? savedApi.unsavePlace(placeId) : savedApi.savePlace(placeId);
    },

    onMutate: async () => {
      const key = SAVED_QUERY_KEY(locale);
      await queryClient.cancelQueries({ queryKey: ['saved'] });
      const prev = queryClient.getQueryData<SavedResponse>(key);

      if (prev) {
        const next: SavedResponse = isSaved
          ? {
              ...prev,
              savedPlaces: prev.savedPlaces.filter((p) => p.id !== placeId),
            }
          : {
              ...prev,
              savedPlaces: [
                {
                  id: placeId,
                  slug: options.snapshot?.slug ?? '',
                  name: options.snapshot?.name ?? '',
                  shortDescription: options.snapshot?.shortDescription ?? null,
                  savedAt: new Date().toISOString(),
                  image: options.snapshot?.image ?? null,
                },
                ...prev.savedPlaces,
              ],
            };
        queryClient.setQueryData<SavedResponse>(key, next);
      }
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(SAVED_QUERY_KEY(locale), ctx.prev);
      }
    },

    onSettled: () => {
      // Refresh every cached locale variant.
      queryClient.invalidateQueries({ queryKey: ['saved'] });
    },
  });

  // Stable callback so consumers can pass it straight to onPress.
  const toggle = useCallback(() => {
    if (!placeId || mutation.isPending) return;
    mutation.mutate();
  }, [placeId, mutation]);

  return {
    isSaved,
    toggle,
    isPending: mutation.isPending,
  };
}
