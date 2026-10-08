import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from '@/lib/queryClient';
import { persistOptions } from '@/lib/persister';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useNetworkInit, useNetworkStore } from '@/store/networkStore';
import { useMutationQueueStore } from '@/store/mutationQueueStore';
import { useReplayPendingSaves } from '@/features/saved/hooks/useReplayPendingSaves';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useTranslation } from '@/i18n';
import { useSessionLifecycle } from '@/analytics/useSessionLifecycle';
import { useContentVersionSync } from '@/api/useContentVersion';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import * as Localization from 'expo-localization';
import { usePushRegistration, useNotificationHandler } from '@/features/push';
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
import GoldenAtlasSplash, { type SplashVariant } from '@/components/GoldenAtlasSplash';
import { colors } from '@/design/tokens';
import '../global.css';

SplashScreen.preventAutoHideAsync();

// Same navy as the native splash (app.json) and GoldenAtlasSplash.
const SPLASH_BG = colors.navy.dark;

// ─── Error Boundary ─────────────────────────────────────────────────────────
// Catches unhandled rendering errors so the app shows a message instead of crashing.
//
// The fallback UI is a separate functional component so it can subscribe to
// the settings store and show the translated copy — a class component can't
// call hooks directly.

function ErrorFallback() {
  const t = useTranslation();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#161E38', padding: 32 }}>
      <Text style={{ color: '#D2B68A', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
        {t.errorBoundary.title}
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' }}>
        {t.errorBoundary.body}
      </Text>
    </View>
  );
}

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
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

// ─── Navigation guard ─────────────────────────────────────────────────────────
// Runs as soon as every persisted store has hydrated, while the splash overlay
// still covers the screen, so the correct screen is already underneath when
// the overlay fades out.
// Implements the entry flow:
//   not authed           → /auth/login
//   authed, no locality  → /select-destination
//   authed + locality    → /(tabs)  (no-op if already there)
//
// Returns true once the current location is where the entry flow wants it
// (no redirect pending). The splash overlay waits on this so a screen that is
// about to be replaced never flashes.

function useNavigationGuard(ready: boolean): boolean {
  const session                       = useAuthStore((s) => s.session);
  const authHydrated                  = useAuthStore((s) => s.isHydrated);
  const isHydrated                    = useAppStore((s) => s.isHydrated);
  const hasExplicitlySelectedLocality = useAppStore((s) => s.hasExplicitlySelectedLocality);
  const onboardingCompleted           = useOnboardingStore((s) => s.completed);
  const onboardingHydrated            = useOnboardingStore((s) => s.isHydrated);

  const segments = useSegments();
  const router   = useRouter();

  const lastRedirect = useRef<string | null>(null);

  const canRun = ready && authHydrated && isHydrated && onboardingHydrated;

  const seg0         = segments[0] as string | undefined;
  const inAuth       = seg0 === 'auth';
  const inSelectDest = seg0 === 'select-destination';
  const inOnboarding = seg0 === 'onboarding';

  let target: string | null = null;
  if (canRun) {
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
  }

  useEffect(() => {
    if (!canRun) return;
    if (target && target !== lastRedirect.current) {
      lastRedirect.current = target;
      router.replace(target as any);
    } else if (!target) {
      // Settled. Forget the last redirect so the same target can be used
      // again later (e.g. sign out → /auth, sign in, sign out → /auth).
      lastRedirect.current = null;
    }
  }, [canRun, target, router]);

  return canRun && target === null;
}

// Longest we keep the overlay up waiting for the guard to settle once the
// stores are ready and the animation is done. A safety net only: a redirect
// that never lands must not leave the user staring at the splash.
const GUARD_SETTLE_TIMEOUT_MS = 1500;

// ─── Root layout ──────────────────────────────────────────────────────────────
//
// The providers and the navigator mount immediately, underneath the animated
// splash, which is drawn as an overlay. That way the React Query cache is
// restored from disk and the first screen (Discover, Now) starts fetching
// while the animation plays, instead of after it. The overlay is removed once
// the animation has finished AND every store has hydrated AND the navigation
// guard has nothing left to redirect.

export default function RootLayout() {
  const initialize          = useAuthStore((s) => s.initialize);
  const authHydrated        = useAuthStore((s) => s.isHydrated);
  const isHydrated          = useAppStore((s) => s.isHydrated);
  const onboardingHydrated  = useOnboardingStore((s) => s.isHydrated);
  const settingsHydrated    = useSettingsStore((s) => s.isHydrated);
  const setLocaleFromDevice = useSettingsStore((s) => s.setLocaleFromDevice);
  const hasSeenIntroSplash  = useSettingsStore((s) => s.hasSeenIntroSplash);
  const markIntroSplashSeen = useSettingsStore((s) => s.markIntroSplashSeen);

  // Splash variant, decided once the settings store has hydrated (we keep
  // the native splash up until then, a SecureStore read of a few ms): the
  // full animation only on the first launch after install, the quick fade on
  // every launch after that.
  const splashVariantRef = useRef<SplashVariant | null>(null);
  if (settingsHydrated && splashVariantRef.current === null) {
    splashVariantRef.current = hasSeenIntroSplash ? 'quick' : 'full';
  }
  const splashVariant = splashVariantRef.current;

  // True once the GoldenAtlasSplash exit fade finishes; the overlay is then
  // unmounted.
  const [splashComplete, setSplashComplete] = useState(false);

  const [fontsReady, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // If the fonts fail to load, carry on with system fonts rather than sit
  // on the native splash forever.
  const fontsLoaded = fontsReady || !!fontError;

  // Start auth init once fonts are loaded (they're needed for the first screen).
  useEffect(() => {
    if (fontsLoaded) initialize();
  }, [fontsLoaded]);

  // ── Device language detection ───────────────────────────────────────────
  // Runs once, as soon as the settings store has rehydrated from SecureStore.
  // If the user previously picked a language from the Language screen,
  // `localeIsExplicit` is true in the persisted state and setLocaleFromDevice
  // is a no-op — their choice is preserved across launches.
  // Otherwise we map the device's preferred language family (pt-* → pt,
  // es-* → es, anything else → en) and update the store synchronously, so
  // the locale is already correct by the time the splash exits.
  useEffect(() => {
    if (!settingsHydrated) return;
    const tag = Localization.getLocales()[0]?.languageTag ?? 'en';
    setLocaleFromDevice(tag);
  }, [settingsHydrated, setLocaleFromDevice]);

  // Hide the native Expo splash once our overlay is on screen.
  const onLayoutSplash = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Every persisted store has settled. We gate on `authHydrated` (true after
  // the first onAuthStateChange event resolves) instead of `!isLoading`,
  // because `isLoading` flipped to false on every transient `getSession()`
  // error even when Supabase had not yet broadcast the recovered session —
  // which let the discover screen mount and 401 against an unauth'd request.
  const storesReady = authHydrated && isHydrated && onboardingHydrated && settingsHydrated;

  // Push: el handler escucha toques y el registro refresca el token en
  // silencio si el permiso ya estaba dado. Ninguno de los dos pide nada.
  useNotificationHandler();
  usePushRegistration();

  // The guard runs under the overlay as soon as the stores are ready.
  const guardSettled = useNavigationGuard(storesReady);

  // Safety net: once the stores are ready, never hold the overlay more than
  // GUARD_SETTLE_TIMEOUT_MS waiting on the guard.
  const [guardTimedOut, setGuardTimedOut] = useState(false);
  useEffect(() => {
    if (!storesReady || guardSettled) return;
    const id = setTimeout(() => setGuardTimedOut(true), GUARD_SETTLE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [storesReady, guardSettled]);

  const canExitSplash = storesReady && (guardSettled || guardTimedOut);

  // GoldenAtlasSplash calls this when its exit fade finishes.
  const handleSplashDone = useCallback(() => {
    if (splashVariantRef.current === 'full') markIntroSplashSeen();
    setSplashComplete(true);
  }, [markIntroSplashSeen]);

  // ── Fonts not loaded — keep native splash visible ──────────────────────────
  if (!fontsLoaded) return null;

  // ── App underneath, splash overlay on top until everything is ready ──────
  return (
    <View style={{ flex: 1, backgroundColor: SPLASH_BG }}>
      <AppErrorBoundary>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <AppShell splashComplete={splashComplete} />
        </PersistQueryClientProvider>
      </AppErrorBoundary>

      {!splashComplete && (
        <View
          style={StyleSheet.absoluteFill}
          // Blocks touches to the screen underneath while visible.
          pointerEvents="auto"
        >
          {splashVariant ? (
            // Own View so its onLayout fires when it mounts, which is when
            // we hand over from the native splash.
            <View style={{ flex: 1 }} onLayout={onLayoutSplash}>
              <GoldenAtlasSplash
                variant={splashVariant}
                canExit={canExitSplash}
                onComplete={handleSplashDone}
              />
            </View>
          ) : (
            // Settings not read yet: the native splash is still showing; this
            // plain backdrop only keeps the app hidden behind it.
            <View style={{ flex: 1, backgroundColor: SPLASH_BG }} />
          )}
        </View>
      )}
    </View>
  );
}

// AppShell must be a child of QueryClientProvider so useContentVersionSync can
// call useQueryClient. It also owns the session lifecycle — mount once per app
// process, emit session_start/ping/end, invalidate editorial caches on
// foreground when the dashboard has bumped content_version, and run the
// offline mutation queue flush whenever connectivity returns.
function AppShell({ splashComplete }: { splashComplete: boolean }) {
  useSessionLifecycle();
  useContentVersionSync();
  useNetworkInit();
  useOfflineQueueFlush();
  useVersionCheck(splashComplete);
  // Replay pending offline save/unsave ops onto the ['saved', userId, locale]
  // cache. Pure local cache write — never fires a network request, never
  // touches the queue. Closes the force-quit-within-200ms gap left by the
  // React Query persister's write throttle.
  useReplayPendingSaves();

  return (
    <View style={{ flex: 1 }}>
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
      <OfflineBanner />
    </View>
  );
}

// Drains the offline mutation queue whenever connectivity flips back on.
// Mounted once at AppShell so we have a single source of "online edge"
// detection — individual screens that enqueue ops do not call flush().
function useOfflineQueueFlush() {
  const isOnline    = useNetworkStore((s) => s.isOnline);
  const isHydrated  = useMutationQueueStore((s) => s.isHydrated);
  const flush       = useMutationQueueStore((s) => s.flush);
  const userId      = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    // Gates: (a) we've read the persisted queue from disk, (b) NetInfo
    // currently reports online, and (c) someone is signed in. flush() only
    // sends the signed-in user's own ops and drops the rest, so it also
    // re-runs when the user changes. Online is checked again inside flush()
    // so a flicker between mount and the effect running won't burn the queue
    // against an offline socket.
    if (!isHydrated || !isOnline || !userId) return;
    void flush();
  }, [isOnline, isHydrated, userId, flush]);
}
