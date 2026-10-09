import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { savedApi } from '../api';

// The saved list belongs to one user, and the React Query cache is persisted
// to disk. Keying by user id means a cache entry written for one account can
// never be served to another one on the same device (signOut also wipes the
// cache, this is the second line of defence). `['saved']` stays a valid
// prefix for invalidation.
export const SAVED_QUERY_KEY = (userId: string | null | undefined, locale: string) =>
  ['saved', userId ?? 'anonymous', locale] as const;

export function useSaved() {
  const session = useAuthStore((s) => s.session);
  const userId  = useAuthStore((s) => s.user?.id ?? null);
  const locale  = useSettingsStore((s) => s.locale);

  return useQuery({
    queryKey: SAVED_QUERY_KEY(userId, locale),
    queryFn: () => savedApi.getSaved(locale),
    enabled: !!session && !!userId,
    staleTime: 1000 * 60 * 5,
    // Saved list MUST be cacheable so the user can browse their favorites
    // offline. Optimistic updates from useSavePlace / useSaveRoute write
    // here; the offline mutation queue then syncs the server when we're
    // back online.
    meta: { cacheable: true },
  });
}
