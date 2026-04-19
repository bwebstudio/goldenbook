import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiscover } from '@/features/discover/hooks/useDiscover';
import { useTranslation } from '@/i18n';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import { track } from '@/analytics/track';
import type { DiscoverPlaceCard } from '@/types/api';

// ─── Featured hero card (16:9 ratio, gradient overlay, editorial style) ────────

function FeaturedPickCard({ place }: { place: DiscoverPlaceCard }) {
  const router = useRouter();
  const imageUri = getStorageUrl(place.heroImage.bucket, place.heroImage.path);

  return (
    <TouchableOpacity
      onPress={() => {
        track('place_open', { placeId: place.id, source: 'discover' });
        router.push(`/places/${place.slug}` as any);
      }}
      activeOpacity={0.9}
      className="mx-6 mb-4 rounded-2xl overflow-hidden"
      style={styles.featuredCard}
    >
      <ProgressiveImage uri={imageUri} aspectRatio={16 / 9} borderRadius={16} />

      <LinearGradient
        colors={['transparent', 'rgba(34,45,82,0.85)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.4 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      <View className="absolute bottom-0 left-0 right-0 p-5">
        <Text
          className="text-ivory/90 font-bold leading-snug mb-1"
          style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20 }}
          numberOfLines={2}
        >
          {place.name}
        </Text>
        {place.shortDescription ? (
          <Text className="text-ivory/60 text-xs leading-relaxed" numberOfLines={2}>
            {place.shortDescription}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Grid card (4:3 image + text below, 2-column) ─────────────────────────────

function PickGridCard({ place }: { place: DiscoverPlaceCard }) {
  const router = useRouter();
  const imageUri = getStorageUrl(place.heroImage.bucket, place.heroImage.path);

  return (
    <TouchableOpacity
      onPress={() => {
        track('place_open', { placeId: place.id, source: 'discover' });
        router.push(`/places/${place.slug}` as any);
      }}
      activeOpacity={0.85}
      style={[styles.gridCard, { flex: 1 }]}
      className="rounded-xl overflow-hidden bg-ivory"
    >
      <ProgressiveImage uri={imageUri} aspectRatio={4 / 3} borderRadius={12} />

      <View className="p-3">
        <Text
          className="text-navy font-bold text-sm leading-snug"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          numberOfLines={2}
        >
          {place.name}
        </Text>
        {place.shortDescription ? (
          <Text className="text-navy/50 text-xs mt-1 leading-relaxed" numberOfLines={2}>
            {place.shortDescription}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── 2-column grid ─────────────────────────────────────────────────────────────

function PickGrid({ places, title }: { places: DiscoverPlaceCard[]; title: string }) {
  if (!places.length) return null;

  const rows: DiscoverPlaceCard[][] = [];
  for (let i = 0; i < places.length; i += 2) {
    rows.push(places.slice(i, i + 2));
  }

  return (
    <View className="px-6">
      <Text className="text-[10px] uppercase tracking-widest text-navy/40 font-bold mb-4">
        {title}
      </Text>
      <View className="gap-3">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row gap-3">
            {row.map((place) => (
              <PickGridCard key={place.id} place={place} />
            ))}
            {/* Fill the empty slot when there's an odd number of items */}
            {row.length === 1 && <View style={{ flex: 1 }} />}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function GoldenPicksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const { data, isLoading, isError } = useDiscover();

  if (isLoading) {
    return (
      <View className="flex-1 bg-ivory items-center justify-center">
        <ActivityIndicator size="large" color="#D2B68A" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View className="flex-1 bg-ivory items-center justify-center px-8">
        <Text className="text-navy/40 text-center text-sm leading-relaxed">
          {t.goldenPicks.couldNotLoad}
        </Text>
      </View>
    );
  }

  const picks = data.editorsPicks;
  const featuredPick = picks[0] ?? null;
  const restPicks = picks.slice(1);
  const hasItems = picks.length > 0;

  return (
    <View className="flex-1 bg-ivory">
      {/* Top bar — mirrors CategoryHeader exactly */}
      <View
        className="bg-ivory flex-row items-center px-5 pb-4 border-b border-navy/5"
        style={{ paddingTop: insets.top + 8 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="mr-3 p-1"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#222D52" />
        </TouchableOpacity>

        <View className="flex-1">
          <Text className="text-navy font-bold text-base leading-tight" numberOfLines={1}>
            {t.goldenPicks.title}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Intro — mirrors CategoryIntro exactly */}
        <View className="px-6 pt-8 pb-6">
          <Text
            className="text-navy font-bold leading-tight mb-3"
            style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 32 }}
          >
            {t.goldenPicks.title}
          </Text>

          <Text className="text-navy/60 text-sm leading-relaxed mb-4">
            {t.goldenPicks.curatedBy}
          </Text>

          {picks.length > 0 && (
            <View className="flex-row items-center gap-1.5">
              <View className="w-1 h-1 rounded-full bg-primary" />
              <Text className="text-[10px] uppercase tracking-widest text-primary font-bold">
                {picks.length} {picks.length === 1 ? t.category.place : t.category.places}
              </Text>
            </View>
          )}
        </View>

        {!hasItems ? (
          /* Empty state — mirrors EmptyCategoryState */
          <View className="items-center justify-center px-10 py-20">
            <Text className="text-2xl mb-4">✦</Text>
            <Text
              className="text-navy font-bold text-lg text-center mb-2"
              style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
            >
              {t.category.nothingHereYet}
            </Text>
            <Text className="text-navy/40 text-sm text-center leading-relaxed">
              {t.category.stillCurating}
            </Text>
          </View>
        ) : (
          <>
            {/* Featured item */}
            {featuredPick && (
              <View className="mb-6">
                <Text className="text-[10px] uppercase tracking-widest text-navy/40 font-bold px-6 mb-4">
                  {t.goldenPicks.featured}
                </Text>
                <FeaturedPickCard place={featuredPick} />
              </View>
            )}

            {/* Divider */}
            {restPicks.length > 0 && (
              <View className="h-px bg-navy/5 mx-6 mb-6" />
            )}

            {/* All picks — 2-column grid */}
            {restPicks.length > 0 && (
              <View className="mb-8">
                <PickGrid places={restPicks} title={t.goldenPicks.allPicks} />
              </View>
            )}
          </>
        )}

        {/* View on map CTA — mirrors CategoryScreen */}
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

const styles = StyleSheet.create({
  featuredCard: {
    shadowColor: '#222D52',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  gridCard: {
    shadowColor: '#222D52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
});
