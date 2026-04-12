import { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDiscover } from '@/features/discover/hooks/useDiscover';
import {
  DiscoverHeader,
  DiscoverSearchBar,
  NowRecommendationSection,
  SectionHeader,
  PlaceCard,
  CategoryPills,
  RouteCard,
  HiddenGemsGate,
} from '@/features/discover/components';
import { LocalitySwitcher } from '@/components/locality/LocalitySwitcher';
import { GoldenMenu } from '@/components/GoldenMenu';
import { useTranslation } from '@/i18n';

export default function DiscoverScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useDiscover();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useTranslation();

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
          {t.discover.couldNotLoad}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          activeOpacity={0.85}
          className="bg-primary rounded-lg px-6 py-3"
        >
          <Text className="text-navy text-xs uppercase tracking-widest font-bold">
            {t.common.retry}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ivory" edges={['top']}>
      <FlatList
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 56 }}
        // Render everything as a single-item list so nested FlatLists
        // (horizontal scrollers) don't conflict with a ScrollView parent.
        data={[1]}
        keyExtractor={() => 'discover-screen'}
        renderItem={() => (
          <View>
            {/* 1. City header — city tap opens locality switcher, menu tap opens GoldenMenu */}
            <DiscoverHeader
              cityName={data.cityHeader.name}
              country={data.cityHeader.country}
              onCityPress={() => setSwitcherOpen(true)}
              onMenuPress={() => setMenuOpen(true)}
            />

            {/* 2. Search */}
            <DiscoverSearchBar placeholder={data.search.placeholder} />

            {/* 3. NOW — contextual recommendation (monetizable) */}
            <View>
              <SectionHeader title={t.discover.whatShouldIExperience} />
              <NowRecommendationSection
                cityName={data.cityHeader.name}
              />
            </View>

            {/* 4. Golden Picks — premium placements (monetizable) */}
            {data.editorsPicks.length > 0 && (
              <View>
                <SectionHeader title={t.discover.goldenPicks} onSeeAll={() => router.push('/golden-picks')} />
                <FlatList
                  horizontal
                  data={data.editorsPicks}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <PlaceCard place={item} variant="editorial" width={224} />
                  )}
                  contentContainerStyle={{ paddingHorizontal: 24 }}
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            )}

            {/* 5. Hidden Gems — discovery placements (monetizable) */}
            <View>
              <SectionHeader title={t.discover.hiddenSpotsNearYou} />
              <HiddenGemsGate
                nearbyCount={data.hiddenSpotsNearYou.length}
                cityName={data.cityHeader.name}
                editorialFallback={
                  data.hiddenSpotsNearYou.length > 0 ? (
                    <View className="px-6 gap-5">
                      {data.hiddenSpotsNearYou.slice(0, 3).map((place) => (
                        <PlaceCard key={place.id} place={place} variant="horizontal" />
                      ))}
                    </View>
                  ) : undefined
                }
              >
                <View className="px-6 gap-5">
                  {data.hiddenSpotsNearYou.slice(0, 3).map((place) => (
                    <PlaceCard key={place.id} place={place} variant="horizontal" />
                  ))}
                </View>
              </HiddenGemsGate>
            </View>

            {/* 6. New on Goldenbook */}
            {data.newOnGoldenbook.length > 0 && (
              <View>
                <SectionHeader title={t.discover.newOnGoldenbook} />
                <FlatList
                  horizontal
                  data={data.newOnGoldenbook}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <PlaceCard place={item} variant="editorial" width={200} />
                  )}
                  contentContainerStyle={{ paddingHorizontal: 24 }}
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            )}

            {/* 7. Explore by Category */}
            {data.categories.length > 0 && (
              <View>
                <SectionHeader title={t.discover.exploreByCategory} />
                <CategoryPills categories={data.categories} />
              </View>
            )}

            {/* 8. Golden Routes */}
            {data.goldenRoutes.length > 0 && (
              <View>
                <SectionHeader
                  title={t.discover.goldenRoutes}
                  onSeeAll={() => router.push('/(tabs)/routes' as any)}
                />
                {data.goldenRoutes.map((route) => (
                  <RouteCard key={route.id} route={route} />
                ))}
              </View>
            )}
          </View>
        )}
      />

      {/* Locality switcher — rendered outside FlatList so it overlays everything */}
      <LocalitySwitcher
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
      />

      {/* Golden Menu — right-side panel for secondary navigation */}
      <GoldenMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </SafeAreaView>
  );
}
