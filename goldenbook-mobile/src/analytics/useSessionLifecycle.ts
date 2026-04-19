// useSessionLifecycle — mount once in app/_layout.tsx.
//
// Responsibilities:
//   • POST /analytics/sessions/start on mount, with the current locale / city
//     / appVersion / deviceType context.
//   • Heartbeat POST /analytics/sessions/ping every 60s while the app is
//     foregrounded. Stops pinging when backgrounded, resumes on return.
//   • POST /analytics/sessions/end when the app goes to background or the
//     component unmounts. The server also force-closes stale sessions after
//     30 min via a cron, so a force-quit never leaves an open row.
//   • Emit app_session_start / app_session_end events so feature analytics
//     can cross-reference sessions and behaviour.

import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';

import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { sessionStart, sessionPing, sessionEnd, track } from './track';

const PING_MS = 60_000;

function deviceType(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

function appVersion(): string | undefined {
  return (
    Constants.expoConfig?.version ??
    (Constants as unknown as { manifest2?: { extra?: { version?: string } } })
      .manifest2?.extra?.version
  );
}

export function useSessionLifecycle(): void {
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started   = useRef(false);

  const locale = useSettingsStore((s) => s.locale);
  const city   = useAppStore((s) => s.selectedCity);

  useEffect(() => {
    const ctx = {
      locale,
      city,
      appVersion: appVersion(),
      deviceType: deviceType(),
    };

    sessionStart(ctx);
    track('app_session_start', { metadata: ctx });
    started.current = true;

    pingTimer.current = setInterval(sessionPing, PING_MS);

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        // Refresh context on foreground in case the user switched language or
        // city while backgrounded. Cheap — the server upserts idempotently.
        sessionStart({ locale, city, appVersion: appVersion(), deviceType: deviceType() });
        if (!pingTimer.current) pingTimer.current = setInterval(sessionPing, PING_MS);
      } else {
        if (pingTimer.current) {
          clearInterval(pingTimer.current);
          pingTimer.current = null;
        }
        sessionEnd();
        track('app_session_end');
      }
    });

    return () => {
      sub.remove();
      if (pingTimer.current) clearInterval(pingTimer.current);
      if (started.current) {
        sessionEnd();
        track('app_session_end');
      }
    };
    // Deliberately depends on locale/city so that switching language or city
    // mid-session refreshes the sessions row. Re-running the effect also
    // resets the heartbeat — acceptable for the rarity of these transitions.
  }, [locale, city]);
}
