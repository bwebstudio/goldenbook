import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { PlaceSaveButton } from '@/features/saved/components/PlaceSaveButton';
import { useTranslation } from '@/i18n';
import type { PlaceDetailDTO } from '../types';

type NearbyGem = PlaceDetailDTO['nearbyGems'][number];

const CARD_WIDTH = 200;
const CARD_HEIGHT = 224; // h-56 equivalent

function NearbyGemCard({ gem }: { gem: NearbyGem }) {
  const router = useRouter();
  const t = useTranslation();
  const imageUrl = getStorageUrl(gem.heroImage.bucket, gem.heroImage.path);
  const distanceText = gem.distanceMeters < 1000
    ? `${gem.distanceMeters}m ${t.place.away}`
    : `${(gem.distanceMeters / 1000).toFixed(1)}km ${t.place.away}`;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/places/${gem.slug}` as any)}
      activeOpacity={0.88}
      className="mr-6"
      style={{ width: CARD_WIDTH }}
    >
      {/* Image */}
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

        {/* Save bookmark overlay */}
        <View
          className="absolute top-4 right-4 w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: 'rgba(253,253,251,0.85)' }}
        >
          <PlaceSaveButton placeId={gem.id} size={16} />
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
    </TouchableOpacity>
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
