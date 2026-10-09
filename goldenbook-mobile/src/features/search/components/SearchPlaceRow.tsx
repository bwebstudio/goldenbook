import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { track } from '@/analytics/track';
import type { SearchPlaceDTO } from '@/types/api';
import { openPlace } from '@/features/place-detail/openPlace';
import { displayPlaceName } from '@/utils/placeName';

interface Props {
  place: SearchPlaceDTO;
  rank?: number;
  /**
   * Set when the place belongs to another destination (the "elsewhere"
   * results). Shown under the name so the user knows they are leaving the
   * city they picked.
   */
  city?: { slug: string; name: string };
}

export function SearchPlaceRow({ place, rank, city }: Props) {
  const router = useRouter();
  // 72×72 row thumbnail — thumb variant.
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path, 'thumb');

  return (
    <TouchableOpacity
      onPress={() => {
        const elsewhere = city ? { elsewhere: true, place_city: city.slug } : undefined;
        track('search_result_click', {
          placeId: place.id,
          source: 'search',
          metadata: rank != null || elsewhere ? { ...(rank != null ? { rank } : {}), ...elsewhere } : undefined,
        });
        // Place detail is fetched by slug alone, so this works whatever
        // destination is currently selected.
        openPlace(router, place.slug, {
          source: 'search',
          placeId: place.id,
          ...(rank != null ? { rank } : {}),
          ...(elsewhere ? { metadata: elsewhere } : {}),
        });
      }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={city ? `${displayPlaceName(place.name)}, ${city.name}` : place.name}
      className="flex-row items-center gap-4"
    >
      {/* Thumbnail */}
      <View className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 72, height: 72 }}>
        <ProgressiveImage
          uri={imageUrl}
          height={72}
          aspectRatio={1}
          borderRadius={12}
          placeholderColor="#222D52"
          style={{ width: 72 }}
        />
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text className="text-navy font-bold text-sm leading-snug" numberOfLines={1}>
          {displayPlaceName(place.name)}
        </Text>
        {city && (
          <View className="flex-row items-center gap-1 mt-0.5">
            <Ionicons name="location-outline" size={11} color="#D2B68A" />
            <Text className="text-primary text-[10px] uppercase tracking-widest font-bold" numberOfLines={1}>
              {city.name}
            </Text>
          </View>
        )}
        {place.summary && (
          <Text className="text-navy/45 text-[11px] mt-0.5 italic leading-snug" numberOfLines={2}>
            {place.summary}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={14} color="rgba(34,45,82,0.2)" />
    </TouchableOpacity>
  );
}