/**
 * useVersionCheck.ts
 *
 * Cold-start gate that compares the installed binary's build number against
 * a remote config served by the backend (`GET /mobile/version-check`) and,
 * if needed, shows a native Alert prompting the user to update.
 *
 * Two outcomes:
 *   installed < min*      → forced Alert with one button (Update). Tapping it
 *                           opens the platform store. The Alert is not
 *                           dismissable; the user can technically background
 *                           the app, but there's no "Later" path.
 *   installed < latest*   → recommended Alert with Later + Update.
 *
 * Robustness contract:
 *   - Never blocks app boot. Network errors, missing response shape, or
 *     `expo-application` returning null all short-circuit silently.
 *   - Runs at most once per app process (module-level flag).
 *   - Skips while NetInfo reports offline — we want zero UX impact for
 *     users in tunnels / planes / parking garages.
 *   - Waits ~600ms after the splash unmounts so the Alert lands on top of
 *     the first real screen and not on top of a still-mounting Stack.
 *
 * The hook is mounted once in app/_layout.tsx (inside AppShell, after the
 * splash gate) and reads the locale lazily from the settings store so the
 * remote `messages` object is selected to match the user's UI language.
 */

import { useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import { api } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useNetworkStore } from '@/store/networkStore';
import { useSettingsStore, type Locale } from '@/store/settingsStore';

// ─── Remote contract ──────────────────────────────────────────────────────────

interface UpdateMessages {
  title: string;
  body: string;
  updateButton: string;
  laterButton: string;
}

export interface VersionCheckResponse {
  ios: { minBuild: number; latestBuild: number; storeUrl: string };
  android: {
    minVersionCode: number;
    latestVersionCode: number;
    storeUrl: string;
  };
  forceUpdate: boolean;
  messages: Partial<Record<Locale, UpdateMessages>>;
}

// ─── Module state ─────────────────────────────────────────────────────────────

// True once we've shown (or decided not to show) the popup in this app
// process. Keeps the Alert from re-firing on hot reloads of the layout in
// dev and from re-firing if the layout ever remounts.
let didCheckThisSession = false;

// Last-resort fallback strings if the backend response is missing the
// `messages` object entirely. Matches the EN strings on the server so the
// UX is identical to the happy path.
const FALLBACK_MESSAGES: Record<Locale, UpdateMessages> = {
  en: {
    title: 'New update available',
    body: 'A new version of Goldenbook Go is available. Update now to enjoy the latest improvements.',
    updateButton: 'Update',
    laterButton: 'Later',
  },
  es: {
    title: 'Nueva actualización disponible',
    body: 'Hay una nueva versión de Goldenbook Go disponible. Actualiza ahora para disfrutar de las últimas mejoras.',
    updateButton: 'Actualizar',
    laterButton: 'Más tarde',
  },
  pt: {
    title: 'Nova atualização disponível',
    body: 'Está disponível uma nova versão do Goldenbook Go. Atualize agora para aceder às últimas melhorias.',
    updateButton: 'Atualizar',
    laterButton: 'Mais tarde',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the installed binary's build counter on each platform:
 *   iOS     → CFBundleVersion (Application.nativeBuildVersion is a string)
 *   Android → versionCode      (Application.nativeBuildVersion is a string)
 * Returns null if the value is absent or not a finite integer — in that
 * case the hook short-circuits without showing the Alert.
 */
function getInstalledBuild(): number | null {
  const raw = Application.nativeBuildVersion;
  if (raw == null) return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

function pickMessages(
  remote: VersionCheckResponse['messages'] | undefined,
  locale: Locale,
): UpdateMessages {
  return (
    remote?.[locale] ??
    remote?.en ??
    remote?.es ??
    remote?.pt ??
    FALLBACK_MESSAGES[locale] ??
    FALLBACK_MESSAGES.en
  );
}

async function openStore(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // Last-ditch: if the store URL fails to open we silently swallow.
    // There's no useful UI to show — the user is already looking at a
    // dismissed Alert.
  }
}

// ─── Core check (exposed for ad-hoc invocation; the hook is the normal path) ─

export async function checkForAppUpdate(): Promise<void> {
  if (didCheckThisSession) return;

  // Web build doesn't have a binary to update.
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    didCheckThisSession = true;
    return;
  }

  // Don't fire a network call (or block on a slow one) when we already
  // know the device is offline.
  if (!useNetworkStore.getState().isOnline) return;

  let cfg: VersionCheckResponse;
  try {
    cfg = await api.versionCheck();
  } catch (err) {
    if (__DEV__) console.warn('[versionCheck] remote config unavailable:', err);
    didCheckThisSession = true;
    return;
  }

  const installed = getInstalledBuild();
  if (installed == null) {
    didCheckThisSession = true;
    return;
  }

  const platformCfg =
    Platform.OS === 'ios'
      ? { min: cfg.ios?.minBuild, latest: cfg.ios?.latestBuild, url: cfg.ios?.storeUrl }
      : {
          min: cfg.android?.minVersionCode,
          latest: cfg.android?.latestVersionCode,
          url: cfg.android?.storeUrl,
        };

  const minBuild = Number.isFinite(platformCfg.min) ? Number(platformCfg.min) : 0;
  const latestBuild = Number.isFinite(platformCfg.latest)
    ? Number(platformCfg.latest)
    : 0;
  const storeUrl = typeof platformCfg.url === 'string' ? platformCfg.url : '';

  if (!storeUrl) {
    didCheckThisSession = true;
    return;
  }

  const isForced = installed < minBuild || cfg.forceUpdate === true;
  const isRecommended = !isForced && installed < latestBuild;

  if (!isForced && !isRecommended) {
    didCheckThisSession = true;
    return;
  }

  // Don't pile a "recommended" Alert on top of the auth flow — the user is
  // mid-task and we'd rather catch them on the next cold start once they're
  // signed in. Forced updates always show, regardless of auth state.
  if (isRecommended && !useAuthStore.getState().session) return;

  const locale = useSettingsStore.getState().locale;
  const msg = pickMessages(cfg.messages, locale);

  // Mark "checked" before showing so re-entrant calls during the open Alert
  // can't queue a second one.
  didCheckThisSession = true;

  if (isForced) {
    Alert.alert(
      msg.title,
      msg.body,
      [{ text: msg.updateButton, onPress: () => openStore(storeUrl) }],
      { cancelable: false },
    );
    return;
  }

  Alert.alert(msg.title, msg.body, [
    { text: msg.laterButton, style: 'cancel' },
    { text: msg.updateButton, onPress: () => openStore(storeUrl) },
  ]);
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * Mount once in AppShell (after splashComplete). Fires `checkForAppUpdate`
 * after a short delay so the Alert lands on top of the first stable
 * screen, never on top of a still-transitioning Stack.
 */
export function useVersionCheck(): void {
  useEffect(() => {
    if (didCheckThisSession) return;
    const t = setTimeout(() => {
      void checkForAppUpdate();
    }, 600);
    return () => clearTimeout(t);
  }, []);
}

// Test-only helper. Not exported via the package surface; reach for it from
// dev tools when manually re-triggering the popup is useful.
export function __resetVersionCheckForTests(): void {
  didCheckThisSession = false;
}
