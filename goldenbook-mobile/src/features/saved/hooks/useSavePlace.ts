import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { savedApi } from '../api';
import { useSaved, SAVED_QUERY_KEY } from './useSaved';
import type { SavedResponse } from '@/types/api';

export function useSavePlace(placeId: string) {
  const queryClient = useQueryClient();
  const locale = useSettingsStore((s) => s.locale);
  const { data: saved } = useSaved();

  const isSaved = saved?.savedPlaces.some((p) => p.id === placeId) ?? false;

  const mutation = useMutation({
    mutationFn: () =>
      isSaved ? savedApi.unsavePlace(placeId) : savedApi.savePlace(placeId),

    onMutate: async () => {
      // Optimistic remove — for unsave we can remove locally immediately.
      // For save we just wait for the server since we don't have full data to add.
      if (isSaved) {
        const key = SAVED_QUERY_KEY(locale);
        await queryClient.cancelQueries({ queryKey: key });
        const prev = queryClient.getQueryData<SavedResponse>(key);
        if (prev) {
          queryClient.setQueryData<SavedResponse>(key, {
            ...prev,
            savedPlaces: prev.savedPlaces.filter((p) => p.id !== placeId),
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
