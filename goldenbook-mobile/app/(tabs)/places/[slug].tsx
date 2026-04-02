import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlaceDetail } from '@/features/place-detail/hooks/usePlaceDetail';
import { useSavePlace } from '@/features/saved/hooks/useSavePlace';
import { useTranslation } from '@/i18n';
import {
  PlaceHero,
  PlaceHeader,
  PlaceActions,
  EditorialNoteSection,
  InfoSection,
  CategoriesRow,
  OpeningHoursSection,
  NearbyGemsSection,
  GallerySection,
  OtherLocationsSection,
} from '@/features/place-detail/components';

export default function PlaceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const t = useTranslation();
  const { data, isLoading, isError, refetch } = usePlaceDetail(slug ?? '');
  const { isSaved, toggle: toggleSave } = useSavePlace(data?.id ?? '');

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-ivory items-center justify-center">
        <ActivityIndicator size="large" color="#D2B68A" />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView className="flex-1 bg-ivory items-center justify-center px-8">
        <Text className="text-navy/40 text-center text-sm mb-5">
          {t.place.couldNotLoad}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          activeOpacity={0.85}
          className="bg-primary rounded-lg px-6 py-3 mb-3"
        >
          <Text className="text-navy text-xs uppercase tracking-widest font-bold">
            {t.common.retry}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text className="text-navy/30 text-xs tracking-wide">{t.common.goBack}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-ivory">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* 1. Hero image + back button */}
        <PlaceHero heroImage={data.heroImage} />

        {/* 2. Name + city + rating */}
        <PlaceHeader
          name={data.name}
          cityName={data.city.name}
          rating={data.rating}
          tags={data.tags}
        />

        {/* 3. Actions: reserve / map / save / website */}
        <PlaceActions
          placeId={data.id}
          actions={data.actions}
          booking={data.booking}
          location={data.location}
          city={data.city.slug}
          isSaved={isSaved}
          onSave={toggleSave}
        />

        {/* Divider */}
        <View className="h-px bg-navy/5 mx-5 mb-4" />

        {/* 4. Editorial sections */}
        <EditorialNoteSection
          goldenbookNote={data.goldenbookNote}
          insiderTip={data.insiderTip}
        />

        {/* 5. Gallery */}
        <GallerySection gallery={data.gallery} />

        {/* Divider */}
        <View className="h-px bg-navy/5 mx-5 mt-8 mb-4" />

        {/* 7. Description + contact + address */}
        <InfoSection
          shortDescription={data.shortDescription}
          fullDescription={data.fullDescription}
          contact={data.contact}
          location={data.location}
        />

        {/* 8. Categories + subcategories */}
        {(data.categories.length > 0 || data.subcategories.length > 0) && (
          <View className="mb-4">
            <CategoriesRow
              categories={data.categories}
              subcategories={data.subcategories}
            />
          </View>
        )}

        {/* Divider */}
        <View className="h-px bg-navy/5 mx-5 mb-4" />

        {/* 9. Opening hours */}
        <OpeningHoursSection openingHours={data.openingHours} />

        {/* 10. Other locations from the same brand */}
        {data.brand && (
          <OtherLocationsSection
            brandName={data.brand.name}
            otherLocations={data.otherLocations}
          />
        )}

        {/* 11. Curated Nearby */}
        <NearbyGemsSection nearbyGems={data.nearbyGems} />
      </ScrollView>
    </View>
  );
}
