import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { useTranslation } from '@/i18n';
import { RouteSaveButton } from '@/features/saved/components/RouteSaveButton';
import type { RouteCardDTO } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

interface RouteCardProps {
  route: RouteCardDTO;
  featured?: boolean;
}

export const RouteCard = React.memo(function RouteCard({ route, featured = false }: RouteCardProps) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = getStorageUrl(route.heroImage.bucket, route.heroImage.path);
  const duration = formatDuration(route.estimatedMinutes);

  const imageHeight = featured ? (SCREEN_WIDTH - 48) * 0.75 : (SCREEN_WIDTH - 48) * 0.6;

  return (
    <View className="mx-6 mb-6" style={{ height: imageHeight }}>
      {/* Card body — navigates to detail */}
      <TouchableOpacity
        onPress={() => router.push(`/routes/${route.slug}` as any)}
        activeOpacity={0.92}
        className="rounded-2xl overflow-hidden"
        style={{
          height: imageHeight,
          shadowColor: '#222D52',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 4,
        }}
      >
        <ProgressiveImage
          uri={imageUrl}
          height={imageHeight}
          placeholderColor="#222D52"
          borderRadius={16}
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        />

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

        {route.featured && (
          <View
            className="absolute top-4 left-4 px-3 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(210,182,138,0.92)' }}
          >
            <Text className="text-navy text-[9px] font-bold uppercase tracking-widest">
              {t.routes.featured}
            </Text>
          </View>
        )}

        <View className="absolute bottom-0 left-0 right-0" style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <Text
            className="text-[9px] font-bold tracking-widest uppercase mb-1"
            style={{ color: '#D2B68A', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
          >
            {route.city.name}
          </Text>

          <Text
            className={`font-bold text-white tracking-tight leading-snug mb-1 ${featured ? 'text-xl' : 'text-lg'}`}
            style={{ fontFamily: 'PlayfairDisplay_700Bold', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
            numberOfLines={2}
          >
            {route.title}
          </Text>

          {featured && route.summary && (
            <Text
              className="text-[11px] leading-relaxed font-light italic mb-2"
              style={{ color: 'rgba(255,255,255,0.6)', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
              numberOfLines={2}
            >
              {route.summary}
            </Text>
          )}

          <View className="flex-row items-center justify-between mt-1">
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-1">
                <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.5)" />
                <Text className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {route.placesCount} {route.placesCount === 1 ? t.discover.place : t.discover.places}
                </Text>
              </View>
              {duration && (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.5)" />
                  <Text className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{duration}</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center gap-1">
              <Text
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: '#D2B68A', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
              >
                {t.routes.beginRoute}
              </Text>
              <Text className="text-xs font-bold" style={{ color: '#D2B68A' }}>→</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Heart — SIBLING of TouchableOpacity, absolute over the card */}
      <View
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RouteSaveButton
            routeId={route.id}
            snapshot={{
              id: route.id,
              slug: route.slug,
              title: route.title,
              summary: route.summary ?? null,
              image:
                route.heroImage?.bucket && route.heroImage?.path
                  ? { bucket: route.heroImage.bucket, path: route.heroImage.path }
                  : null,
            }}
            size={18}
            inactiveColor="#FFFFFF"
            style={{ minWidth: 36, minHeight: 36 }}
          />
        </View>
      </View>
    </View>
  );
});
