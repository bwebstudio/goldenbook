// useSessionLifecycle — mount once in app/_layout.tsx.
//
// Responsibilities:
//   • POST /analytics/sessions/start on mount, with the current locale / city
//     / appVersion / deviceType context.
//   • Heartbeat POST /analytics/sessions/ping every 60s while the app is
//     foregrounded. Stops pinging when backgrounded, resumes on return.
//   • POST /analytics/sessions/end when the app goes to BACKGROUND or the
//     component unmounts. Changing city or language does NOT end the session:
//     it only refreshes the context on the sessions row.
//   • Coming back after more than SESSION_RESUME_WINDOW_MS in the background
//     starts a NEW session id, so the time away is never counted as session
//     duration. Shorter trips (a message, a photo) keep the same session. Deliberately not on 'inactive', which iOS fires for
//     transient overlays; ending there froze session duration seconds after
//     launch. The server reopens the session on the next start and force-
//     closes stale ones after 30 min, so a force-quit never leaves an open row.
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
import { getSessionId, rotateSessionId } from '@/api/client';
import { sessionStart, sessionPing, sessionEnd, track } from './track';

const PING_MS = 60_000;
// Drop duplicate foreground emits within this window. iOS in particular flips
// active → inactive → active when the system shows a sheet (Face ID, control
// center, share sheet); we treat those as the same "open" for analytics.
const FOREGROUND_DEDUPE_MS = 30_000;
// Background longer than this and the return counts as a new session. Matches
// the server's stale-session cron, which force-closes rows idle for 30 min.
const SESSION_RESUME_WINDOW_MS = 30 * 60_000;

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
  const lastForegroundAt = useRef(0);
  const backgroundedAt = useRef<number | null>(null);

  const locale = useSettingsStore((s) => s.locale);
  const city   = useAppStore((s) => s.selectedCity);
  // AppShell now mounts under the splash, before the persisted stores have
  // been read. Wait for them so the first session row and app_session_start
  // carry the real city / locale instead of the defaults.
  const settingsHydrated = useSettingsStore((s) => s.isHydrated);
  const appHydrated      = useAppStore((s) => s.isHydrated);
  const ready = settingsHydrated && appHydrated;

  // Current context lives in refs so the AppState listener (registered once)
  // always reads fresh values without re-running the lifecycle effect.
  const localeRef = useRef(locale);
  const cityRef   = useRef(city);
  localeRef.current = locale;
  cityRef.current   = city;

  // ── Lifecycle: once per app process, as soon as the stores are ready ─────
  useEffect(() => {
    if (!ready) return;
    const ctx = () => ({
      locale:     localeRef.current,
      city:       cityRef.current,
      appVersion: appVersion(),
      deviceType: deviceType(),
    });

    function emitForegroundOpen(reason: 'cold_start' | 'foreground' | 'new_session') {
      // Coalesce bursts so the iOS active/inactive churn doesn't double-count.
      // A brand-new session always emits: it is a different session id.
      const now = Date.now();
      if (reason !== 'new_session' && now - lastForegroundAt.current < FOREGROUND_DEDUPE_MS) return;
      lastForegroundAt.current = now;
      track('app_session_start', { metadata: { ...ctx(), reason } });
    }

    function startPing() {
      if (!pingTimer.current) pingTimer.current = setInterval(sessionPing, PING_MS);
    }
    function stopPing() {
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
    }

    sessionStart(ctx());
    emitForegroundOpen('cold_start');
    startPing();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        const awayFor = backgroundedAt.current != null ? Date.now() - backgroundedAt.current : 0;
        const wasBackgrounded = backgroundedAt.current != null;
        backgroundedAt.current = null;

        if (wasBackgrounded && awayFor > SESSION_RESUME_WINDOW_MS) {
          // Long absence: a new visit. A fresh id keeps the background time
          // out of the previous session's duration.
          rotateSessionId();
          if (__DEV__) console.log('[session] new session after', Math.round(awayFor / 60000), 'min away:', getSessionId());
          sessionStart(ctx());
          emitForegroundOpen('new_session');
        } else {
          // Short trip (or an iOS 'inactive' blink): the server reopens the
          // same session row, refreshed with the current context.
          sessionStart(ctx());
          emitForegroundOpen('foreground');
        }
        startPing();
      } else if (next === 'background') {
        // Only 'background' ends a session. iOS also emits 'inactive' when it
        // puts anything over the app (Face ID, control centre, the share
        // sheet, an incoming call banner), and treating that as an end is
        // what froze session duration at a few seconds: the app kept being
        // used, but ended_at was already stamped. 'inactive' is a blink, not
        // a departure, so we leave the session open and keep the heartbeat
        // running. The 30-minute stale-session cron still closes anything a
        // force-quit leaves behind.
        if (backgroundedAt.current == null) backgroundedAt.current = Date.now();
        stopPing();
        sessionEnd();
        track('app_session_end');
      }
    });

    return () => {
      sub.remove();
      stopPing();
      sessionEnd();
      track('app_session_end');
    };
    // `ready` only ever goes false → true, so this runs once.
  }, [ready]);

  // ── Context refresh: city / language changed mid-session ─────────────────
  // Updates the open sessions row in place (the server upserts by id). It
  // deliberately does NOT end the session or emit app_session_start/end:
  // switching city is part of using the app, not leaving it.
  const lastContext = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const key = `${locale}|${city}`;
    // The first value is the one the lifecycle effect already sent.
    if (lastContext.current === null || lastContext.current === key) {
      lastContext.current = key;
      return;
    }
    lastContext.current = key;
    if (AppState.currentState !== 'active') return;
    sessionStart({ locale, city, appVersion: appVersion(), deviceType: deviceType() });
  }, [ready, locale, city]);
}
