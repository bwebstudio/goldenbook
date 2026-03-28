import { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDiscover } from '@/features/discover/hooks/useDiscover';
import {
  DiscoverHeader,
  DiscoverSearchBar,
  EditorialHeroCard,
  NowRecommendationSection,
  SectionHeader,
  PlaceCard,
  CategoryPills,
  RouteCard,
} from '@/features/discover/components';
import { LocalitySwitcher } from '@/components/locality/LocalitySwitcher';
import { GoldenMenu } from '@/components/GoldenMenu';
import { useTranslation } from '@/i18n';

export default function DiscoverScreen() {
  const router = useRouter();
  const { data, isLoading, isError } = useDiscover();
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
        <Text className="text-navy/40 text-center text-sm">
          {t.discover.couldNotLoad}
        </Text>
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

            {/* 3. What Should I Experience Now — contextual, time-aware concierge card */}
            {data.nowRecommendation && (
              <View>
                <SectionHeader title={t.discover.whatShouldIExperience} />
                <NowRecommendationSection
                  now={data.nowRecommendation}
                  cityName={data.cityHeader.name}
                />
              </View>
            )}

            {/* 4. Hidden Spots Near You — vertical list */}
            {data.hiddenSpotsNearYou.length > 0 && (
              <View>
                <SectionHeader title={t.discover.hiddenSpotsNearYou} onSeeAll={() => {}} />
                <View className="px-6 gap-5">
                  {data.hiddenSpotsNearYou.map((place) => (
                    <PlaceCard key={place.id} place={place} variant="horizontal" />
                  ))}
                </View>
              </View>
            )}

            {/* 5. Golden Picks — horizontal portrait cards */}
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

            {/* 6. Categories */}
            {data.categories.length > 0 && (
              <View>
                <SectionHeader title={t.discover.exploreByCategory} />
                <CategoryPills categories={data.categories} />
              </View>
            )}

            {/* 7. Golden Routes — dark navy cards */}
            {data.goldenRoutes.length > 0 && (
              <View>
                <SectionHeader title={t.discover.goldenRoutes} onSeeAll={() => {}} />
                {data.goldenRoutes.map((route) => (
                  <RouteCard key={route.id} route={route} />
                ))}
              </View>
            )}

            {/* 8. New on Goldenbook — horizontal portrait cards */}
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
