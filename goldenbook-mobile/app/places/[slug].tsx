import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlaceDetail } from '@/features/place-detail/hooks/usePlaceDetail';
import { useSavePlace } from '@/features/saved/hooks/useSavePlace';
import {
  PlaceHero,
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
  const { data, isLoading, isError } = usePlaceDetail(slug ?? '');
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
        <Text className="text-navy/40 text-center text-sm">
          Could not load this place.{'\n'}Check your connection and try again.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-ivory">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* 1. Hero image with name, city, rating overlay */}
        <PlaceHero
          heroImage={data.heroImage}
          name={data.name}
          cityName={data.city.name}
          rating={data.rating}
          tags={data.tags}
          categories={data.categories}
          subcategories={data.subcategories}
        />

        {/* 3. Actions: reserve / map / save / website */}
        <PlaceActions
          actions={data.actions}
          location={data.location}
          isSaved={isSaved}
          onSave={toggleSave}
        />

        {/* Divider */}
        <View className="h-px bg-navy/5 mx-5 mb-4" />

        {/* 4. Editorial sections: Goldenbook Perspective + Insider Tip
            Content source: data.goldenbookNote and data.insiderTip (backend / admin dashboard)
            Fallback: placeholder demo content shown when backend fields are null.
            See EditorialNoteSection for placeholder constants and TODO comments. */}
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

        {/* 11. Curated Nearby — always at the end */}
        <NearbyGemsSection nearbyGems={data.nearbyGems} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} className="bg-ivory" />
    </View>
  );
}