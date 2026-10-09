import { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MapViewContainer } from '@/features/map/components';
import { colors, typography, spacing, radius, elevation } from '@/design/tokens';
import { track } from '@/analytics/track';
import { useAppStore } from '@/store/appStore';
import { useTranslation } from '@/i18n';
import { parsePlaceSource } from '@/features/place-detail/openPlace';

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topOffset = insets.top + spacing.sm;
  const selectedCity = useAppStore((s) => s.selectedCity);
  const t = useTranslation();

  // `src` says where the map was opened from ('place', 'discover',
  // 'category'...). `placeId` is set when it was opened from a place detail.
  const { lat, lng, src, placeId } = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    src?: string;
    placeId?: string;
  }>();
  const focusCoords =
    lat && lng
      ? { latitude: parseFloat(lat), longitude: parseFloat(lng) }
      : undefined;

  // The single map_open for every way into the map. Callers only pass `src`;
  // they must not track map_open themselves or the open is counted twice.
  // `from` keeps the raw origin; `source` is filled only when it is a
  // known PlaceSource.
  useEffect(() => {
    const from = typeof src === 'string' && src ? src : 'direct';
    const source = parsePlaceSource(from, 'direct');
    track('map_open', {
      ...(placeId ? { placeId } : {}),
      ...(source === from ? { source } : {}),
      metadata: { city: selectedCity, from },
    });
    // Only once per mount: the params don't change while the screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity]);

  return (
    <View style={styles.container}>
      <MapViewContainer focusCoords={focusCoords} />

      {/* Floating top bar */}
      <View style={[styles.topBar, { top: topOffset }]} pointerEvents="box-none">
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          style={styles.backBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t.common.goBack}
        >
          <Ionicons name="arrow-back" size={18} color={colors.navy.DEFAULT} />
        </TouchableOpacity>

        {/* Title pill — centered relative to full width */}
        <View style={styles.titlePill}>
          <Text style={styles.titleText}>{t.map.title}</Text>
        </View>

        {/* Spacer to balance the back button */}
        <View style={styles.spacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory.DEFAULT,
  },
  topBar: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ivory.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  titlePill: {
    backgroundColor: colors.ivory.DEFAULT,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    ...elevation.card,
  },
  titleText: {
    fontSize: typography.caption,
    fontWeight: typography.bold,
    color: colors.navy.DEFAULT,
    letterSpacing: typography.wider,
    textTransform: 'uppercase',
  },
  spacer: {
    width: 40,
  },
});
