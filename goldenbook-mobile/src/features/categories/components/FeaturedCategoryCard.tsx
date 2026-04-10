import { TouchableOpacity, View, Text, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import type { CategoryPlaceDTO } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HEIGHT = (SCREEN_WIDTH - 48) * 0.6;

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
      style={{
        height: CARD_HEIGHT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
        elevation: 10,
      }}
    >
      {/* Full-bleed image */}
      <ProgressiveImage
        uri={imageUri}
        height={CARD_HEIGHT}
        borderRadius={16}
        placeholderColor="#222D52"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Multi-stop gradient overlay (Apple TV style) */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(17,24,40,0.06)',
          'rgba(17,24,40,0.30)',
          'rgba(17,24,40,0.65)',
          'rgba(17,24,40,0.88)',
          'rgba(17,24,40,0.96)',
        ]}
        locations={[0, 0.25, 0.4, 0.58, 0.75, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />

      {/* Content — directly on gradient */}
      <View className="absolute bottom-0 left-0 right-0" style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
        <Text
          className="text-[9px] font-bold uppercase tracking-widest mb-1.5"
          style={{ color: '#D2B68A', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
        >
          {place.cityName}
        </Text>
        <Text
          className="text-white font-bold leading-snug mb-1 uppercase"
          style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 18, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
          numberOfLines={2}
        >
          {place.name}
        </Text>
        {place.summary ? (
          <Text
            className="text-[11px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.55)', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
            numberOfLines={1}
          >
            {place.summary}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
