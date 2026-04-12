import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { savedApi } from '../api';
import { useSaved, SAVED_QUERY_KEY } from './useSaved';
import type { SavedResponse, SavedRouteDTO } from '@/types/api';

interface UseSaveRouteOptions {
  /** Snapshot used for optimistic save so the saved list updates instantly. */
  snapshot?: Partial<SavedRouteDTO> & { id: string };
}

/**
 * Bidirectional optimistic toggle for saving / unsaving a route.
 * See useSavePlace for rationale.
 */
export function useSaveRoute(routeId: string, options: UseSaveRouteOptions = {}) {
  const queryClient = useQueryClient();
  const locale = useSettingsStore((s) => s.locale);
  const { data: saved } = useSaved();

  const isSaved = !!routeId && (saved?.savedRoutes.some((r) => r.id === routeId) ?? false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!routeId) throw new Error('routeId is required');
      return isSaved ? savedApi.unsaveRoute(routeId) : savedApi.saveRoute(routeId);
    },

    onMutate: async () => {
      const key = SAVED_QUERY_KEY(locale);
      await queryClient.cancelQueries({ queryKey: ['saved'] });
      const prev = queryClient.getQueryData<SavedResponse>(key);

      if (prev) {
        const next: SavedResponse = isSaved
          ? {
              ...prev,
              savedRoutes: prev.savedRoutes.filter((r) => r.id !== routeId),
            }
          : {
              ...prev,
              savedRoutes: [
                {
                  id: routeId,
                  slug: options.snapshot?.slug ?? '',
                  title: options.snapshot?.title ?? '',
                  summary: options.snapshot?.summary ?? null,
                  savedAt: new Date().toISOString(),
                  image: options.snapshot?.image ?? null,
                },
                ...prev.savedRoutes,
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
      queryClient.invalidateQueries({ queryKey: ['saved'] });
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
  };
}
