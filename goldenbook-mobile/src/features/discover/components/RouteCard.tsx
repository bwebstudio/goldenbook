import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '@/i18n';
import type { DiscoverRoute } from '../types';

// Background image source: route.heroImage (set via admin dashboard / CMS).
// If the route has no heroImage, the navy fallback colour shows through.

interface RouteCardProps {
  route: DiscoverRoute;
}

export function RouteCard({ route }: RouteCardProps) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = route.heroImage
    ? getStorageUrl(route.heroImage.bucket, route.heroImage.path)
    : null;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/routes/${route.slug}` as any)}
      activeOpacity={0.9}
      className="mx-6 mb-4 rounded-2xl overflow-hidden border border-primary/20"
      style={{
        // Fallback background when no image is available
        backgroundColor: '#222D52',
        shadowColor: '#222D52',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: 6,
      }}
    >
      {/* Background image — subtle, mostly covered by navy overlay */}
      {imageUrl && (
        <ProgressiveImage
          uri={imageUrl}
          height={220}
          resizeMode="cover"
          placeholderColor="#222D52"
          fadeDuration={400}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: '100%' }}
        />
      )}

      {/* Dark base overlay */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
        pointerEvents="none"
      />

      {/* Goldenbook blue overlay — almost fully opaque for cinematic navy look */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(17,35,67,0.88)',
        }}
        pointerEvents="none"
      />

      {/* Content — sits above overlay */}
      <View className="p-8">
        {/* Label */}
        <Text
          className="text-primary font-bold text-[10px] uppercase tracking-widest mb-4"
          style={{ fontFamily: 'Inter_700Bold' }}
        >
          {t.discover.curatedItinerary}
        </Text>

        {/* Title */}
        <Text
          className="text-2xl font-bold text-ivory mb-4 leading-tight"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          numberOfLines={2}
        >
          {route.title}
        </Text>

        {/* Summary */}
        {route.summary && (
          <Text
            className="text-ivory/70 text-sm mb-8 leading-relaxed"
            style={{ fontFamily: 'Inter_300Light', maxWidth: '85%' }}
            numberOfLines={3}
          >
            {route.summary}
          </Text>
        )}

        {/* CTA row */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Text
              className="text-primary text-[10px] uppercase tracking-widest font-bold"
              style={{ fontFamily: 'Inter_700Bold' }}
            >
              {t.discover.beginRoute}
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#D2B68A" />
          </View>

          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={13} color="rgba(253,253,251,0.5)" />
            <Text className="text-ivory/50 text-xs">
              {route.placesCount} {route.placesCount === 1 ? t.discover.place : t.discover.places}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

