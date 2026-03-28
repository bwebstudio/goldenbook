import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/appStore';
import { useSearch } from '@/features/search/hooks/useSearch';
import { useTranslation } from '@/i18n';
import {
  SearchSectionLabel,
  SearchPlaceRow,
  SearchRouteRow,
  SearchCategoryRow,
} from '@/features/search/components';

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

  const { data, isLoading } = useSearch(query, city);

  const hasResults =
    data &&
    ((data.places?.length ?? 0) > 0 ||
      (data.routes?.length ?? 0) > 0 ||
      (data.categories?.length ?? 0) > 0);
  const isActive = query.length >= 2;
  const isEmpty = isActive && !isLoading && !hasResults;

  return (
    <SafeAreaView className="flex-1 bg-ivory" edges={['top', 'bottom']}>
      {/* ── Header ────────────────────────────────────────────── */}
      <View className="flex-row items-center px-6 pt-2 pb-4 gap-4">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 4 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* Places */}
          {(data.places?.length ?? 0) > 0 && (
            <View className="mb-8">
              <SearchSectionLabel label={t.search.places} count={data.places.length} />
              <View className="px-6 gap-5">
                {data.places.map((place) => (
                  <SearchPlaceRow key={place.id} place={place} />
                ))}
              </View>
            </View>
          )}

          {/* Routes */}
          {(data.routes?.length ?? 0) > 0 && (
            <View className="mb-8">
              <SearchSectionLabel label={t.search.routes} count={data.routes.length} />
              <View className="px-6 gap-3">
                {data.routes.map((route) => (
                  <SearchRouteRow key={route.id} route={route} />
                ))}
              </View>
            </View>
          )}

          {/* Categories */}
          {(data.categories?.length ?? 0) > 0 && (
            <View className="mb-8">
              <SearchSectionLabel label={t.search.categories} count={data.categories?.length} />
              <View className="px-6">
                {data.categories?.map((cat) => (
                  <SearchCategoryRow key={cat.id} category={cat} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}