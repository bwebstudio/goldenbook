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
//   • Emit app_session_start / app_session_end events on cold start AND on
//     warm-resume foreground transitions, so that "active users today"
//     correctly counts users who already had the app installed and just
//     foreground it (without going through the auth screen). Re-fires of
//     app_session_start within FOREGROUND_DEDUPE_MS are dropped so iOS
//     active/inactive churn (control center, biometric prompt, etc.) doesn't
//     bloat the events table.

import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';

import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { sessionStart, sessionPing, sessionEnd, track } from './track';

const PING_MS = 60_000;
// Drop duplicate foreground emits within this window. iOS in particular flips
// active → inactive → active when the system shows a sheet (Face ID, control
// center, share sheet); we treat those as the same "open" for analytics.
const FOREGROUND_DEDUPE_MS = 30_000;

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
  const lastForegroundAt = useRef(0);

  const locale = useSettingsStore((s) => s.locale);
  const city   = useAppStore((s) => s.selectedCity);

  useEffect(() => {
    const ctx = {
      locale,
      city,
      appVersion: appVersion(),
      deviceType: deviceType(),
    };

    function emitForegroundOpen(reason: 'cold_start' | 'foreground' | 'context_change') {
      // Coalesce bursts so the iOS active/inactive churn doesn't double-count.
      const now = Date.now();
      if (now - lastForegroundAt.current < FOREGROUND_DEDUPE_MS) return;
      lastForegroundAt.current = now;
      track('app_session_start', { metadata: { ...ctx, reason } });
    }

    sessionStart(ctx);
    emitForegroundOpen(started.current ? 'context_change' : 'cold_start');
    started.current = true;

    pingTimer.current = setInterval(sessionPing, PING_MS);

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        // Refresh context on foreground in case the user switched language or
        // city while backgrounded. Cheap — the server upserts idempotently.
        sessionStart({ locale, city, appVersion: appVersion(), deviceType: deviceType() });
        // Emit an analytics event on every foreground so warm-resume opens
        // also count toward "Active users today". Dedupe inside the helper
        // protects against rapid active/inactive churn.
        emitForegroundOpen('foreground');
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
