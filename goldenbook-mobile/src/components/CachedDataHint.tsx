import React from 'react';
import { View, Text } from 'react-native';
import { useNetworkStore, selectIsOffline } from '@/store/networkStore';
import { useTranslation } from '@/i18n';

// Inline pill rendered above content when a screen is showing data that came
// from the AsyncStorage cache while the device is offline. The global
// `OfflineBanner` already announces the connectivity state at the top of the
// app — this hint is a per-screen cue so the user knows *this specific
// content* is the saved copy, not a live response.
//
// Render unconditionally inside a screen; the component self-suppresses when
// the device is online or `cached` is false.

interface CachedDataHintProps {
  /**
   * Whether the data being rendered came from cache (vs a fresh fetch). Most
   * screens get this from the React Query `dataUpdatedAt`-based heuristic
   * (`isPaused` / `fetchStatus === 'paused'`) or from a feature-specific
   * `fromCache` flag exposed by hooks like `useNowRecommendation`.
   */
  cached: boolean;
  /**
   * Force-show the hint even when NetInfo says we're online. Useful when a
   * fetch failed and the screen fell back to cache without flipping the
   * device-level offline state. Defaults to `false` — we only nudge the
   * user when we know they're offline.
   */
  showWhenOnline?: boolean;
  /** Override the default "showingCached" copy (e.g. NOW uses bespoke wording). */
  label?: string;
}

export function CachedDataHint({
  cached,
  showWhenOnline = false,
  label,
}: CachedDataHintProps) {
  const isOffline = useNetworkStore(selectIsOffline);
  const t = useTranslation();

  if (!cached) return null;
  if (!isOffline && !showWhenOnline) return null;

  return (
    <View
      accessibilityRole="text"
      style={{
        marginHorizontal: 24,
        marginTop: 8,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(34,45,82,0.06)',
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#D2B68A',
        }}
      />
      <Text
        style={{
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
          color: 'rgba(34,45,82,0.7)',
          letterSpacing: 0.3,
        }}
      >
        {label ?? t.offline.savedResultsHint}
      </Text>
    </View>
  );
}
