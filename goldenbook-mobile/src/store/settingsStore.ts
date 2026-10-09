/**
 * settingsStore.ts
 *
 * Persists user-level app settings that are not auth- or locality-related.
 * Currently: locale preference, whether the full intro splash has already
 * been shown on this install, the answer to the 18:00 ritual, and the
 * counters that pick a moment for the store review prompt.
 *
 * Locale resolution:
 *   1. If the user explicitly picked a language from Settings → Language,
 *      `localeIsExplicit = true` and it is never overwritten.
 *   2. Otherwise, on first launch, _layout.tsx calls `setLocaleFromDevice()`
 *      with the device's preferred language (via expo-localization).
 *   3. The family mapping is fixed:
 *        pt-*  → 'pt'
 *        es-*  → 'es'
 *        en-*  → 'en'
 *        else  → 'pt'   (canonical fallback — see backend translation policy)
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
 *
 * Default for unknown / missing input is 'pt' — the canonical editorial
 * locale (see goldenbook-backend translation policy). English-, Spanish-,
 * and Portuguese-speaking devices still get their own locale; only truly
 * unsupported tags (e.g. 'fr', 'de') fall back to PT, and only on the very
 * first launch before persistence rehydrates.
 */
export function normalizeLocale(value: string | undefined | null): Locale {
  if (!value) return 'pt';
  const family = value.trim().toLowerCase().replace('_', '-').split('-')[0];
  if (family === 'pt') return 'pt';
  if (family === 'es') return 'es';
  if (family === 'en') return 'en';
  return 'pt';
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
  /** Active locale. Defaults to 'pt' until device detection runs — that's
   *  the canonical row on the backend, so a request that races device
   *  detection still hits a fresh, complete row instead of a derived EN
   *  translation. */
  locale: Locale;

  /**
   * True once the user explicitly picked a language from the Language screen.
   * When true, device-language detection must NOT overwrite `locale`.
   */
  localeIsExplicit: boolean;

  /** True once the persisted value has been read from SecureStore. */
  isHydrated: boolean;

  /**
   * True once the full GoldenAtlasSplash animation has played on this
   * install. Later launches get the short version.
   */
  hasSeenIntroSplash: boolean;

  /** Remember that the full splash animation has been shown. */
  markIntroSplashSeen: () => void;

  /**
   * The user's answer to the 18:00 ritual: true / false once they chose,
   * null while they never did. False also stops the silent token refresh,
   * even if the OS permission is still granted.
   */
  pushOptIn: boolean | null;
  /** When we last invited the user to the ritual (ISO), so we ask once. */
  pushPromptedAt: string | null;
  setPushOptIn: (value: boolean) => void;
  markPushPrompted: () => void;

  /** Saves and finished routes, counted to pick a good moment for a review. */
  positiveMoments: number;
  /** When we last asked the OS for a store review (ISO). */
  reviewPromptedAt: string | null;
  addPositiveMoment: () => number;
  markReviewPrompted: () => void;

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
      locale: 'pt',
      localeIsExplicit: false,
      isHydrated: false,
      hasSeenIntroSplash: false,
      pushOptIn: null,
      pushPromptedAt: null,
      positiveMoments: 0,
      reviewPromptedAt: null,

      setPushOptIn: (value) => set({ pushOptIn: value }),
      markPushPrompted: () => set({ pushPromptedAt: new Date().toISOString() }),
      addPositiveMoment: () => {
        const next = get().positiveMoments + 1;
        set({ positiveMoments: next });
        return next;
      },
      markReviewPrompted: () => set({ reviewPromptedAt: new Date().toISOString() }),

      markIntroSplashSeen: () => {
        if (!get().hasSeenIntroSplash) set({ hasSeenIntroSplash: true });
      },

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
        hasSeenIntroSplash: state.hasSeenIntroSplash,
        pushOptIn: state.pushOptIn,
        pushPromptedAt: state.pushPromptedAt,
        positiveMoments: state.positiveMoments,
        reviewPromptedAt: state.reviewPromptedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);
