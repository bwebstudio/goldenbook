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

      {/* Content — directly on gradient */}
      <View className="absolute bottom-0 left-0 right-0" style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        {/* City label */}
        <Text
          className="text-[10px] font-bold tracking-widest uppercase mb-2"
          style={{ color: '#D2B68A', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
        >
          {cityName}
        </Text>

        {/* Route title */}
        <Text
          className="text-white text-2xl font-bold tracking-tight leading-tight mb-2"
          style={{ fontFamily: 'PlayfairDisplay_700Bold', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
          numberOfLines={2}
        >
          {title}
        </Text>

        {/* Summary */}
        {summary && (
          <Text
            className="text-[12px] leading-relaxed font-light italic mb-3"
            style={{ color: 'rgba(255,255,255,0.6)', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
            numberOfLines={2}
          >
            {summary}
          </Text>
        )}

        {/* Meta pills */}
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
              {placesCount} {placesCount === 1 ? t.discover.place : t.discover.places}
            </Text>
          </View>
          {duration && (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.5)" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{duration}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
