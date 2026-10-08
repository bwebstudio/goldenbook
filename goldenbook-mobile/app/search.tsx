import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/appStore';
import { useSearch } from '@/features/search/hooks/useSearch';
import { useTranslation } from '@/i18n';
import { track } from '@/analytics/track';
import {
  SearchSectionLabel,
  SearchPlaceRow,
  SearchRouteRow,
  SearchCategoryRow,
} from '@/features/search/components';
import { getLocalityBySlug } from '@/config/localities';
import type {
  SearchPlaceDTO,
  SearchRouteDTO,
  SearchCategoryDTO,
  SearchElsewherePlaceDTO,
} from '@/features/search/types';

type ResultRow =
  | { kind: 'place'; key: string; place: SearchPlaceDTO }
  | { kind: 'route'; key: string; route: SearchRouteDTO }
  | { kind: 'category'; key: string; category: SearchCategoryDTO }
  | { kind: 'elsewhere'; key: string; place: SearchElsewherePlaceDTO };

interface ResultSection {
  key: string;
  title: string;
  /** Vertical space between rows, matching the old `gap-*` per section. */
  gap: number;
  data: ResultRow[];
}

function renderRow(row: ResultRow) {
  switch (row.kind) {
    case 'place':
      return <SearchPlaceRow place={row.place} />;
    case 'route':
      return <SearchRouteRow route={row.route} />;
    case 'category':
      return <SearchCategoryRow category={row.category} />;
    case 'elsewhere':
      return <SearchPlaceRow place={row.place} city={row.place.city} />;
  }
}

// Shortest query worth recording. Below this the search API returns nothing
// useful, so logging it would only manufacture zero-result rows. Keep in sync
// with MIN_QUERY_LEN in the backend's analytics ingest.
const MIN_SEARCH_LEN = 3;

export default function SearchScreen() {
  const router = useRouter();
  const t = useTranslation();
  const city = useAppStore((s) => s.selectedCity);

  const inputRef = useRef<TextInput>(null);
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');

  // Debounce: commit query 350ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setQuery(inputValue.trim()), 350);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Auto-focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const { data, isLoading, isFetching, isSuccess } = useSearch(query, city);

  // Log one row per search the user actually finished.
  //
  // The previous version fired on every debounced keystroke and again when the
  // response arrived, reading the result count before it existed. That turned
  // one search into a handful of rows and reported 91% of them as "no results",
  // which was an artefact, not a content gap.
  //
  // Now: wait until the query has settled (results resolved, not refetching),
  // log it once, and when the next query extends the one we just logged
  // ("algar" then "algarve") tell the server to retire the shorter row.
  const loggedQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (query.length < MIN_SEARCH_LEN) return;
    // isSuccess && !isFetching means `data` belongs to THIS query, not the
    // previous one. useSearch keeps no placeholder data, so there is no window
    // where a stale count could be attributed to a new query.
    if (!isSuccess || isFetching) return;
    if (loggedQueryRef.current === query) return;

    const previous = loggedQueryRef.current;
    loggedQueryRef.current = query;

    const resultCount =
      (data?.places?.length ?? 0) +
      (data?.routes?.length ?? 0) +
      (data?.categories?.length ?? 0);
    const elsewhereCount = data?.elsewhere?.length ?? 0;

    // A refinement is the same search continued, not a new one.
    const refines =
      previous && previous.length < query.length && query.toLowerCase().startsWith(previous.toLowerCase())
        ? previous
        : undefined;

    track('search_query', {
      metadata: {
        query: query.slice(0, 80),
        result_count: resultCount,
        city,
        ...(elsewhereCount > 0 ? { elsewhere_count: elsewhereCount } : {}),
        ...(refines ? { supersedes: refines.slice(0, 80) } : {}),
      },
    });
  }, [query, isSuccess, isFetching, data, city]);

  const hasLocalResults =
    !!data &&
    ((data.places?.length ?? 0) > 0 ||
      (data.routes?.length ?? 0) > 0 ||
      (data.categories?.length ?? 0) > 0);
  const hasElsewhere = (data?.elsewhere?.length ?? 0) > 0;
  const hasResults = hasLocalResults || hasElsewhere;
  const isActive = query.length >= 2;
  const isEmpty = isActive && !isLoading && !hasResults;
  const cityName = getLocalityBySlug(city)?.name ?? city;

  const sections = useMemo<ResultSection[]>(() => {
    if (!data) return [];
    const out: ResultSection[] = [];
    if (data.places?.length) {
      out.push({
        key: 'places',
        title: t.search.places,
        gap: 20,
        data: data.places.map((place) => ({ kind: 'place', key: place.id, place })),
      });
    }
    if (data.routes?.length) {
      out.push({
        key: 'routes',
        title: t.search.routes,
        gap: 12,
        data: data.routes.map((route) => ({ kind: 'route', key: route.id, route })),
      });
    }
    if (data.categories?.length) {
      out.push({
        key: 'categories',
        title: t.search.categories,
        gap: 0,
        data: data.categories.map((category) => ({ kind: 'category', key: category.id, category })),
      });
    }
    // Matches in other destinations always come last, after everything
    // local. Older backends don't send `elsewhere` at all.
    if (data.elsewhere?.length) {
      out.push({
        key: 'elsewhere',
        title: t.search.elsewhere,
        gap: 20,
        data: data.elsewhere.map((place) => ({
          kind: 'elsewhere',
          key: `${place.city.slug}:${place.id}`,
          place,
        })),
      });
    }
    return out;
  }, [data, t]);

  return (
    <SafeAreaView className="flex-1 bg-ivory" edges={['top', 'bottom']}>
      {/* ── Header ────────────────────────────────────────────── */}
      <View className="flex-row items-center px-6 pt-2 pb-4 gap-4">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t.common.goBack}
        >
          <Ionicons name="arrow-back" size={22} color="#222D52" />
        </TouchableOpacity>

        <View
          className="flex-1 flex-row items-center bg-white border border-navy/5 rounded-xl px-4 h-11 gap-3"
          style={{
            shadowColor: '#222D52',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <Ionicons name="search" size={17} color="#D2B68A" />
          <TextInput
            ref={inputRef}
            className="flex-1 text-sm text-navy"
            placeholder={t.search.placeholder}
            placeholderTextColor="rgba(34,45,82,0.35)"
            value={inputValue}
            onChangeText={setInputValue}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {inputValue.length > 0 && (
            <TouchableOpacity
              onPress={() => setInputValue('')}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              accessibilityRole="button"
              accessibilityLabel={t.a11y.clearSearch}
            >
              <Ionicons name="close-circle" size={16} color="rgba(34,45,82,0.28)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Idle state ─────────────────────────────────────────── */}
      {!isActive && (
        <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: 80 }}>
          <View
            className="w-16 h-16 rounded-full bg-ivory-soft items-center justify-center mb-6"
            style={{
              shadowColor: '#222D52',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 1,
            }}
          >
            <Ionicons name="search-outline" size={26} color="#D2B68A" />
          </View>
          <Text
            className="text-2xl font-bold text-navy text-center leading-tight"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            {t.search.headline}
          </Text>
          <Text className="text-navy/40 text-sm text-center mt-3 leading-relaxed">
            {t.search.subtext}
          </Text>
        </View>
      )}

      {/* ── Loading ─────────────────────────────────────────────── */}
      {isActive && isLoading && (
        <View className="flex-1 items-center justify-center" style={{ paddingBottom: 80 }}>
          <ActivityIndicator color="#D2B68A" size="large" />
        </View>
      )}

      {/* ── Empty results ───────────────────────────────────────── */}
      {isEmpty && (
        <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: 80 }}>
          <Ionicons name="search-outline" size={28} color="rgba(34,45,82,0.12)" />
          <Text className="text-navy/40 text-sm text-center mt-4">
            {t.search.noResults}{' '}
            <Text className="font-semibold text-navy/60">"{query}"</Text>
          </Text>
          <Text className="text-navy/30 text-xs text-center mt-2">
            {t.search.noResultsTip}
          </Text>
        </View>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      {isActive && !isLoading && hasResults && (
        <SectionList
          sections={sections}
          keyExtractor={(row) => `${row.kind}:${row.key}`}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 4 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            !hasLocalResults ? (
              <Text className="text-navy/40 text-sm px-6 mb-6 leading-relaxed">
                {t.search.noResultsInCity.replace('{city}', cityName)}
              </Text>
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <SearchSectionLabel label={section.title} count={section.data.length} />
          )}
          renderSectionFooter={() => <View className="mb-8" />}
          renderItem={({ item, index, section }) => (
            <View className="px-6" style={index > 0 ? { marginTop: section.gap } : undefined}>
              {renderRow(item)}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}