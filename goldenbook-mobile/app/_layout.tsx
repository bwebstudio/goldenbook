import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import GoldenAtlasSplash from '@/components/GoldenAtlasSplash';
import '../global.css';

SplashScreen.preventAutoHideAsync();

// ─── Error Boundary ─────────────────────────────────────────────────────────
// Catches unhandled rendering errors so the app shows a message instead of crashing.

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    if (__DEV__) console.error('[ErrorBoundary]', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#161E38', padding: 32 }}>
          <Text style={{ color: '#D2B68A', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' }}>
            Please close and reopen the app. If the issue persists, contact support.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Navigation guard ─────────────────────────────────────────────────────────
// Runs AFTER both the splash animation and the app state are ready.
// Implements the entry flow:
//   not authed           → /auth/login
//   authed, no locality  → /select-destination
//   authed + locality    → /(tabs)  (no-op if already there)

function useNavigationGuard(ready: boolean) {
  const session                       = useAuthStore((s) => s.session);
  const authLoading                   = useAuthStore((s) => s.isLoading);
  const isHydrated                    = useAppStore((s) => s.isHydrated);
  const hasExplicitlySelectedLocality = useAppStore((s) => s.hasExplicitlySelectedLocality);
  const onboardingCompleted           = useOnboardingStore((s) => s.completed);
  const onboardingHydrated            = useOnboardingStore((s) => s.isHydrated);

  const segments = useSegments();
  const router   = useRouter();

  const lastRedirect = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || authLoading || !isHydrated || !onboardingHydrated) return;

    const seg0         = segments[0] as string;
    const inAuth       = seg0 === 'auth';
    const inSelectDest = seg0 === 'select-destination';
    const inOnboarding = seg0 === 'onboarding';

    let target: string | null = null;

    if (!session) {
      if (!inAuth) target = '/auth';
    } else if (!hasExplicitlySelectedLocality) {
      if (!inSelectDest) target = '/select-destination';
    } else if (!onboardingCompleted) {
      if (!inOnboarding) target = '/onboarding/interests';
    } else {
      // Don't redirect away from select-destination — user may be changing their city.
      if (inAuth || inOnboarding) target = '/(tabs)';
    }

    if (target && target !== lastRedirect.current) {
      lastRedirect.current = target;
      router.replace(target as any);
    }
  }, [
    ready,
    session,
    authLoading,
    isHydrated,
    hasExplicitlySelectedLocality,
    onboardingCompleted,
    onboardingHydrated,
    segments,
    router,
  ]);
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const initialize         = useAuthStore((s) => s.initialize);
  const authLoading        = useAuthStore((s) => s.isLoading);
  const isHydrated         = useAppStore((s) => s.isHydrated);
  const onboardingHydrated = useOnboardingStore((s) => s.isHydrated);
  const settingsHydrated   = useSettingsStore((s) => s.isHydrated);

  // True once the GoldenAtlasSplash exit-animation finishes.
  const [animationDone, setAnimationDone] = useState(false);

  // True once animation is done AND both async stores are ready.
  // This is the gate that unlocks navigation and renders the Stack.
  const [splashComplete, setSplashComplete] = useState(false);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Start auth init once fonts are loaded (they're needed for the first screen).
  useEffect(() => {
    if (fontsLoaded) initialize();
  }, [fontsLoaded]);

  // Hide the native Expo splash the moment our custom splash mounts.
  const onLayoutSplash = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // GoldenAtlasSplash calls this when its exit-fade finishes (~4.3s).
  const handleAnimationDone = useCallback(() => setAnimationDone(true), []);

  // Promote to splashComplete only when the animation is done AND both stores
  // have settled. In practice auth + hydration finish well before 4.3s.
  useEffect(() => {
    if (animationDone && !authLoading && isHydrated && onboardingHydrated && settingsHydrated) {
      setSplashComplete(true);
    }
  }, [animationDone, authLoading, isHydrated, onboardingHydrated, settingsHydrated]);

  // Activate the navigation guard once the Stack is mounted.
  useNavigationGuard(splashComplete);

  // ── Fonts not loaded — keep native splash visible ──────────────────────────
  if (!fontsLoaded) return null;

  // ── Show premium animated splash until all state is ready ─────────────────
  if (!splashComplete) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayoutSplash}>
        <GoldenAtlasSplash onComplete={handleAnimationDone} />
      </View>
    );
  }

  // ── Main app — navigation guard handles all routing from here ─────────────
  return (
    <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen
          name="select-destination"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: false,
          }}
        />
      </Stack>
    </QueryClientProvider>
    </AppErrorBoundary>
  );
}
