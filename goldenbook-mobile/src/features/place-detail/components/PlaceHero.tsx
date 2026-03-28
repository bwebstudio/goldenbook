import { View, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import type { MediaAsset } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// 4:3 aspect ratio — preserves more scene, less aggressive crop than 70% tall
const HERO_HEIGHT = SCREEN_WIDTH * 0.85;

interface PlaceHeroProps {
  heroImage: MediaAsset;
}

export function PlaceHero({ heroImage }: PlaceHeroProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const imageUrl = getStorageUrl(heroImage.bucket, heroImage.path);

  return (
    <View style={{ height: HERO_HEIGHT }}>
      <StatusBar barStyle="light-content" />

      {/* Image with progressive loading */}
      <ProgressiveImage
        uri={imageUrl}
        height={HERO_HEIGHT}
        placeholderColor="#222D52"
        fadeDuration={500}
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      {/* Top gradient: dark → transparent (button readability) */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120 }}
        pointerEvents="none"
      />

      {/* Bottom gradient: transparent → ivory (blends with content below) */}
      <LinearGradient
        colors={['transparent', 'rgba(248,245,240,0.5)', 'rgba(248,245,240,0.92)']}
        locations={[0.3, 0.7, 1]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: HERO_HEIGHT * 0.45 }}
        pointerEvents="none"
      />

      {/* Back button — dark glass circle, always visible on any background */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute left-6 items-center justify-center rounded-full"
        style={{
          top: insets.top + 8,
          width: 44,
          height: 44,
          backgroundColor: 'rgba(0,0,0,0.42)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.22)',
        }}
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Share button — dark glass circle, always visible on any background */}
      <TouchableOpacity
        className="absolute right-6 items-center justify-center rounded-full"
        style={{
          top: insets.top + 8,
          width: 44,
          height: 44,
          backgroundColor: 'rgba(0,0,0,0.42)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.22)',
        }}
      >
        <Ionicons name="share-outline" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
