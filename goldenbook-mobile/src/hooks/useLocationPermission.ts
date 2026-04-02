/**
 * useLocationPermission.ts
 *
 * Derived state for location-gated features on the Discover screen.
 * Provides two clean enums consumed directly by the UI:
 *
 *   HiddenGemsMode  → drives the Hidden Gems section states
 *   NowCardMode     → drives the "What should I do now" card mode
 *
 * Does NOT auto-request permission — only checks the current status on mount.
 */

import { useEffect, useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import {
  useLocationStore,
  type LocationPermission,
  type LocationAvailability,
  type UserCoordinates,
} from '@/store/locationStore';
import { LOCALITIES } from '@/config/localities';

// ─── Configurable constant ────────────────────────────────────────────────────

/** Max distance (km) from any Goldenbook locality to count as "in coverage". */
export const HIDDEN_GEMS_MAX_DISTANCE_KM = 150;

// ─── Distance helpers ─────────────────────────────────────────────────────────

function haversineKm(a: UserCoordinates, b: { latitude: number; longitude: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ─── Coverage state ───────────────────────────────────────────────────────────

export type CoverageState =
  | 'unknown'              // No coordinates yet
  | 'nearby_supported'     // Within coverage of a Goldenbook locality
  | 'far_from_coverage'    // Outside 150km from all localities
  | 'no_nearby_results';   // Within coverage but API returned 0 nearby places

// ─── Derived modes ────────────────────────────────────────────────────────────

export type HiddenGemsMode =
  | 'pre_permission'           // Never asked → show pre-permission card
  | 'loading'                  // Fetching position after grant
  | 'nearby_results'           // Granted + near + places exist
  | 'denied_fallback'          // Denied or dismissed → editorial fallback
  | 'outside_coverage_fallback' // Granted but far from all localities
  | 'no_results_fallback'      // Granted + near but no places
  | 'error_fallback';          // Geolocation failed / timeout

export type NowCardMode =
  | 'geo_context'              // Location available → full contextual card
  | 'editorial_context'        // No location → destination-based editorial
  | 'planning_context';        // Far from coverage → planning / destination mode

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocationPermission() {
  const permission   = useLocationStore((s) => s.permission);
  const availability = useLocationStore((s) => s.availability);
  const coordinates  = useLocationStore((s) => s.coordinates);
  const dismissed    = useLocationStore((s) => s.dismissed);
  const checkPermission   = useLocationStore((s) => s.checkPermission);
  const requestPermission = useLocationStore((s) => s.requestPermission);
  const dismiss           = useLocationStore((s) => s.dismiss);

  // Silently check current status on mount (no prompt)
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // ── Closest locality ────────────────────────────────────────────────────

  const closestLocality = useMemo(() => {
    if (!coordinates) return null;
    let best: { slug: string; distance: number } | null = null;
    for (const loc of LOCALITIES) {
      const d = haversineKm(coordinates, loc.coordinates);
      if (!best || d < best.distance) best = { slug: loc.slug, distance: d };
    }
    return best;
  }, [coordinates]);

  const isWithinCoverage = closestLocality
    ? closestLocality.distance <= HIDDEN_GEMS_MAX_DISTANCE_KM
    : false;

  // ── Derived: HiddenGemsMode ─────────────────────────────────────────────

  const hiddenGemsMode: HiddenGemsMode = deriveHiddenGemsMode(
    permission, availability, coordinates, dismissed, isWithinCoverage,
  );

  // ── Derived: NowCardMode ───────────────────────────────────────────────

  const nowCardMode: NowCardMode = deriveNowCardMode(
    permission, availability, coordinates, isWithinCoverage,
  );

  // ── Helpers ─────────────────────────────────────────────────────────────

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return {
    // Raw state (for advanced use)
    permission,
    availability,
    coordinates,
    dismissed,
    closestLocality,

    // Derived modes (for UI consumption)
    hiddenGemsMode,
    nowCardMode,

    // Actions
    requestPermission,
    dismiss,
    openSettings,
  };
}

// ─── Pure derivation functions ────────────────────────────────────────────────

function deriveHiddenGemsMode(
  permission: LocationPermission,
  availability: LocationAvailability,
  coordinates: UserCoordinates | null,
  dismissed: boolean,
  isWithinCoverage: boolean,
): HiddenGemsMode {
  // User tapped "Not now" → editorial fallback (same session)
  if (dismissed && permission === 'unknown') return 'denied_fallback';

  // Never asked yet
  if (permission === 'unknown') return 'pre_permission';

  // Denied (either by OS or previously)
  if (permission === 'denied') return 'denied_fallback';

  // Granted path
  if (permission === 'granted') {
    if (availability === 'loading') return 'loading';
    if (availability === 'error')   return 'error_fallback';
    if (coordinates && isWithinCoverage) return 'nearby_results';
    if (coordinates && !isWithinCoverage) return 'outside_coverage_fallback';
    // availability === 'idle' and granted → position hasn't been fetched yet
    if (availability === 'idle') return 'loading';
  }

  return 'pre_permission';
}

function deriveNowCardMode(
  permission: LocationPermission,
  availability: LocationAvailability,
  coordinates: UserCoordinates | null,
  isWithinCoverage: boolean,
): NowCardMode {
  // If we have coordinates and we're within coverage → geo context
  if (permission === 'granted' && coordinates && isWithinCoverage) {
    return 'geo_context';
  }

  // If we have coordinates but outside coverage → planning mode
  if (permission === 'granted' && coordinates && !isWithinCoverage) {
    return 'planning_context';
  }

  // Everything else: no location, denied, unknown, error → editorial context
  // The NOW section always falls back to destination-based editorial
  return 'editorial_context';
}
