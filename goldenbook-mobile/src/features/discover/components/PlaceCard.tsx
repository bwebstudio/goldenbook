import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { useTranslation } from '@/i18n';
import { PlaceSaveButton } from '@/features/saved/components/PlaceSaveButton';
import type { DiscoverPlaceCard } from '../types';

function toSnapshot(place: DiscoverPlaceCard) {
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    shortDescription: place.shortDescription,
    image:
      place.heroImage?.bucket && place.heroImage?.path
        ? { bucket: place.heroImage.bucket, path: place.heroImage.path }
        : null,
  };
}

interface PlaceCardProps {
  place: DiscoverPlaceCard;
  variant?: 'horizontal' | 'editorial';
  width?: number;
}

// ─── Horizontal row (Hidden Spots) ──────────────────────────────────────────

function HiddenSpotRow({ place }: { place: DiscoverPlaceCard }) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path);

  return (
    <View className="flex-row items-center gap-4">
      <TouchableOpacity
        onPress={() => router.push(`/places/${place.slug}` as any)}
        activeOpacity={0.85}
        className="flex-row items-center gap-4 flex-1"
      >
        <View className="flex-shrink-0" style={{ width: 80, height: 80 }}>
          <ProgressiveImage
            uri={imageUrl}
            height={80}
            aspectRatio={1}
            borderRadius={12}
            placeholderColor="#222D52"
            style={{ width: 80 }}
          />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-navy text-sm leading-snug" numberOfLines={2}>
            {place.name}
          </Text>
          {place.shortDescription && (
            <Text className="text-navy/50 text-[11px] mt-1 italic" numberOfLines={2}>
              {place.shortDescription}
            </Text>
          )}
          <View className="flex-row items-center gap-1 mt-2">
            <Ionicons name="location-outline" size={10} color="#D2B68A" />
            <Text className="text-primary text-[9px] uppercase tracking-widest font-bold">
              {t.discover.nearYou}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <PlaceSaveButton placeId={place.id} snapshot={toSnapshot(place)} size={22} />
    </View>
  );
}

// ─── Portrait card (Golden Picks) ───────────────────────────────────────────

function EditorialPortraitCard({ place, width = 224 }: { place: DiscoverPlaceCard; width?: number }) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path);
  const CARD_HEIGHT = width * 1.5;

  const subtitle = [place.categoryName, place.subcategoryName]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <View className="mr-6" style={{ width }}>
      <TouchableOpacity
        onPress={() => router.push(`/places/${place.slug}` as any)}
        activeOpacity={0.92}
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
          <ProgressiveImage
            uri={imageUrl}
            height={CARD_HEIGHT}
            borderRadius={16}
            placeholderColor="#222D52"
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
            locations={[0, 0.3, 0.45, 0.62, 0.78, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            pointerEvents="none"
          />
          {place.isSponsored && (
            <View className="absolute top-3 left-3">
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 8, letterSpacing: 0.3 }}>
                {t.common.sponsoredGoldenbook}
              </Text>
            </View>
          )}
          <View className="absolute bottom-0 left-0 right-0" style={{ paddingHorizontal: 14, paddingBottom: 16 }}>
            <Text
              className="font-bold text-[15px] leading-tight text-white"
              style={{ textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
              numberOfLines={2}
            >
              {place.name}
            </Text>
            {subtitle ? (
              <Text
                className="text-[9px] uppercase tracking-widest mt-1.5 font-bold"
                style={{ color: '#D2B68A', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {/* Heart — sibling, 44×44 touch area, icon + bg in one element */}
      <PlaceSaveButton
        placeId={place.id}
        snapshot={toSnapshot(place)}
        size={18}
        inactiveColor="#FFFFFF"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </View>
  );
}

export const PlaceCard = React.memo(function PlaceCard({ place, variant = 'editorial', width }: PlaceCardProps) {
  if (variant === 'horizontal') {
    return <HiddenSpotRow place={place} />;
  }
  return <EditorialPortraitCard place={place} width={width} />;
});
