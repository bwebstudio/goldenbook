import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { savedApi } from '../api';

export const SAVED_QUERY_KEY = (locale: string) => ['saved', locale] as const;

export function useSaved() {
  const session = useAuthStore((s) => s.session);
  const locale  = useSettingsStore((s) => s.locale);

  return useQuery({
    queryKey: SAVED_QUERY_KEY(locale),
    queryFn: () => savedApi.getSaved(locale),
    enabled: !!session,
    staleTime: 1000 * 60 * 5,
    // Saved list MUST be cacheable so the user can browse their favorites
    // offline. Optimistic updates from useSavePlace / useSaveRoute write
    // here; the offline mutation queue then syncs the server when we're
    // back online.
    meta: { cacheable: true },
  });
}
