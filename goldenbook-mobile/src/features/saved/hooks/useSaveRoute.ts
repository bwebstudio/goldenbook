import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { useNetworkStore } from '@/store/networkStore';
import { useMutationQueueStore } from '@/store/mutationQueueStore';
import { savedApi } from '../api';
import { useSaved, SAVED_QUERY_KEY } from './useSaved';
import type { SavedResponse, SavedRouteDTO } from '@/types/api';

interface UseSaveRouteOptions {
  snapshot?: Partial<SavedRouteDTO> & { id: string };
}

export function useSaveRoute(routeId: string, options: UseSaveRouteOptions = {}) {
  const queryClient = useQueryClient();
  const locale = useSettingsStore((s) => s.locale);
  const { data: saved, isLoading: savedLoading } = useSaved();

  const isSaved = !!routeId && (saved?.savedRoutes.some((r) => r.id === routeId) ?? false);

  const isSavedRef = useRef(isSaved);
  isSavedRef.current = isSaved;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!routeId) throw new Error('routeId is required');
      const currentlySaved = isSavedRef.current;
      const kind = currentlySaved ? 'unsaveRoute' : 'saveRoute';
      const isOnline = useNetworkStore.getState().isOnline;

      const snapshot = options.snapshot
        ? {
            slug: options.snapshot.slug,
            title: options.snapshot.title,
            summary: options.snapshot.summary,
            image: options.snapshot.image ?? null,
          }
        : undefined;

      if (!isOnline) {
        useMutationQueueStore.getState().enqueueSave(kind, routeId, snapshot);
        return;
      }

      try {
        return currentlySaved
          ? await savedApi.unsaveRoute(routeId)
          : await savedApi.saveRoute(routeId);
      } catch (err: any) {
        if (!err?.response) {
          useMutationQueueStore.getState().enqueueSave(kind, routeId, snapshot);
          return;
        }
        throw err;
      }
    },

    onMutate: async () => {
      const key = SAVED_QUERY_KEY(locale);
      await queryClient.cancelQueries({ queryKey: ['saved'] });
      const prev = queryClient.getQueryData<SavedResponse>(key);

      const base: SavedResponse = prev ?? { savedPlaces: [], savedRoutes: [] };
      const currentlySaved = isSavedRef.current;

      const next: SavedResponse = currentlySaved
        ? {
            ...base,
            savedRoutes: base.savedRoutes.filter((r) => r.id !== routeId),
          }
        : {
            ...base,
            savedRoutes: [
              {
                id: routeId,
                slug: options.snapshot?.slug ?? '',
                title: options.snapshot?.title ?? '',
                summary: options.snapshot?.summary ?? null,
                savedAt: new Date().toISOString(),
                image: options.snapshot?.image ?? null,
              },
              ...base.savedRoutes,
            ],
          };
      queryClient.setQueryData<SavedResponse>(key, next);
      return { prev };
    },

    onError: (err, _vars, ctx) => {
      console.warn('[useSaveRoute] mutation failed:', err);
      if (ctx?.prev) {
        queryClient.setQueryData(SAVED_QUERY_KEY(locale), ctx.prev);
      }
    },

    onSettled: () => {
      if (useNetworkStore.getState().isOnline) {
        queryClient.invalidateQueries({ queryKey: ['saved'] });
      }
    },
  });

  const toggle = useCallback(() => {
    if (!routeId || mutation.isPending) return;
    mutation.mutate();
  }, [routeId, mutation]);

  return {
    isSaved,
    toggle,
    isPending: mutation.isPending,
    isReady: !savedLoading,
  };
}
