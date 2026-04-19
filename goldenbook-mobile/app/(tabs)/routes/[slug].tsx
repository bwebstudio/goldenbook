import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import { useRouteDetail } from '@/features/routes/hooks/useRouteDetail';
import { useSaveRoute } from '@/features/saved/hooks/useSaveRoute';
import { RouteHero, RoutePlacesTimeline } from '@/features/routes/components';
import { track } from '@/analytics/track';

export default function RouteDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const t = useTranslation();
  const { data, isLoading, isError } = useRouteDetail(slug ?? '');
  const { isSaved, toggle: toggleSave, isPending } = useSaveRoute(data?.id ?? '', {
    snapshot: data
      ? {
          id: data.id,
          slug: data.slug,
          title: data.title,
          summary: data.summary,
          image:
            data.heroImage?.bucket && data.heroImage?.path
              ? { bucket: data.heroImage.bucket, path: data.heroImage.path }
              : null,
        }
      : undefined,
  });

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
          Could not load this route.{'\n'}Check your connection and try again.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-ivory">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* 1. Hero: image + title + summary + meta */}
        <RouteHero
          heroImage={data.heroImage}
          title={data.title}
          summary={data.summary}
          cityName={data.city.name}
          placesCount={data.places.length}
          estimatedMinutes={data.estimatedMinutes}
        />

        {/* 2. Body text if present */}
        {data.body && (
          <View className="px-5 pt-5 pb-2">
            <Text className="text-sm text-navy/60 leading-relaxed">{data.body}</Text>
          </View>
        )}

        {/* Divider */}
        <View className="h-px bg-navy/5 mx-5 mt-5 mb-3" />

        {/* 4. Route places timeline */}
        <RoutePlacesTimeline places={data.places} />
      </ScrollView>

      {/* 5. Bottom bar — Start Route + Save */}
      <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0 bg-ivory/96">
        <View className="px-5 py-3 flex-row gap-3">
          {/* Start Route — grows to fill available space */}
          <TouchableOpacity
            className="flex-1 rounded-xl py-4 items-center justify-center flex-row gap-2"
            style={{ backgroundColor: '#222D52' }}
            activeOpacity={0.85}
            onPress={() => {
              if (data?.id) {
                track('route_start', {
                  routeId: data.id,
                  metadata: { step_count: data.places?.length ?? 0 },
                });
              }
              router.push(`/journey/${slug}`);
            }}
          >
            <Text className="text-primary text-[11px] uppercase tracking-widest font-bold">
              {t.routes.startRoute}
            </Text>
            <Text className="text-primary text-sm font-bold">→</Text>
          </TouchableOpacity>

          {/* Save / unsave */}
          <TouchableOpacity
            onPress={toggleSave}
            disabled={isPending}
            activeOpacity={0.6}
            className="rounded-xl items-center justify-center"
            style={{
              width: 56,
              backgroundColor: isSaved ? '#222D52' : '#FDFDFB',
              borderWidth: 1,
              borderColor: isSaved ? '#222D52' : 'rgba(34,45,82,0.10)',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={isSaved ? '#D2B68A' : '#222D52'}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
