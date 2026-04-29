import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoutes } from '@/features/routes/hooks/useRoutes';
import { RouteCard } from '@/features/routes/components';
import { useTranslation } from '@/i18n';
import { useNetworkStore, selectIsOffline } from '@/store/networkStore';
import { CachedDataHint } from '@/components/CachedDataHint';

export default function RoutesScreen() {
  const { data, isLoading, isError, refetch } = useRoutes();
  const t = useTranslation();
  const isOffline = useNetworkStore(selectIsOffline);

  // Featured = first item with featured flag, fallback to first item
  const featuredRoute = data?.items.find((r) => r.featured) ?? data?.items[0];
  const otherRoutes = data?.items.filter((r) => r.id !== featuredRoute?.id) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-ivory" edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Editorial header */}
        <View className="px-6 pt-8 pb-4">
          <Text className="text-[10px] uppercase tracking-widest font-bold text-primary mb-2">
            Goldenbook Go
          </Text>
          <Text
            className="text-3xl font-bold text-navy tracking-tight"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            {t.routes.title}
          </Text>
          <Text className="text-sm text-navy/45 mt-2 italic font-light">
            {t.routes.subtitle}
          </Text>
        </View>

        {/* Divider */}
        <View className="h-px bg-navy/5 mx-6 mb-6" />

        {/* Per-screen cue when the routes list came from disk while
            offline. The global OfflineBanner sits on top of the app — this
            tells the user the rail below is the saved copy. */}
        <CachedDataHint cached={isOffline && !!data} />

        {/* Loading */}
        {isLoading && (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#D2B68A" />
          </View>
        )}

        {/* Error
            Three-way split for the message:
              • offline + no cache → "open Routes once online and we'll
                save them" — known state, no retry surface.
              • online + error    → generic "couldn't load routes".
              • offline + cache   → never reached: persisted data short-
                circuits the error path. */}
        {isError && !data && (
          <View className="items-center justify-center py-20 px-8">
            <Text className="text-navy/40 text-center text-sm mb-5">
              {isOffline ? t.offline.routesNeedInternet : t.routes.couldNotLoad}
            </Text>
            {!isOffline && (
              <TouchableOpacity
                onPress={() => refetch()}
                activeOpacity={0.85}
                className="bg-primary rounded-lg px-6 py-3"
              >
                <Text className="text-navy text-xs uppercase tracking-widest font-bold">
                  {t.common.retry}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Empty */}
        {data && data.items.length === 0 && (
          <View className="items-center justify-center py-20 px-8">
            <Text className="text-navy/40 text-center text-sm italic">
              {t.routes.noRoutesYet}
            </Text>
          </View>
        )}

        {/* Featured route */}
        {featuredRoute && (
          <>
            <Text className="text-[10px] font-bold tracking-widest uppercase text-primary px-6 mb-4">
              {t.routes.goldenPick}
            </Text>
            <RouteCard route={featuredRoute} featured />
          </>
        )}

        {/* Other routes */}
        {otherRoutes.length > 0 && (
          <>
            {/* Section divider */}
            <View className="flex-row items-center px-6 mb-5 mt-1">
              <View className="flex-1 h-px bg-navy/8" />
              <Text className="text-[10px] font-bold tracking-widest uppercase text-navy/30 mx-4">
                {t.routes.moreRoutes}
              </Text>
              <View className="flex-1 h-px bg-navy/8" />
            </View>

            {otherRoutes.map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}