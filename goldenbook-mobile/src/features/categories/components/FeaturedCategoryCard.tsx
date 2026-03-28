import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import type { CategoryPlaceDTO } from '../types';

interface FeaturedCategoryCardProps {
  place: CategoryPlaceDTO;
}

export function FeaturedCategoryCard({ place }: FeaturedCategoryCardProps) {
  const router = useRouter();
  const imageUri = getStorageUrl(place.heroImage.bucket, place.heroImage.path);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/places/${place.slug}` as any)}
      activeOpacity={0.9}
      className="mx-6 mb-4 rounded-2xl overflow-hidden"
      style={styles.card}
    >
      <ProgressiveImage
        uri={imageUri}
        aspectRatio={16 / 9}
        borderRadius={16}
      />

      <LinearGradient
        colors={['transparent', 'rgba(34,45,82,0.85)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.4 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      <View className="absolute bottom-0 left-0 right-0 p-5">
        <Text className="text-[9px] font-bold uppercase tracking-widest text-primary/80 mb-1.5">
          {place.cityName}
        </Text>
        <Text
          className="text-ivory/90 font-bold leading-snug mb-1"
          style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20 }}
          numberOfLines={2}
        >
          {place.name}
        </Text>
        {place.summary ? (
          <Text className="text-ivory/60 text-xs leading-relaxed" numberOfLines={2}>
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
});