import { useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '@/i18n';
import { usePlaceDetail } from '@/features/place-detail/hooks/usePlaceDetail';
import { useSavePlace } from '@/features/saved/hooks/useSavePlace';
import { sharePlace } from '@/features/place-detail/share';
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
  const router = useRouter();
  const t = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } = usePlaceDetail(slug ?? '');
  const { isSaved, toggle: toggleSave, isPending: isSaving } = useSavePlace(data?.id ?? '', {
    snapshot: data
      ? {
          id: data.id,
          slug: data.slug,
          name: data.name,
          shortDescription: data.shortDescription,
          image: data.heroImage?.bucket && data.heroImage?.path
            ? { bucket: data.heroImage.bucket, path: data.heroImage.path }
            : null,
        }
      : undefined,
  });

  const handleShare = useCallback(() => {
    if (!data) return;
    void sharePlace({
      name: data.name,
      slug: data.slug,
      cityName: data.city?.name,
      shortDescription: data.shortDescription,
    });
  }, [data]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-ivory items-center justify-center">
        <ActivityIndicator size="large" color="#D2B68A" />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    const handleBack = () => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)' as any);
    };
    return (
      <SafeAreaView className="flex-1 bg-ivory items-center justify-center px-8">
        <Text className="text-navy/40 text-center text-sm mb-6">
          {t.place.couldNotLoad}
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="items-center justify-center rounded-full border border-navy/15 px-6"
            style={{ height: 44, minWidth: 120 }}
          >
            <Text className="text-navy text-xs font-bold uppercase tracking-widest">
              {t.common.goBack}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { void refetch(); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            disabled={isFetching}
            className="items-center justify-center rounded-full bg-navy px-6"
            style={{ height: 44, minWidth: 120, opacity: isFetching ? 0.6 : 1 }}
          >
            <Text className="text-ivory text-xs font-bold uppercase tracking-widest">
              {t.common.retry}
            </Text>
          </TouchableOpacity>
        </View>
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
          onShare={handleShare}
        />

        {/* 3. Actions: reserve / map / save / website */}
        <PlaceActions
          placeId={data.id}
          actions={data.actions}
          booking={data.booking}
          location={data.location}
          city={data.city.slug}
          isSaved={isSaved}
          isSaving={isSaving}
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