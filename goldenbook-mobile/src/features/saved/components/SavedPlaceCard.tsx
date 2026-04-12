import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import { PlaceSaveButton } from './PlaceSaveButton';
import type { SavedPlaceDTO } from '@/types/api';
import { colors, typography, spacing, radius } from '@/design/tokens';

interface SavedPlaceCardProps {
  place: SavedPlaceDTO;
}

export const SavedPlaceCard = React.memo(function SavedPlaceCard({ place }: SavedPlaceCardProps) {
  const router = useRouter();
  const imageUrl = getStorageUrl(place.image?.bucket ?? null, place.image?.path ?? null);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.push(`/places/${place.slug}` as any)}
        activeOpacity={0.85}
        style={styles.touchRow}
      >
        <ProgressiveImage uri={imageUrl} height={72} borderRadius={radius.md} placeholderColor={colors.navy.DEFAULT} style={styles.image} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
          {place.shortDescription && <Text style={styles.description} numberOfLines={2}>{place.shortDescription}</Text>}
        </View>
      </TouchableOpacity>
      <PlaceSaveButton placeId={place.id} snapshot={place} size={22} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: `${colors.navy.DEFAULT}07` },
  touchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  image: { width: 72, flexShrink: 0 },
  info: { flex: 1, gap: 4 },
  name: { fontFamily: typography.serif, fontSize: typography.bodySmall, fontWeight: typography.semibold, color: colors.navy.DEFAULT, letterSpacing: typography.tight },
  description: { fontSize: typography.caption, color: `${colors.navy.DEFAULT}55`, lineHeight: 17, fontStyle: 'italic' },
});
