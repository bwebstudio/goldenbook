import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { useTranslation } from '@/i18n';
import type { PlaceDetailDTO } from '../types';

type OtherLocation = PlaceDetailDTO['otherLocations'][number];

const CARD_WIDTH = 180;
const CARD_HEIGHT = 200;

function OtherLocationCard({ location }: { location: OtherLocation }) {
  const router = useRouter();
  const imageUrl = getStorageUrl(location.heroImage.bucket, location.heroImage.path);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/places/${location.slug}` as any)}
      activeOpacity={0.88}
      className="mr-6"
      style={{ width: CARD_WIDTH }}
    >
      <View
        className="rounded-2xl overflow-hidden mb-3"
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

      <Text
        className="text-base text-navy mb-0.5"
        style={{ fontFamily: 'PlayfairDisplay_400Regular' }}
        numberOfLines={1}
      >
        {location.name}
      </Text>

      <Text className="text-[10px] text-navy/40 font-bold uppercase tracking-widest">
        {location.cityName}
      </Text>
    </TouchableOpacity>
  );
}

interface OtherLocationsSectionProps {
  brandName: string;
  otherLocations: OtherLocation[];
}

export function OtherLocationsSection({ brandName, otherLocations }: OtherLocationsSectionProps) {
  const t = useTranslation();
  if (!otherLocations.length) return null;

  return (
    <View className="mt-10 pb-4">
      <Text className="text-[10px] font-bold text-primary uppercase tracking-widest px-8 mb-1">
        {t.place.moreFrom}
      </Text>
      <Text
        className="text-2xl text-navy px-8 mb-6"
        style={{ fontFamily: 'PlayfairDisplay_400Regular' }}
        numberOfLines={1}
      >
        {brandName}
      </Text>
      <FlatList
        horizontal
        data={otherLocations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OtherLocationCard location={item} />}
        getItemLayout={(_, index) => ({ length: CARD_WIDTH + 12, offset: (CARD_WIDTH + 12) * index, index })}
        contentContainerStyle={{ paddingHorizontal: 32 }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}
