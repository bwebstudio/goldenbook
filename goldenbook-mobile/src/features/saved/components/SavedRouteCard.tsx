import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import { useSaveRoute } from '../hooks/useSaveRoute';
import type { SavedRouteDTO } from '@/types/api';
import { colors, typography, spacing, radius } from '@/design/tokens';

interface SavedRouteCardProps {
  route: SavedRouteDTO;
}

export function SavedRouteCard({ route }: SavedRouteCardProps) {
  const router = useRouter();
  const { toggle, isPending } = useSaveRoute(route.id);
  const imageUrl = getStorageUrl(route.image?.bucket ?? null, route.image?.path ?? null);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/routes/${route.slug}` as any)}
      activeOpacity={0.85}
      style={styles.container}
    >
      {/* Thumbnail */}
      <ProgressiveImage
        uri={imageUrl}
        height={72}
        borderRadius={radius.md}
        placeholderColor={colors.navy.DEFAULT}
        style={styles.image}
      />

      {/* Text */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {route.title}
        </Text>
        {route.summary && (
          <Text style={styles.summary} numberOfLines={2}>
            {route.summary}
          </Text>
        )}
      </View>

      {/* Unsave button */}
      <TouchableOpacity
        onPress={toggle}
        disabled={isPending}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="heart"
          size={20}
          color={isPending ? `${colors.primary}60` : colors.primary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.navy.DEFAULT}07`,
  },
  image: {
    width: 72,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: typography.serif,
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.navy.DEFAULT,
    letterSpacing: typography.tight,
  },
  summary: {
    fontSize: typography.caption,
    color: `${colors.navy.DEFAULT}55`,
    lineHeight: 17,
    fontStyle: 'italic',
  },
});
