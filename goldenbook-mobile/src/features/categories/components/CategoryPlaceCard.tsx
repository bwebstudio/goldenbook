import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import type { CategoryPlaceDTO } from '../types';

interface CategoryPlaceCardProps {
  place: CategoryPlaceDTO;
}

export function CategoryPlaceCard({ place }: CategoryPlaceCardProps) {
  const router = useRouter();
  const imageUri = getStorageUrl(place.heroImage.bucket, place.heroImage.path);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/places/${place.slug}` as any)}
      activeOpacity={0.85}
      style={styles.card}
      className="flex-1 rounded-xl overflow-hidden bg-ivory"
    >
      <ProgressiveImage uri={imageUri} aspectRatio={4 / 3} borderRadius={12} />

      <View className="p-3">
        <Text
          className="text-[9px] font-bold uppercase tracking-widest text-primary/70 mb-1"
          numberOfLines={1}
        >
          {place.cityName}
        </Text>
        <Text
          className="text-navy font-bold text-sm leading-snug uppercase"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          numberOfLines={2}
        >
          {place.name}
        </Text>
        {place.summary ? (
          <Text className="text-navy/50 text-xs mt-1 leading-relaxed" numberOfLines={2}>
            {place.summary}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#222D52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
});