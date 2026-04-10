import React from 'react';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '@/i18n';
import type { DiscoverRoute } from '../types';

// Background image source: route.heroImage (set via admin dashboard / CMS).
// If the route has no heroImage, the navy fallback colour shows through.

const CARD_HEIGHT = 250;

interface RouteCardProps {
  route: DiscoverRoute;
}

export const RouteCard = React.memo(function RouteCard({ route }: RouteCardProps) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = route.heroImage
    ? getStorageUrl(route.heroImage.bucket, route.heroImage.path)
    : null;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/routes/${route.slug}` as any)}
      activeOpacity={0.9}
      className="mx-6 mb-4 rounded-2xl overflow-hidden"
      style={{
        height: CARD_HEIGHT,
        backgroundColor: '#222D52',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
        elevation: 10,
      }}
    >
      {/* Full-bleed hero image */}
      {imageUrl && (
        <ProgressiveImage
          uri={imageUrl}
          height={CARD_HEIGHT}
          resizeMode="cover"
          placeholderColor="#222D52"
          fadeDuration={400}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      {/* Multi-stop gradient overlay (Apple TV style) */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(17,24,40,0.10)',
          'rgba(17,24,40,0.40)',
          'rgba(17,24,40,0.72)',
          'rgba(17,24,40,0.90)',
          'rgba(17,24,40,0.97)',
        ]}
        locations={[0, 0.15, 0.32, 0.50, 0.68, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />

      {/* Content — positioned over gradient */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 24 }}>
        {/* Label */}
        <Text
          className="font-bold text-[10px] uppercase tracking-widest mb-3"
          style={{ fontFamily: 'Inter_700Bold', color: '#D2B68A', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
        >
          {t.discover.curatedItinerary}
        </Text>

        {/* Title */}
        <Text
          className="text-2xl font-bold text-white mb-3 leading-tight"
          style={{ fontFamily: 'PlayfairDisplay_700Bold', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
          numberOfLines={2}
        >
          {route.title}
        </Text>

        {/* Summary */}
        {route.summary && (
          <Text
            className="text-sm mb-6 leading-relaxed"
            style={{ fontFamily: 'Inter_300Light', maxWidth: '85%', color: 'rgba(255,255,255,0.65)', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
            numberOfLines={2}
          >
            {route.summary}
          </Text>
        )}

        {/* CTA row */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Text
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{ fontFamily: 'Inter_700Bold', color: '#D2B68A', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
            >
              {t.discover.beginRoute}
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#D2B68A" />
          </View>

          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              {route.placesCount} {route.placesCount === 1 ? t.discover.place : t.discover.places}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

