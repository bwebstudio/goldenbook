/**
 * settingsStore.ts
 *
 * Persists user-level app settings that are not auth- or locality-related.
 * Currently: locale preference.
 *
 * Uses the same SecureStore + Zustand persist pattern as appStore and
 * onboardingStore so it integrates naturally with the existing hydration flow.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Locale = 'en' | 'pt' | 'es';

function normalizeLocale(value: string | undefined | null): Locale {
  if (!value) return 'en';
  const family = value.trim().toLowerCase().replace('_', '-').split('-')[0];
  if (family === 'pt') return 'pt';
  if (family === 'es') return 'es';
  return 'en';
}

// ─── SecureStore adapter (mirrors appStore / onboardingStore pattern) ─────────

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // Non-fatal — default values used on next launch
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {}
  },
};

// ─── State shape ──────────────────────────────────────────────────────────────

interface SettingsState {
  /** Active locale. Defaults to 'en'. */
  locale: Locale;

  /** True once the persisted value has been read from SecureStore. */
  isHydrated: boolean;

  /** Persist a new locale choice immediately. */
  setLocale: (locale: Locale) => void;

  /** Internal — called by persist middleware after hydration. */
  _setHydrated: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: 'en',
      isHydrated: false,

      setLocale: (locale) => set({ locale: normalizeLocale(locale) }),
      _setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'goldenbook-settings',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setLocale(state.locale);
        }
        state?._setHydrated();
      },
    },
  ),
);
