import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import type { MapPlace } from '@/types/api';
import { colors, typography, spacing, radius, elevation } from '@/design/tokens';

interface PlacePreviewCardProps {
  place: MapPlace;
  onClose: () => void;
}

export function PlacePreviewCard({ place, onClose }: PlacePreviewCardProps) {
  const router = useRouter();
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path);

  const handleViewPlace = () => {
    router.push(`/places/${place.slug}`);
  };

  return (
    <View style={styles.container}>
      {/* Handle bar */}
      <View style={styles.handle} />

      <View style={styles.row}>
        {/* Hero image thumbnail */}
        <ProgressiveImage
          uri={imageUrl}
          height={72}
          borderRadius={radius.md}
          placeholderColor={colors.navy.DEFAULT}
          style={styles.thumbnail}
        />

        {/* Text block */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {place.name}
          </Text>
          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={11} color={colors.primary} />
            <Text style={styles.city} numberOfLines={1}>
              {place.cityName}
            </Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={handleViewPlace}
          activeOpacity={0.8}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>Ver</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.ivory.DEFAULT} />
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
    width: 72,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontFamily: typography.serif,
    fontSize: typography.title,
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
    fontSize: typography.caption,
    color: `${colors.navy.DEFAULT}60`,
    textTransform: 'uppercase',
    letterSpacing: typography.widest,
    fontWeight: typography.bold,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.navy.DEFAULT,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
  },
  ctaText: {
    fontSize: typography.caption,
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
