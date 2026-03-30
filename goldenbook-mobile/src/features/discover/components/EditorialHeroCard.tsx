import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { useTranslation } from '@/i18n';
import type { DiscoverResponse } from '../types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.45;

interface EditorialHeroCardProps {
  hero: NonNullable<DiscoverResponse['editorialHero']>;
}

export function EditorialHeroCard({ hero }: EditorialHeroCardProps) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = getStorageUrl(hero.image.bucket, hero.image.path);

  const handlePress = () => {
    if (hero.target.type === 'place') {
      router.push(`/places/${hero.target.slug}` as any);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.97}
      className="mx-6 rounded-2xl overflow-hidden"
      style={{
        height: HERO_HEIGHT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 8,
      }}
    >
      {/* Image with progressive loading */}
      <ProgressiveImage
        uri={imageUrl}
        height={HERO_HEIGHT}
        resizeMode="cover"
        borderRadius={16}
        placeholderColor="#222D52"
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      {/* Dark base overlay for contrast */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
        pointerEvents="none"
      />

      {/* Goldenbook blue gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(17,35,67,0.55)', 'rgba(17,35,67,0.85)']}
        locations={[0.3, 0.62, 1]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: HERO_HEIGHT * 0.75 }}
        pointerEvents="none"
      />

      {/* Content */}
      <View className="absolute bottom-0 left-0 right-0 p-8">
        {/* Label */}
        <Text className="text-primary text-[10px] uppercase tracking-widest font-bold mb-3">
          {t.discover.goldenbookRecommendation}
        </Text>

        {/* Title */}
        <Text
          className="text-white text-3xl font-bold leading-tight mb-5"
          style={{ maxWidth: SCREEN_WIDTH * 0.7 }}
          numberOfLines={3}
        >
          {hero.title}
        </Text>

        {/* Bottom row: subtitle + CTA */}
        <View className="flex-row items-center justify-between">
          {hero.subtitle && (
            <Text
              className="text-white/70 text-xs font-medium tracking-wide flex-1 mr-4"
              numberOfLines={1}
            >
              {hero.subtitle}
            </Text>
          )}
          <View className="bg-primary items-center justify-center rounded-lg px-5 py-3">
            <Text className="text-navy text-[10px] uppercase tracking-widest font-bold">
              {hero.ctaLabel ?? t.discover.exploreNow}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
