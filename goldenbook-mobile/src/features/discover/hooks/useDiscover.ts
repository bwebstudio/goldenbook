import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { discoverApi } from '../api';

export const DISCOVER_QUERY_KEY = (
  city: string,
  interestsKey: string,
  style: string | null,
  locale: string,
) => ['discover', city, interestsKey, style, locale] as const;

export function useDiscover() {
  const city             = useAppStore((s) => s.selectedCity);
  const interests        = useOnboardingStore((s) => s.interests);
  const explorationStyle = useOnboardingStore((s) => s.explorationStyle);
  const locale           = useSettingsStore((s) => s.locale);

  // Use a string key for interests so the query identity is stable across
  // re-renders (Zustand can produce a new array reference even when the
  // contents are unchanged, which used to cause unwanted refetches).
  const interestsKey = interests.join(',');

  return useQuery({
    queryKey: DISCOVER_QUERY_KEY(city, interestsKey, explorationStyle, locale),
    queryFn: () =>
      discoverApi.getDiscover(
        city,
        interestsKey.length > 0 ? interestsKey.split(',') : undefined,
        explorationStyle ?? undefined,
        locale,
      ),
    staleTime: 1000 * 60 * 10, // 10 min — editorial content doesn't change fast
    // Keep showing the previous feed while the new locale/city refetches.
    // Without this, changing the language wiped the screen and dropped the
    // user on a full-screen spinner — which felt like the feed had frozen.
    placeholderData: keepPreviousData,
  });
}
