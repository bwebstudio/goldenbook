import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSaved } from '@/features/saved/hooks/useSaved';
import { SavedPlaceCard, SavedRouteCard } from '@/features/saved/components';
import { useTranslation } from '@/i18n';
import { colors, typography, spacing, radius } from '@/design/tokens';

type Tab = 'places' | 'routes';

// ─── Empty states ─────────────────────────────────────────────────────────────

function PlacesEmptyState() {
  const t = useTranslation();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyOrnamentRow}>
        <View style={styles.emptyOrnamentLine} />
        <Ionicons name="heart-outline" size={18} color={`${colors.primary}70`} />
        <View style={styles.emptyOrnamentLine} />
      </View>
      <Text style={styles.emptyTitle}>{t.saved.noSavedPlaces}</Text>
      <Text style={styles.emptySubtitle}>{t.saved.noSavedPlacesSub}</Text>
    </View>
  );
}

function RoutesEmptyState() {
  const t = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyOrnamentRow}>
        <View style={styles.emptyOrnamentLine} />
        <Ionicons name="navigate-outline" size={18} color={`${colors.primary}70`} />
        <View style={styles.emptyOrnamentLine} />
      </View>
      <Text style={styles.emptyTitle}>{t.saved.noSavedRoutes}</Text>
      <Text style={styles.emptySubtitle}>{t.saved.noSavedRoutesSub}</Text>
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/routes')}
        activeOpacity={0.8}
        style={styles.emptyBtn}
      >
        <Text style={styles.emptyBtnText}>{t.saved.exploreRoutes}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const t = useTranslation();
  const router = useRouter();

  // Accept `tab` param from Profile → Saved Routes navigation
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('places');

  // Switch to Routes tab if navigated with tab=routes param
  useEffect(() => {
    if (tabParam === 'routes') setActiveTab('routes');
  }, [tabParam]);

  const { data, isLoading, isError, refetch } = useSaved();

  const savedPlaces = data?.savedPlaces ?? [];
  const savedRoutes = data?.savedRoutes ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.label}>Goldenbook Go</Text>
        <Text style={styles.title}>{t.saved.title}</Text>
      </View>

      {/* ── Tab switcher ── */}
      <View style={styles.tabs}>
        <TouchableOpacity
          onPress={() => setActiveTab('places')}
          activeOpacity={0.8}
          style={[styles.tab, activeTab === 'places' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'places' && styles.tabTextActive]}>
            {t.saved.places}{savedPlaces.length > 0 ? ` (${savedPlaces.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('routes')}
          activeOpacity={0.8}
          style={[styles.tab, activeTab === 'routes' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'routes' && styles.tabTextActive]}>
            {t.saved.routes}{savedRoutes.length > 0 ? ` (${savedRoutes.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t.saved.couldNotLoad}</Text>
          <TouchableOpacity onPress={() => refetch()} activeOpacity={0.8} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t.saved.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {activeTab === 'places' ? (
            savedPlaces.length === 0 ? (
              <PlacesEmptyState />
            ) : (
              savedPlaces.map((place) => <SavedPlaceCard key={place.id} place={place} />)
            )
          ) : savedRoutes.length === 0 ? (
            <RoutesEmptyState />
          ) : (
            savedRoutes.map((route) => <SavedRouteCard key={route.id} route={route} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ivory.DEFAULT,
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.base,
  },
  label: {
    fontSize: typography.label,
    fontWeight: typography.bold,
    color: colors.primary,
    letterSpacing: typography.widest,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.serifBold,
    fontSize: typography.display,
    color: colors.navy.DEFAULT,
    letterSpacing: typography.tight,
  },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.base,
    marginTop: spacing.base,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radius.full,
  },
  tabActive: {
    backgroundColor: colors.navy.DEFAULT,
  },
  tabText: {
    fontSize: typography.caption,
    fontWeight: typography.bold,
    color: `${colors.navy.DEFAULT}40`,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: colors.ivory.DEFAULT,
  },

  divider: {
    height: 1,
    backgroundColor: `${colors.navy.DEFAULT}07`,
    marginTop: spacing.base,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: `${colors.navy.DEFAULT}40`,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.navy.DEFAULT,
  },
  retryText: {
    fontSize: typography.caption,
    fontWeight: typography.bold,
    color: colors.ivory.DEFAULT,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
  },

  // ── Empty states ──
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxxl + spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.base,
  },
  emptyOrnamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '60%',
    marginBottom: spacing.sm,
  },
  emptyOrnamentLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: `${colors.primary}40`,
  },
  emptyTitle: {
    fontFamily: typography.serifBold,
    fontSize: typography.subtitle,
    color: `${colors.navy.DEFAULT}55`,
    textAlign: 'center',
    letterSpacing: typography.tight,
  },
  emptySubtitle: {
    fontSize: typography.bodySmall,
    fontFamily: typography.sansLight,
    color: `${colors.navy.DEFAULT}38`,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  emptyBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.navy.DEFAULT,
  },
  emptyBtnText: {
    fontSize: typography.caption,
    fontFamily: typography.sansSemibold,
    color: colors.ivory.DEFAULT,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
  },
});
