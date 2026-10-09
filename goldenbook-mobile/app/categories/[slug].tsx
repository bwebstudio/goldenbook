import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
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
  const { data, isLoading, isError } = useCategory(slug ?? '');
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
    const message = isOffline ? t.offline.placesNeedInternet : t.category.couldNotLoad;
    return (
      <SafeAreaView className="flex-1 bg-ivory">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-navy/40 text-center text-sm leading-relaxed">
            {message}
          </Text>
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

      <CategoryPlaceGrid
        places={rest}
        title={`${t.category.allIn} ${data.name}`}
        contentContainerStyle={{ paddingBottom: 48 }}
        header={
          <>
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
              </>
            )}
          </>
        }
        footer={
          // `mb-8` used to sit under the grid; keep that space above the CTA.
          <View style={{ marginTop: rest.length > 0 ? 32 : 0 }}>
            {/* CTA: View on map */}
            {hasItems && (
              <View className="px-6 mt-2">
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/map?src=category' as any)}
                  className="flex-row items-center justify-center gap-2 border border-navy/15 rounded-full py-3.5"
                >
                  <Ionicons name="map-outline" size={16} color="#222D52" />
                  <Text className="text-navy font-bold text-sm tracking-wide">
                    {t.category.viewOnMap}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}
