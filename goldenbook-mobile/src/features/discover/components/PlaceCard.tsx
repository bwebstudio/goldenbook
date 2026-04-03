import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { useTranslation } from '@/i18n';
import type { DiscoverPlaceCard } from '../types';

interface PlaceCardProps {
  place: DiscoverPlaceCard;
  /**
   * horizontal — small thumbnail left, text right (Hidden Spots list)
   * editorial  — tall portrait card with overlay (Golden Picks scroll)
   */
  variant?: 'horizontal' | 'editorial';
  width?: number;
}

// ─── Hidden Spots variant: horizontal row ─────────────────────────────────────
function HiddenSpotRow({ place }: { place: DiscoverPlaceCard }) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/places/${place.slug}` as any)}
      activeOpacity={0.85}
      className="flex-row items-center gap-4"
    >
      {/* Thumbnail with sponsored overlay */}
      <View className="flex-shrink-0" style={{ width: 80, height: 80 }}>
        <ProgressiveImage
          uri={imageUrl}
          height={80}
          aspectRatio={1}
          borderRadius={12}
          placeholderColor="#222D52"
          style={{ width: 80 }}
        />
        {place.isSponsored && (
          <View style={{ position: 'absolute', top: 4, left: 4 }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 7, letterSpacing: 0.2 }}>
              Sponsored
            </Text>
          </View>
        )}
      </View>

      {/* Text */}
      <View className="flex-1">
        <Text className="font-bold text-navy text-sm leading-snug" numberOfLines={2}>
          {place.name}
        </Text>
        {place.shortDescription && (
          <Text className="text-navy/50 text-[11px] mt-1 italic" numberOfLines={2}>
            {place.shortDescription}
          </Text>
        )}
        {/* Near You label */}
        <View className="flex-row items-center gap-1 mt-2">
          <Ionicons name="location-outline" size={10} color="#D2B68A" />
          <Text className="text-primary text-[9px] uppercase tracking-widest font-bold">
            {t.discover.nearYou}
          </Text>
        </View>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={14} color="rgba(34,45,82,0.25)" />
    </TouchableOpacity>
  );
}

// ─── Golden Picks variant: tall portrait card with overlay ───────────────────
function EditorialPortraitCard({ place, width = 224 }: { place: DiscoverPlaceCard; width?: number }) {
  const router = useRouter();
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path);
  const CARD_HEIGHT = width * 1.5; // 2:3 ratio

  return (
    <TouchableOpacity
      onPress={() => router.push(`/places/${place.slug}` as any)}
      activeOpacity={0.92}
      className="mr-6"
      style={{ width }}
    >
      <View
        className="rounded-2xl overflow-hidden"
        style={{
          height: CARD_HEIGHT,
          shadowColor: '#222D52',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 4,
        }}
      >
        {/* Image with progressive loading */}
        <ProgressiveImage
          uri={imageUrl}
          height={CARD_HEIGHT}
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
          colors={['transparent', 'rgba(17,35,67,0.55)', 'rgba(17,35,67,0.88)']}
          locations={[0, 0.55, 1]}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: CARD_HEIGHT * 0.65 }}
        />

        {/* Sponsored badge (top-left, subtle) */}
        {place.isSponsored && (
          <View className="absolute top-3 left-3">
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 8, letterSpacing: 0.3 }}>
              Sponsored · Goldenbook
            </Text>
          </View>
        )}

        {/* Bottom content */}
        <View className="absolute bottom-5 left-5 right-5">
          <Text className="font-bold text-lg leading-tight text-white" numberOfLines={2}>
            {place.name}
          </Text>
          {place.shortDescription && (
            <Text className="text-primary text-[10px] uppercase tracking-widest mt-2 font-bold" numberOfLines={1}>
              {place.shortDescription}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function PlaceCard({ place, variant = 'editorial', width }: PlaceCardProps) {
  if (variant === 'horizontal') {
    return <HiddenSpotRow place={place} />;
  }
  return <EditorialPortraitCard place={place} width={width} />;
}
