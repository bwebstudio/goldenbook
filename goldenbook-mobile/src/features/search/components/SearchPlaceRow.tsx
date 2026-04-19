import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { track } from '@/analytics/track';
import type { SearchPlaceDTO } from '@/types/api';

interface Props {
  place: SearchPlaceDTO;
  rank?: number;
}

export function SearchPlaceRow({ place, rank }: Props) {
  const router = useRouter();
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path);

  return (
    <TouchableOpacity
      onPress={() => {
        track('search_result_click', {
          placeId: place.id,
          source: 'search',
          metadata: rank != null ? { rank } : undefined,
        });
        track('place_open', { placeId: place.id, source: 'search' });
        router.push(`/places/${place.slug}` as any);
      }}
      activeOpacity={0.85}
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
          {place.name}
        </Text>
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