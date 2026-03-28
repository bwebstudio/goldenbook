import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { useTranslation } from '@/i18n';
import type { RouteCardDTO } from '../types';

const { width } = Dimensions.get('window');

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

export function RouteCard({ route, featured = false }: RouteCardProps) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = getStorageUrl(route.heroImage.bucket, route.heroImage.path);
  const duration = formatDuration(route.estimatedMinutes);

  // Featured: taller, more cinematic. Regular: slightly taller than before.
  const imageHeight = featured ? (width - 48) * 0.72 : (width - 48) * 0.65;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/routes/${route.slug}` as any)}
      activeOpacity={0.92}
      className="mx-6 mb-6 rounded-2xl overflow-hidden bg-ivory"
      style={{
        shadowColor: '#222D52',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 3,
      }}
    >
      {/* Hero image */}
      <View style={{ height: imageHeight }} className="bg-navy">
        <ProgressiveImage
          uri={imageUrl}
          height={imageHeight}
          placeholderColor="#222D52"
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        />

        {/* Subtle overlay */}
        <View
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(34,45,82,0.28)' }}
        />

        {/* Featured badge — only shown when explicitly featured from backend */}
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
      </View>

      {/* Content block */}
      <View className="p-5">
        {/* City label */}
        <Text className="text-[10px] text-primary font-bold tracking-widest uppercase mb-1">
          {route.city.name}
        </Text>

        {/* Title — larger for featured */}
        <Text
          className={`font-bold text-navy tracking-tight leading-snug mb-2 ${featured ? 'text-2xl' : 'text-xl'}`}
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          numberOfLines={2}
        >
          {route.title}
        </Text>

        {/* Summary */}
        {route.summary && (
          <Text className="text-sm text-navy/55 leading-relaxed font-light italic mb-4" numberOfLines={2}>
            {route.summary}
          </Text>
        )}

        {/* Meta row */}
        <View className="flex-row items-center gap-4 mb-4">
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={13} color="#999" />
            <Text className="text-xs text-navy/45">
              {route.placesCount} {route.placesCount === 1 ? t.discover.place : t.discover.places}
            </Text>
          </View>
          {duration && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="time-outline" size={13} color="#999" />
              <Text className="text-xs text-navy/45">{duration}</Text>
            </View>
          )}
        </View>

        {/* CTA — full-width button for featured, inline text for regular */}
        {featured ? (
          <View
            className="rounded-xl py-3.5 items-center justify-center flex-row gap-2"
            style={{ backgroundColor: '#222D52' }}
          >
            <Text className="text-primary text-[11px] font-bold uppercase tracking-widest">
              {t.routes.beginRoute}
            </Text>
            <Text className="text-primary text-sm font-bold">→</Text>
          </View>
        ) : (
          <View className="border-t border-navy/8 pt-3 flex-row items-center justify-end gap-1">
            <Text className="text-primary text-[11px] font-bold uppercase tracking-widest">
              {t.routes.beginRoute}
            </Text>
            <Text className="text-primary text-sm font-bold">→</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}