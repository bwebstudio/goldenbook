import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

// ─── SecureStore adapter ───────────────────────────────────────────────────────
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
    } catch {}
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {}
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ExplorationStyle = 'solo' | 'couple' | 'friends' | 'family';

interface OnboardingState {
  completed: boolean;
  interests: string[];
  explorationStyle: ExplorationStyle | null;
  completedAt: string | null;

  /** True once persisted values have been read from SecureStore. */
  isHydrated: boolean;

  setInterests: (interests: string[]) => void;
  setExplorationStyle: (style: ExplorationStyle) => void;
  completeOnboarding: (interests: string[], style: ExplorationStyle) => void;

  /** Called on sign-out so onboarding re-runs on the next account. */
  resetOnboarding: () => void;

  _setHydrated: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      interests: [],
      explorationStyle: null,
      completedAt: null,
      isHydrated: false,

      setInterests: (interests) => set({ interests }),
      setExplorationStyle: (explorationStyle) => set({ explorationStyle }),

      completeOnboarding: (interests, explorationStyle) =>
        set({
          completed: true,
          interests,
          explorationStyle,
          completedAt: new Date().toISOString(),
        }),

      resetOnboarding: () =>
        set({
          completed: false,
          interests: [],
          explorationStyle: null,
          completedAt: null,
        }),

      _setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'goldenbook-onboarding',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        completed: state.completed,
        interests: state.interests,
        explorationStyle: state.explorationStyle,
        completedAt: state.completedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);
