import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { discoverApi } from '../api';

export const DISCOVER_QUERY_KEY = (
  city: string,
  interests: string[],
  style: string | null,
  locale: string,
) => ['discover', city, interests, style, locale] as const;

export function useDiscover() {
  const city             = useAppStore((s) => s.selectedCity);
  const interests        = useOnboardingStore((s) => s.interests);
  const explorationStyle = useOnboardingStore((s) => s.explorationStyle);
  const locale           = useSettingsStore((s) => s.locale);

  return useQuery({
    queryKey: DISCOVER_QUERY_KEY(city, interests, explorationStyle, locale),
    queryFn: () =>
      discoverApi.getDiscover(
        city,
        interests.length > 0 ? interests : undefined,
        explorationStyle ?? undefined,
        locale,
      ),
    staleTime: 1000 * 60 * 10, // 10 min — editorial content doesn't change fast
  });
}
