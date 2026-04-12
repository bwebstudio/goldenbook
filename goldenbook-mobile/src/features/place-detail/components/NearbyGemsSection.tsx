import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { PlaceSaveButton } from '@/features/saved/components/PlaceSaveButton';
import { useTranslation } from '@/i18n';
import type { PlaceDetailDTO } from '../types';

type NearbyGem = PlaceDetailDTO['nearbyGems'][number];

const CARD_WIDTH = 200;
const CARD_HEIGHT = 224;

function NearbyGemCard({ gem }: { gem: NearbyGem }) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = getStorageUrl(gem.heroImage.bucket, gem.heroImage.path);
  const distanceText = gem.distanceMeters < 1000
    ? `${gem.distanceMeters}m ${t.place.away}`
    : `${(gem.distanceMeters / 1000).toFixed(1)}km ${t.place.away}`;

  return (
    <View className="mr-6" style={{ width: CARD_WIDTH }}>
      {/* Image + navigation area */}
      <TouchableOpacity
        onPress={() => router.push(`/places/${gem.slug}` as any)}
        activeOpacity={0.88}
      >
        <View
          className="rounded-2xl overflow-hidden mb-4"
          style={{
            height: CARD_HEIGHT,
            shadowColor: '#222D52',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <ProgressiveImage
            uri={imageUrl}
            height={CARD_HEIGHT}
            borderRadius={16}
            placeholderColor="#222D52"
            fadeDuration={350}
          />
        </View>
      </TouchableOpacity>

      {/* Heart — SIBLING of TouchableOpacity, absolute over the image */}
      <View
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(253,253,251,0.85)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlaceSaveButton
            placeId={gem.id}
            snapshot={{
              id: gem.id,
              slug: gem.slug,
              name: gem.name,
              shortDescription: null,
              image:
                gem.heroImage?.bucket && gem.heroImage?.path
                  ? { bucket: gem.heroImage.bucket, path: gem.heroImage.path }
                  : null,
            }}
            size={16}
            style={{ minWidth: 32, minHeight: 32 }}
          />
        </View>
      </View>

      {/* Name */}
      <Text
        className="text-lg text-navy mb-1"
        style={{ fontFamily: 'PlayfairDisplay_400Regular' }}
        numberOfLines={1}
      >
        {gem.name}
      </Text>

      {/* Distance */}
      <Text className="text-[10px] text-navy/40 font-bold uppercase tracking-widest">
        {distanceText}
      </Text>
    </View>
  );
}

interface NearbyGemsSectionProps {
  nearbyGems: NearbyGem[];
}

export function NearbyGemsSection({ nearbyGems }: NearbyGemsSectionProps) {
  const t = useTranslation();
  if (!nearbyGems.length) return null;

  return (
    <View className="mt-16 pb-8">
      <Text className="text-[10px] font-bold text-primary uppercase tracking-widest px-8 mb-8">
        {t.place.curatedNearby}
      </Text>
      <FlatList
        horizontal
        data={nearbyGems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NearbyGemCard gem={item} />}
        contentContainerStyle={{ paddingHorizontal: 32 }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}
