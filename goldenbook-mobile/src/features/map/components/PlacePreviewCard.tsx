import { Platform, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import { useTranslation } from '@/i18n';
import type { MapPlace } from '@/types/api';
import { colors, typography, spacing, radius, elevation } from '@/design/tokens';

interface PlacePreviewCardProps {
  place: MapPlace;
  onClose: () => void;
}

/**
 * Opens the place in the native Maps app for turn-by-turn navigation.
 * Falls back to the place detail screen if coordinates are unavailable.
 */
function openInMaps(place: MapPlace, router: ReturnType<typeof useRouter>) {
  const { latitude, longitude } = place;
  if (latitude != null && longitude != null) {
    const label = encodeURIComponent(place.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}&ll=${latitude},${longitude}`,
      default: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
    })!;
    Linking.openURL(url).catch(() => {
      // Fallback: Google Maps web
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      ).catch(() => {});
    });
  } else {
    // No coordinates → open place detail instead
    router.push(`/places/${place.slug}` as any);
  }
}

export function PlacePreviewCard({ place, onClose }: PlacePreviewCardProps) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path);

  return (
    <View style={styles.container}>
      <View style={styles.handle} />

      <View style={styles.row}>
        {/* Thumbnail */}
        <TouchableOpacity
          onPress={() => router.push(`/places/${place.slug}` as any)}
          activeOpacity={0.85}
        >
          <ProgressiveImage
            uri={imageUrl}
            height={64}
            borderRadius={radius.md}
            placeholderColor={colors.navy.DEFAULT}
            style={styles.thumbnail}
          />
        </TouchableOpacity>

        {/* Name + city — tap opens detail */}
        <TouchableOpacity
          onPress={() => router.push(`/places/${place.slug}` as any)}
          activeOpacity={0.85}
          style={styles.info}
        >
          <Text style={styles.name} numberOfLines={1}>
            {place.name}
          </Text>
          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={10} color={colors.primary} />
            <Text style={styles.city} numberOfLines={1}>
              {place.cityName}
            </Text>
          </View>
        </TouchableOpacity>

        {/* "Ir" → opens native Maps for navigation */}
        <TouchableOpacity
          onPress={() => openInMaps(place, router)}
          activeOpacity={0.8}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{t.map.go}</Text>
          <Ionicons name="navigate" size={12} color={colors.ivory.DEFAULT} />
        </TouchableOpacity>
      </View>

      {/* Close */}
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
        <Ionicons name="close" size={16} color={colors.navy.DEFAULT} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.ivory.DEFAULT,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    ...elevation.overlay,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: `${colors.navy.DEFAULT}20`,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  thumbnail: {
    width: 64,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: typography.serif,
    fontSize: 16,
    color: colors.navy.DEFAULT,
    fontWeight: typography.semibold,
    letterSpacing: typography.tight,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  city: {
    fontSize: 10,
    color: `${colors.navy.DEFAULT}55`,
    textTransform: 'uppercase',
    letterSpacing: typography.widest,
    fontWeight: typography.bold,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.navy.DEFAULT,
    paddingHorizontal: spacing.base + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
  },
  ctaText: {
    fontSize: 13,
    color: colors.ivory.DEFAULT,
    fontWeight: typography.bold,
    letterSpacing: typography.wide,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.base,
    right: spacing.lg,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.navy.DEFAULT}08`,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
