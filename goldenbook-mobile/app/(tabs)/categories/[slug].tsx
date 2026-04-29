import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCategory } from '@/features/categories/hooks/useCategory';
import { useTranslation } from '@/i18n';
import { useNetworkStore, selectIsOffline } from '@/store/networkStore';
import { CachedDataHint } from '@/components/CachedDataHint';
import {
  CategoryHeader,
  CategoryIntro,
  SubcategoryChips,
  FeaturedCategoryCard,
  CategoryPlaceGrid,
  EmptyCategoryState,
} from '@/features/categories/components';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const t = useTranslation();
  const { data, isLoading, isError, refetch } = useCategory(slug ?? '');
  const isOffline = useNetworkStore(selectIsOffline);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-ivory">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#D2B68A" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    // Three-way split for the message:
    //   • offline + no cache → "open this category once online and we'll
    //     keep a copy" — the user is in a known state, not a broken one.
    //   • online + error    → generic "couldn't load this category".
    //   • offline + cache   → never reached: persisted data short-circuits
    //     this branch and we render with a CachedDataHint instead.
    const message = isOffline ? t.offline.placesNeedInternet : t.category.couldNotLoad;
    return (
      <SafeAreaView className="flex-1 bg-ivory">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-navy/40 text-center text-sm leading-relaxed mb-5">
            {message}
          </Text>
          {/* Retry only makes sense when something other than connectivity
              broke. Offline taps would just re-fail. */}
          {!isOffline && (
            <TouchableOpacity
              onPress={() => refetch()}
              activeOpacity={0.85}
              className="bg-primary rounded-lg px-6 py-3 mb-3"
            >
              <Text className="text-navy text-xs uppercase tracking-widest font-bold">
                {t.common.retry}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text className="text-navy/30 text-xs tracking-wide">{t.common.goBack}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const items = Array.from(new Map(data.items.map(p => [p.id, p])).values());
  const featuredPlace = items[0] ?? null;
  const rest = items.filter(p => p.id !== featuredPlace?.id);
  const hasItems = items.length > 0;

  const filteredSubcategories = data.subcategories.filter((sub) =>
    items.some((place) => place.subcategory === sub.slug)
  );
  const showSubcategoryChips = filteredSubcategories.length > 1;

  return (
    <View className="flex-1 bg-ivory">
      <CategoryHeader title={data.name} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Per-screen cue when the data on screen came from disk while the
            device is offline. The global OfflineBanner already announces
            connectivity state at the app level — this hint tells the user
            *this list specifically* is the saved copy. */}
        <CachedDataHint cached={isOffline && !!data} />

        {/* Intro */}
        <CategoryIntro
          name={data.name}
          description={data.description}
          itemCount={items.length}
        />

        {/* Subcategory chips — only shown when 2+ subcategories have places */}
        {showSubcategoryChips && (
          <View className="mb-6">
            <SubcategoryChips subcategories={filteredSubcategories} />
          </View>
        )}

        {!hasItems ? (
          <EmptyCategoryState categoryName={data.name} />
        ) : (
          <>
            {/* Featured item */}
            {featuredPlace && (
              <View className="mb-6">
                <Text className="text-[10px] uppercase tracking-widest text-navy/40 font-bold px-6 mb-4">
                  {t.category.featured}
                </Text>
                <FeaturedCategoryCard key={featuredPlace.id} place={featuredPlace} />
              </View>
            )}

            {/* Divider */}
            {rest.length > 0 && (
              <View className="h-px bg-navy/5 mx-6 mb-6" />
            )}

            {/* All places grid */}
            {rest.length > 0 && (
              <View className="mb-8">
                <CategoryPlaceGrid
                  places={rest}
                  title={`${t.category.allIn} ${data.name}`}
                />
              </View>
            )}
          </>
        )}

        {/* CTA: View on map */}
        {hasItems && (
          <View className="px-6 mt-2">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/map')}
              className="flex-row items-center justify-center gap-2 border border-navy/15 rounded-full py-3.5"
            >
              <Ionicons name="map-outline" size={16} color="#222D52" />
              <Text className="text-navy font-bold text-sm tracking-wide">
                {t.category.viewOnMap}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
