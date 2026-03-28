import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { LOCALITIES, Locality, DEFAULT_LOCALITY_SLUG } from '@/config/localities';

// ─── SecureStore adapter for Zustand persist ──────────────────────────────────
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
      // Non-fatal — default values used on next launch.
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {}
  },
};

// ─── State shape ──────────────────────────────────────────────────────────────

interface AppState {
  /** Slug of the currently active locality (e.g. 'lisboa'). */
  selectedCity: string;

  /**
   * True only when the user has ACTIVELY tapped a destination in the
   * selection flow. The default fallback ('lisboa') does NOT set this flag.
   * Used by the navigation guard to decide whether to show the onboarding step.
   */
  hasExplicitlySelectedLocality: boolean;

  /** True once the persisted values have been read from SecureStore. */
  isHydrated: boolean;

  /** All supported localities — drives both the onboarding screen and the switcher. */
  availableLocalities: Locality[];

  /**
   * Called from the in-app switcher (DiscoverHeader).
   * Updates the active city WITHOUT setting the explicit-selection flag,
   * because the flag is already true by the time the switcher is accessible.
   */
  setCity: (slug: string) => void;

  /**
   * Called ONLY from the destination selection screen (first-time flow).
   * Sets both the city AND the explicit-selection flag.
   */
  completeLocalitySelection: (slug: string) => void;

  /**
   * Called on sign-out so the next login session re-triggers the
   * destination selection onboarding step.
   */
  resetLocalitySelection: () => void;

  /** Internal — called by persist middleware after hydration. */
  _setHydrated: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedCity: DEFAULT_LOCALITY_SLUG,
      hasExplicitlySelectedLocality: false,
      isHydrated: false,
      availableLocalities: LOCALITIES,

      setCity: (slug) => set({ selectedCity: slug }),

      completeLocalitySelection: (slug) =>
        set({ selectedCity: slug, hasExplicitlySelectedLocality: true }),

      resetLocalitySelection: () =>
        set({
          hasExplicitlySelectedLocality: false,
          // Keep the last-selected city as a sensible default for next time.
        }),

      _setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'goldenbook-app-store',
      storage: createJSONStorage(() => secureStorage),
      // Only persist what matters — everything else is derived from config.
      partialize: (state) => ({
        selectedCity: state.selectedCity,
        hasExplicitlySelectedLocality: state.hasExplicitlySelectedLocality,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);
