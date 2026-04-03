/**
 * HiddenGemsGate.tsx
 *
 * Location-gated section for "Hidden Spots Near You" on the Discover screen.
 * Renders in-place within the existing section — never a modal or full-screen.
 *
 * States (derived from useLocationPermission → HiddenGemsMode):
 *
 *  pre_permission           → in-app pre-permission card
 *  loading                  → spinner while fetching position
 *  nearby_results           → renders children (the actual places)
 *  denied_fallback          → curated editorial fallback
 *  outside_coverage_fallback → outside Goldenbook regions
 *  no_results_fallback      → within coverage but no nearby places
 *  error_fallback           → geolocation error / timeout
 *
 * Permission is ONLY requested when user taps the primary CTA.
 */

import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocationPermission, type HiddenGemsMode } from '@/hooks/useLocationPermission';
import { useAppStore } from '@/store/appStore';
import { useTranslation } from '@/i18n';

interface HiddenGemsGateProps {
  /** Number of nearby places returned by the API (0 = no results). */
  nearbyCount: number;
  /** City name for the selected destination (shown in editorial fallback title). */
  cityName: string;
  /** Rendered when location is granted, within coverage, and places exist. */
  children: React.ReactNode;
  /** Editorial Hidden Gems for the selected destination (rendered when location denied). */
  editorialFallback?: React.ReactNode;
}

export function HiddenGemsGate({ nearbyCount, cityName, children, editorialFallback }: HiddenGemsGateProps) {
  const {
    hiddenGemsMode,
    requestPermission,
    dismiss,
    openSettings,
  } = useLocationPermission();
  const router = useRouter();
  const setCity = useAppStore((s) => s.setCity);
  const t = useTranslation();

  // Refine nearby_results → no_results_fallback when API returned 0 places
  const mode: HiddenGemsMode =
    hiddenGemsMode === 'nearby_results' && nearbyCount === 0
      ? 'no_results_fallback'
      : hiddenGemsMode;

  switch (mode) {
    // ── Loading position ──────────────────────────────────────────────────
    case 'loading':
      return (
        <View className="mx-6 py-10 items-center">
          <ActivityIndicator size="small" color="#D2B68A" />
        </View>
      );

    // ── Pre-permission card ───────────────────────────────────────────────
    case 'pre_permission':
      return (
        <GateCard
          icon="location-outline"
          title={t.location.discoverNearYouTitle}
          body={t.location.discoverNearYouBody}
          primaryLabel={t.location.useLocation}
          onPrimary={requestPermission}
          secondaryLabel={t.location.notNow}
          onSecondary={dismiss}
        />
      );

    // ── Denied or dismissed → show editorial Hidden Gems for selected destination
    case 'denied_fallback':
      // If we have editorial content for this destination, show it directly
      if (editorialFallback) return <>{editorialFallback}</>;
      return (
        <GateCard
          icon="compass-outline"
          title={t.location.exploreCuratedTitle}
          body={t.location.exploreCuratedBody}
          primaryLabel={t.location.browsePlaces}
          onPrimary={() => router.push('/(tabs)' as any)}
          secondaryLabel={t.location.useLocation}
          onSecondary={openSettings}
        />
      );

    // ── Outside coverage ──────────────────────────────────────────────────
    case 'outside_coverage_fallback':
      return (
        <GateCard
          icon="earth-outline"
          title={t.location.outsideRegionsTitle}
          body={t.location.outsideRegionsBody}
          primaryLabel={t.location.explorePortugal}
          onPrimary={() => {
            // Set destination to Lisboa (main Portugal destination) and stay on Discover
            setCity('lisboa');
            router.replace('/(tabs)' as any);
          }}
          secondaryLabel={t.location.changeDestination}
          onSecondary={() => router.push('/select-destination' as any)}
        />
      );

    // ── Within coverage but no nearby places ──────────────────────────────
    case 'no_results_fallback':
      return (
        <GateCard
          icon="map-outline"
          title={t.location.noPlacesNearbyTitle}
          body={t.location.noPlacesNearbyBody}
          primaryLabel={t.location.changeDestination}
          onPrimary={() => router.push('/select-destination' as any)}
          secondaryLabel={t.location.browsePlaces}
          onSecondary={() => router.push('/(tabs)' as any)}
        />
      );

    // ── Geolocation error / timeout ───────────────────────────────────────
    case 'error_fallback':
      return (
        <GateCard
          icon="alert-circle-outline"
          title={t.location.locationErrorTitle}
          body={t.location.locationErrorBody}
          primaryLabel={t.location.browsePlaces}
          onPrimary={() => router.push('/(tabs)' as any)}
          secondaryLabel={t.common.retry}
          onSecondary={requestPermission}
        />
      );

    // ── Nearby results → render actual places ─────────────────────────────
    case 'nearby_results':
      return <>{children}</>;
  }
}

// ─── Reusable gate card ───────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface GateCardProps {
  icon: IoniconsName;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
}

function GateCard({
  icon,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: GateCardProps) {
  return (
    <View
      className="mx-6 rounded-2xl overflow-hidden px-7 py-8"
      style={{
        backgroundColor: '#F7F5F0',
        borderWidth: 1,
        borderColor: 'rgba(34,45,82,0.06)',
      }}
    >
      {/* Icon */}
      <View
        className="items-center justify-center mb-5"
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: 'rgba(210,182,138,0.15)',
          alignSelf: 'center',
        }}
      >
        <Ionicons name={icon} size={22} color="#D2B68A" />
      </View>

      {/* Title */}
      <Text
        className="text-navy text-lg font-semibold text-center mb-2"
        style={{ letterSpacing: -0.2 }}
      >
        {title}
      </Text>

      {/* Body */}
      <Text
        className="text-navy/50 text-sm text-center leading-relaxed mb-6"
        style={{ lineHeight: 20 }}
      >
        {body}
      </Text>

      {/* Primary button */}
      <TouchableOpacity
        onPress={onPrimary}
        activeOpacity={0.85}
        className="bg-primary rounded-lg items-center justify-center py-3.5 mb-3"
      >
        <Text className="text-navy text-xs uppercase tracking-widest font-bold">
          {primaryLabel}
        </Text>
      </TouchableOpacity>

      {/* Secondary button */}
      <TouchableOpacity
        onPress={onSecondary}
        activeOpacity={0.7}
        className="items-center justify-center py-2.5"
      >
        <Text className="text-navy/40 text-xs tracking-wide font-medium">
          {secondaryLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
