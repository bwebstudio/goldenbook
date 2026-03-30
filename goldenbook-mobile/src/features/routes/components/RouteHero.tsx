import { View, Text, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { useTranslation } from '@/i18n';
import type { MediaAsset } from '../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.62;

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

interface RouteHeroProps {
  heroImage: MediaAsset;
  title: string;
  summary: string | null;
  cityName: string;
  placesCount: number;
  estimatedMinutes: number | null;
}

export function RouteHero({
  heroImage,
  title,
  summary,
  cityName,
  placesCount,
  estimatedMinutes,
}: RouteHeroProps) {
  const router = useRouter();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const imageUrl = getStorageUrl(heroImage.bucket, heroImage.path);
  const duration = formatDuration(estimatedMinutes);

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

      {/* Dark base overlay for contrast */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
        pointerEvents="none"
      />

      {/* Goldenbook blue gradient: dark top (back btn) → clear middle → strong navy bottom */}
      <LinearGradient
        colors={['rgba(17,35,67,0.50)', 'transparent', 'rgba(17,35,67,0.65)', 'rgba(17,35,67,0.94)']}
        locations={[0, 0.28, 0.60, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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

      {/* Bottom content */}
      <View className="absolute bottom-0 left-0 right-0 px-8 pb-8">
        {/* City label */}
        <Text className="text-primary text-[10px] font-bold tracking-widest uppercase mb-3">
          {cityName}
        </Text>

        {/* Route title — serif */}
        <Text
          className="text-white text-3xl font-bold tracking-tight leading-tight mb-3"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          numberOfLines={2}
        >
          {title}
        </Text>

        {/* Summary */}
        {summary && (
          <Text className="text-white/70 text-sm leading-relaxed font-light italic mb-4" numberOfLines={2}>
            {summary}
          </Text>
        )}

        {/* Meta pills */}
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.65)" />
            <Text className="text-white/65 text-xs">
              {placesCount} {placesCount === 1 ? t.discover.place : t.discover.places}
            </Text>
          </View>
          {duration && (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.65)" />
              <Text className="text-white/65 text-xs">{duration}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
