import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { savedApi } from '../api';
import { useSaved, SAVED_QUERY_KEY } from './useSaved';
import type { SavedResponse } from '@/types/api';

export function useSaveRoute(routeId: string) {
  const queryClient = useQueryClient();
  const locale = useSettingsStore((s) => s.locale);
  const { data: saved } = useSaved();

  const isSaved = saved?.savedRoutes.some((r) => r.id === routeId) ?? false;

  const mutation = useMutation({
    mutationFn: () =>
      isSaved ? savedApi.unsaveRoute(routeId) : savedApi.saveRoute(routeId),

    onMutate: async () => {
      if (isSaved) {
        const key = SAVED_QUERY_KEY(locale);
        await queryClient.cancelQueries({ queryKey: key });
        const prev = queryClient.getQueryData<SavedResponse>(key);
        if (prev) {
          queryClient.setQueryData<SavedResponse>(key, {
            ...prev,
            savedRoutes: prev.savedRoutes.filter((r) => r.id !== routeId),
          });
        }
        return { prev };
      }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(SAVED_QUERY_KEY(locale), ctx.prev);
      }
    },

    onSettled: () => {
      // Invalidate all locale variants so any cached locale refreshes after mutation
      queryClient.invalidateQueries({ queryKey: ['saved'] });
    },
  });

  return {
    isSaved,
    toggle: mutation.mutate,
    isPending: mutation.isPending,
  };
}
