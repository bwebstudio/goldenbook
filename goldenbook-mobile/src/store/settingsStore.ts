/**
 * settingsStore.ts
 *
 * Persists user-level app settings that are not auth- or locality-related.
 * Currently: locale preference.
 *
 * Locale resolution:
 *   1. If the user explicitly picked a language from Settings → Language,
 *      `localeIsExplicit = true` and it is never overwritten.
 *   2. Otherwise, on first launch, _layout.tsx calls `setLocaleFromDevice()`
 *      with the device's preferred language (via expo-localization).
 *   3. The family mapping is fixed:
 *        pt-*  → 'pt'
 *        es-*  → 'es'
 *        else  → 'en'
 *
 * Uses the same SecureStore + Zustand persist pattern as appStore and
 * onboardingStore so it integrates naturally with the existing hydration flow.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Locale = 'en' | 'pt' | 'es';

/**
 * Normalize any BCP-47-ish string to one of our 3 supported locales.
 * Exported so the i18n layer can share the same resolution rules.
 */
export function normalizeLocale(value: string | undefined | null): Locale {
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
  /** Active locale. Defaults to 'en' until device detection runs. */
  locale: Locale;

  /**
   * True once the user explicitly picked a language from the Language screen.
   * When true, device-language detection must NOT overwrite `locale`.
   */
  localeIsExplicit: boolean;

  /** True once the persisted value has been read from SecureStore. */
  isHydrated: boolean;

  /**
   * Persist a new locale choice made explicitly by the user (e.g. from the
   * Language screen). Marks the choice as explicit so auto-detection will
   * never overwrite it again.
   */
  setLocale: (locale: Locale) => void;

  /**
   * Called on first launch to set the locale from the device language.
   * No-op if the user has already made an explicit choice (localeIsExplicit).
   * Does NOT set localeIsExplicit — this is a soft, auto-detected value.
   */
  setLocaleFromDevice: (deviceLanguageTag: string | undefined | null) => void;

  /** Internal — called by persist middleware after hydration. */
  _setHydrated: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      localeIsExplicit: false,
      isHydrated: false,

      setLocale: (locale) =>
        set({
          locale: normalizeLocale(locale),
          localeIsExplicit: true,
        }),

      setLocaleFromDevice: (deviceLanguageTag) => {
        // Never override an explicit user choice.
        if (get().localeIsExplicit) return;
        const next = normalizeLocale(deviceLanguageTag);
        if (next !== get().locale) {
          set({ locale: next });
        }
      },

      _setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'goldenbook-settings',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        locale: state.locale,
        localeIsExplicit: state.localeIsExplicit,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);
