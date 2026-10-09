// ─── Browser refresh coordinator ─────────────────────────────────────────────
//
// Supabase refresh tokens are single use. When parallel requests (one tab's
// Promise.all, or several tabs) each spent the same refresh token, the losers
// got "Invalid Refresh Token: Already Used", every call 401'd and pages went
// blank. This coordinator makes sure only one refresh runs at a time:
//
//   1. `inFlight` coalesces concurrent refreshes WITHIN a tab.
//   2. `withLock` (Web Locks in the browser) serialises them ACROSS tabs.
//   3. Inside the lock we re-read the session generation (the readable
//      `gb_expires_at` cookie). If another tab already rotated the session
//      while we waited, we reuse it instead of spending the (now dead) token.
//   4. If the refresh call fails but the generation changed underneath us,
//      somebody else won the race: that is a success too.
//
// The tokens themselves are httpOnly; the coordinator never sees them. All I/O
// is injected so the logic can be tested without a DOM.

import { CLIENT_REFRESH_BUFFER_S, isSessionFresh } from "./session-policy";

export interface RefreshCoordinatorDeps {
  /** Current session generation (the gb_expires_at cookie), or null when absent. */
  readMarker: () => number | null;
  /** Current time in unix seconds, corrected for client clock skew. */
  now: () => number;
  /**
   * Ask the server to rotate the session. `failedMarker` is the generation the
   * caller saw fail, so the server can skip the rotation when it already
   * happened. Resolves true when the cookies now hold a usable session.
   */
  callRefresh: (failedMarker: number | null) => Promise<boolean>;
  /** Run `fn` while holding a lock shared by every tab of this origin. */
  withLock: <T>(fn: () => Promise<T>) => Promise<T>;
}

export interface RefreshCoordinator {
  /** True when the session is known and about to expire (or already has). */
  needsRefresh: () => boolean;
  /** Refresh first if the session is about to expire. Never throws. */
  ensureFresh: () => Promise<void>;
  /**
   * A request sent with generation `usedMarker` was rejected. Rotate the
   * session (or adopt a rotation that already happened). Resolves true when a
   * retry is worth making.
   */
  refreshAfterRejection: (usedMarker: number | null) => Promise<boolean>;
}

export function createRefreshCoordinator(deps: RefreshCoordinatorDeps): RefreshCoordinator {
  let inFlight: Promise<boolean> | null = null;

  const rotatedSince = (marker: number | null, failed: number | null): boolean =>
    marker !== null && marker !== failed && isSessionFresh(marker, deps.now(), 0);

  function run(failedMarker: number | null): Promise<boolean> {
    if (inFlight) return inFlight;

    const attempt = async (): Promise<boolean> => {
      // Another tab (or a page navigation through proxy.ts) may have rotated
      // the session while we were waiting for the lock.
      const before = deps.readMarker();
      if (
        before !== null &&
        before !== failedMarker &&
        isSessionFresh(before, deps.now(), CLIENT_REFRESH_BUFFER_S)
      ) {
        return true;
      }

      let ok = false;
      try {
        ok = await deps.callRefresh(failedMarker ?? before);
      } catch {
        ok = false;
      }
      if (ok) return true;

      // Refresh failed (typically "Already Used" because someone else spent
      // the token a moment earlier). If the generation moved, they succeeded.
      return rotatedSince(deps.readMarker(), failedMarker ?? before);
    };

    inFlight = (async () => {
      try {
        return await deps.withLock(attempt);
      } catch {
        return false;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  function needsRefresh(): boolean {
    const marker = deps.readMarker();
    // No readable marker: either logged out or a session created before the
    // marker existed. Let the request go; the proxy answers with a 401 that
    // says whether a refresh can help.
    if (marker === null) return false;
    return !isSessionFresh(marker, deps.now(), CLIENT_REFRESH_BUFFER_S);
  }

  return {
    needsRefresh,
    async ensureFresh() {
      if (!needsRefresh()) return;
      await run(deps.readMarker());
    },
    refreshAfterRejection: run,
  };
}
