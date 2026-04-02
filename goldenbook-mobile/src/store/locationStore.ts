/**
 * locationStore.ts
 *
 * Manages location permission + position state with a LAZY request pattern.
 * Permission is NEVER requested automatically — only when the user
 * explicitly taps a location CTA (e.g. "Usar ubicación" in Hidden Gems).
 *
 * Apple Review compliant: no permission prompts on launch/splash/onboarding.
 *
 * ─── State model ─────────────────────────────────────────────────────────
 *
 * LocationPermission:  unknown | granted | denied
 * LocationAvailability: idle | loading | ready | error
 *
 * These are independent axes. `permission === 'granted'` does NOT guarantee
 * we have coordinates — the position fetch may still be in-flight or failed.
 */

import { create } from 'zustand';
import * as Location from 'expo-location';

// ─── Public types ─────────────────────────────────────────────────────────────

export type LocationPermission = 'unknown' | 'granted' | 'denied';

export type LocationAvailability = 'idle' | 'loading' | 'ready' | 'error';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface LocationState {
  permission: LocationPermission;
  availability: LocationAvailability;
  coordinates: UserCoordinates | null;

  /**
   * True when the user tapped "Not now" on the pre-permission card.
   * Stays true for the current session so we show the denied-fallback
   * instead of re-showing the pre-permission prompt.
   */
  dismissed: boolean;

  /**
   * Check current permission status WITHOUT triggering the OS prompt.
   * Safe to call on component mount. If already granted AND we have no
   * coordinates yet, automatically starts fetching position.
   */
  checkPermission: () => Promise<void>;

  /**
   * Request permission from the OS. ONLY call in response to explicit
   * user action (tapping a CTA). If granted, automatically fetches position.
   */
  requestPermission: () => Promise<LocationPermission>;

  /** Fetch current position. Requires permission === 'granted'. */
  fetchPosition: () => Promise<UserCoordinates | null>;

  /** Mark as user-dismissed (tapped "Not now"). */
  dismiss: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLocationStore = create<LocationState>((set, get) => ({
  permission: 'unknown',
  availability: 'idle',
  coordinates: null,
  dismissed: false,

  // ── Check (no prompt) ───────────────────────────────────────────────────

  checkPermission: async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const mapped: LocationPermission =
        status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown';

      set({ permission: mapped });

      // If already granted but no coords, start fetching
      if (mapped === 'granted' && !get().coordinates && get().availability !== 'loading') {
        get().fetchPosition();
      }
    } catch {
      // Non-fatal — leave as unknown
    }
  },

  // ── Request (triggers OS prompt) ────────────────────────────────────────

  requestPermission: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const mapped: LocationPermission = status === 'granted' ? 'granted' : 'denied';

      set({ permission: mapped, dismissed: false });

      if (mapped === 'granted') {
        get().fetchPosition();
      }

      return mapped;
    } catch {
      set({ permission: 'denied' });
      return 'denied';
    }
  },

  // ── Fetch position ──────────────────────────────────────────────────────

  fetchPosition: async () => {
    if (get().availability === 'loading') return get().coordinates;

    set({ availability: 'loading' });
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords: UserCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      set({ coordinates: coords, availability: 'ready' });
      return coords;
    } catch {
      set({ availability: 'error' });
      return null;
    }
  },

  // ── Dismiss ─────────────────────────────────────────────────────────────

  dismiss: () => set({ dismissed: true }),
}));
