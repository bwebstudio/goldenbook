import {
  ActivityIndicator,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouteDetail } from '@/features/routes/hooks/useRouteDetail';
import { useJourney } from '@/features/journey/hooks/useJourney';
import { useTranslation } from '@/i18n';
import { openInMaps, formatStayTime } from '@/features/journey/utils';
import { JourneyCompletionView } from '@/features/journey/components/JourneyCompletionView';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import type { RouteDetailDTO, RoutePlaceDTO } from '@/features/routes/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.46;

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function JourneyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTranslation();
  const { data, isLoading, isError } = useRouteDetail(slug ?? '');
  const router = useRouter();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#D2B68A" />
      </SafeAreaView>
    );
  }

  if (isError || !data || data.places.length === 0) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: '#FDFDFB' }]}>
        <Text className="text-navy/40 text-center text-sm">
          {t.journey.couldNotLoad}
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary text-sm underline">{t.common.goBack}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <JourneyContent
      data={data}
      onBack={() => router.back()}
      onExploreMore={() => router.replace('/(tabs)/routes' as any)}
    />
  );
}

// ─── Journey content (receives resolved data) ─────────────────────────────────

function JourneyContent({
  data,
  onBack,
  onExploreMore,
}: {
  data: RouteDetailDTO;
  onBack: () => void;
  onExploreMore: () => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const sortedPlaces: RoutePlaceDTO[] = [...data.places].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const { state, handleArrived, handleContinue, handleSkip } =
    useJourney(sortedPlaces);

  // ── Completion view ────────────────────────────────────────────────────────
  if (state.journeyStatus === 'completed') {
    return (
      <JourneyCompletionView
        routeTitle={data.title}
        stepStatuses={state.stepStatuses}
        heroImage={data.heroImage}
        onExploreMore={onExploreMore}
      />
    );
  }

  // ── Active step ────────────────────────────────────────────────────────────
  const currentPlace = sortedPlaces[state.currentStepIndex];
  const currentStatus = state.stepStatuses[state.currentStepIndex];
  const isArrived = currentStatus === 'arrived';
  const isLastStop = state.currentStepIndex === sortedPlaces.length - 1;
  const nextPlace = isLastStop ? null : sortedPlaces[state.currentStepIndex + 1];

  const imageUrl = getStorageUrl(
    currentPlace.heroImage.bucket,
    currentPlace.heroImage.path,
  );

  const progressPct =
    ((state.currentStepIndex + 1) / sortedPlaces.length) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFB' }}>
      <StatusBar barStyle="light-content" />

      {/* ── Image section (fixed height) ─────────────────────────────────────── */}
      <View style={{ height: IMAGE_HEIGHT }}>
        <ProgressiveImage
          uri={imageUrl}
          height={IMAGE_HEIGHT}
          placeholderColor="#222D52"
          fadeDuration={500}
          style={StyleSheet.absoluteFillObject}
        />

        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(34,45,82,0.70)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Header */}
        <View style={[styles.header, { top: insets.top + 8 }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              className="text-white/55 text-[9px] tracking-widest uppercase font-bold"
              numberOfLines={1}
            >
              {data.title}
            </Text>
            <Text className="text-white text-xs mt-0.5">
              {t.journey.stop} {state.currentStepIndex + 1} {t.journey.of} {sortedPlaces.length}
            </Text>
          </View>

          <View style={{ width: 44 }} />
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { top: insets.top + 68 }]}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>

        {/* Place name — bottom of image */}
        <View style={styles.placeNameOverlay}>
          <Text
            className="text-white text-2xl font-bold leading-tight"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
            numberOfLines={2}
          >
            {currentPlace.name}
          </Text>
          {currentPlace.location.address && (
            <Text className="text-white/55 text-xs mt-1.5 font-light">
              {currentPlace.location.address}
            </Text>
          )}
        </View>
      </View>

      {/* ── Bottom card (fills rest of screen) ───────────────────────────────── */}
      <View style={[styles.card, { flex: 1, paddingBottom: insets.bottom + 12 }]}>
        {isArrived ? (
          <ArrivedCard
            place={currentPlace}
            isLast={isLastStop}
            nextName={nextPlace?.name ?? null}
            onContinue={handleContinue}
          />
        ) : (
          <ActiveCard
            place={currentPlace}
            onOpenMaps={() =>
              openInMaps(
                currentPlace.name,
                currentPlace.location.latitude,
                currentPlace.location.longitude,
                currentPlace.location.address,
              )
            }
            onArrived={handleArrived}
            onSkip={handleSkip}
          />
        )}
      </View>
    </View>
  );
}

// ─── Active card ─────────────────────────────────────────────────────────────

function ActiveCard({
  place,
  onOpenMaps,
  onArrived,
  onSkip,
}: {
  place: RoutePlaceDTO;
  onOpenMaps: () => void;
  onArrived: () => void;
  onSkip: () => void;
}) {
  const t = useTranslation();
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
      {place.note ? (
        <Text className="text-navy/60 text-sm leading-relaxed flex-1">
          {place.note}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={{ gap: 10 }}>
        {/* Open in Maps */}
        <TouchableOpacity
          style={styles.mapsBtn}
          activeOpacity={0.8}
          onPress={onOpenMaps}
        >
          <Ionicons name="map-outline" size={16} color="#D2B68A" />
          <Text className="text-primary text-[11px] tracking-widest uppercase font-bold">
            {t.journey.openInMaps}
          </Text>
        </TouchableOpacity>

        {/* I've Arrived */}
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={onArrived}
        >
          <Text className="text-ivory text-[11px] tracking-widest uppercase font-bold">
            {t.journey.iveArrived}
          </Text>
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity
          className="items-center py-2"
          activeOpacity={0.7}
          onPress={onSkip}
        >
          <Text className="text-navy/40 text-xs underline">{t.journey.skipThisStop}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Arrived card ─────────────────────────────────────────────────────────────

function ArrivedCard({
  place,
  isLast,
  nextName,
  onContinue,
}: {
  place: RoutePlaceDTO;
  isLast: boolean;
  nextName: string | null;
  onContinue: () => void;
}) {
  const t = useTranslation();
  const stayTime = formatStayTime(place.stayMinutes);

  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
      <Text className="text-primary text-2xl text-center mb-2">✦</Text>

      <Text
        className="text-navy text-xl font-bold text-center mb-2"
        style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
      >
        {t.journey.youveArrived}
      </Text>

      {place.note ? (
        <Text className="text-navy/55 text-sm leading-relaxed text-center">
          {place.note}
        </Text>
      ) : null}

      {stayTime ? (
        <Text className="text-primary text-xs text-center mt-2">
          {stayTime} {t.journey.suggestedHere}
        </Text>
      ) : null}

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={styles.primaryBtn}
        activeOpacity={0.85}
        onPress={onContinue}
      >
        <Text className="text-ivory text-[11px] tracking-widest uppercase font-bold">
          {isLast ? t.journey.finishRoute : `${t.journey.continueArrow} ${nextName ?? t.journey.nextStop}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222D52',
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  progressTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D2B68A',
    borderRadius: 1,
  },
  placeNameOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#FDFDFB',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  mapsBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#D2B68A',
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#222D52',
  },
});
