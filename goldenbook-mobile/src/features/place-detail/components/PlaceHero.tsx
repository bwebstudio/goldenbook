import { View, Text, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { useTranslation } from '@/i18n';
import type { MediaAsset } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 0.95;

interface PlaceHeroProps {
  heroImage: MediaAsset;
  /** When provided, name + city + rating render OVER the image */
  name?: string;
  cityName?: string;
  rating?: number | null;
  tags?: string[];
  categories?: { name: string }[];
  subcategories?: { name: string }[];
}

export function PlaceHero({ heroImage, name, cityName, rating, tags, categories, subcategories }: PlaceHeroProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const imageUrl = getStorageUrl(heroImage.bucket, heroImage.path);

  const showOverlay = !!name;
  const stars = rating ? Math.round(Math.min(5, Math.max(0, rating))) : 0;

  return (
    <View style={{ height: HERO_HEIGHT }}>
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.45)" />

      {/* Full-bleed image */}
      <ProgressiveImage
        uri={imageUrl}
        height={HERO_HEIGHT}
        placeholderColor="#222D52"
        fadeDuration={500}
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      {/* Multi-stop gradient overlay (Apple TV style) */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.25)',
          'transparent',
          'rgba(17,24,40,0.08)',
          'rgba(17,24,40,0.35)',
          'rgba(17,24,40,0.70)',
          'rgba(17,24,40,0.92)',
          'rgba(17,24,40,0.98)',
        ]}
        locations={[0, 0.12, 0.28, 0.45, 0.62, 0.78, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />

      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute left-6 items-center justify-center rounded-full"
        style={{
          top: insets.top + 8,
          width: 44, height: 44,
          backgroundColor: 'rgba(0,0,0,0.35)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Share button */}
      <TouchableOpacity
        className="absolute right-6 items-center justify-center rounded-full"
        style={{
          top: insets.top + 8,
          width: 44, height: 44,
          backgroundColor: 'rgba(0,0,0,0.35)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <Ionicons name="share-outline" size={20} color="#fff" />
      </TouchableOpacity>

      {/* ── Content overlay on bottom of image ──────────────────────────── */}
      {showOverlay && (
        <View className="absolute bottom-0 left-0 right-0 px-8 pb-8 items-center">
          {/* Editor's Favorite badge */}
          <View
            className="flex-row items-center px-4 py-1.5 rounded-full mb-4"
            style={{
              backgroundColor: 'rgba(210,182,138,0.15)',
              borderWidth: 1,
              borderColor: 'rgba(210,182,138,0.35)',
            }}
          >
            <Text
              className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: '#D2B68A', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
            >
              {t.place.editorsFavorite}
            </Text>
          </View>

          {/* Place name */}
          <Text
            className="text-3xl font-bold text-white tracking-tight text-center leading-tight mb-3"
            style={{ fontFamily: 'PlayfairDisplay_700Bold', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }}
            numberOfLines={3}
          >
            {name}
          </Text>

          {/* Context line: categories · subcategories · city */}
          {(() => {
            const parts: string[] = [];
            if (subcategories && subcategories.length > 0) parts.push(subcategories[0].name);
            else if (categories && categories.length > 0) parts.push(categories[0].name);
            if (tags && tags.length > 0 && parts.length < 2) parts.push(tags[0]);
            if (cityName) parts.push(cityName);
            return parts.length > 0 ? (
              <Text
                className="text-[10px] font-semibold tracking-widest uppercase text-center"
                style={{ color: 'rgba(255,255,255,0.7)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
                numberOfLines={1}
              >
                {parts.join('  ·  ')}
              </Text>
            ) : null;
          })()}

          {/* Stars */}
          {rating != null && (
            <View className="flex-row gap-1 mt-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Text key={i} style={{ color: i < stars ? '#D2B68A' : 'rgba(255,255,255,0.25)', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
                  ★
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
