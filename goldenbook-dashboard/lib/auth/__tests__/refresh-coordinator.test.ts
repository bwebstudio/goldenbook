import { describe, it, expect } from "vitest";
import { createRefreshCoordinator } from "../refresh-coordinator";

const NOW = 1_800_000_000;

/**
 * Simulates the cookie jar and Supabase's single-use refresh tokens. Every
 * successful refresh bumps the generation (expiresAt) and invalidates the
 * previous refresh token, exactly like the incident's "Already Used".
 */
function makeWorld(initialExpiresAt: number) {
  const world = {
    marker: initialExpiresAt as number | null,
    refreshToken: "rt-0",
    calls: 0,
    alreadyUsed: 0,
    now: NOW,
  };
  let rotation = 0;
  // A refresh made with the token that was current when the request left.
  const spend = async (tokenAtSend: string): Promise<boolean> => {
    world.calls++;
    await new Promise((r) => setTimeout(r, 5));
    if (tokenAtSend !== world.refreshToken) {
      world.alreadyUsed++;
      return false;
    }
    rotation++;
    world.refreshToken = `rt-${rotation}`;
    world.marker = world.now + 3600 + rotation;
    return true;
  };
  return { world, spend };
}

/** A tab-shared lock like navigator.locks: one holder at a time, FIFO. */
function makeLock() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
}

function makeTab(w: ReturnType<typeof makeWorld>, withLock: ReturnType<typeof makeLock>) {
  return createRefreshCoordinator({
    readMarker: () => w.world.marker,
    now: () => w.world.now,
    callRefresh: () => w.spend(w.world.refreshToken),
    withLock,
  });
}

describe("refresh coordinator", () => {
  it("does nothing while the session is fresh", async () => {
    const w = makeWorld(NOW + 3600);
    const tab = makeTab(w, makeLock());
    await tab.ensureFresh();
    expect(w.world.calls).toBe(0);
  });

  it("coalesces parallel refreshes within one tab into a single call", async () => {
    const w = makeWorld(NOW - 1);
    const tab = makeTab(w, makeLock());
    const results = await Promise.all(Array.from({ length: 8 }, () => tab.refreshAfterRejection(NOW - 1)));
    expect(results.every(Boolean)).toBe(true);
    expect(w.world.calls).toBe(1);
    expect(w.world.alreadyUsed).toBe(0);
  });

  it("serialises across tabs: the second tab adopts the first tab's rotation", async () => {
    const w = makeWorld(NOW - 1);
    const lock = makeLock();
    const tabA = makeTab(w, lock);
    const tabB = makeTab(w, lock);
    const [a, b] = await Promise.all([tabA.refreshAfterRejection(NOW - 1), tabB.refreshAfterRejection(NOW - 1)]);
    expect(a && b).toBe(true);
    expect(w.world.calls).toBe(1);
    expect(w.world.alreadyUsed).toBe(0);
  });

  it("refreshes even when the clock says fresh if the backend rejected that very generation", async () => {
    const w = makeWorld(NOW + 3600);
    const tab = makeTab(w, makeLock());
    expect(await tab.refreshAfterRejection(NOW + 3600)).toBe(true);
    expect(w.world.calls).toBe(1);
  });

  it("treats a lost race as success when the generation moved", async () => {
    const w = makeWorld(NOW - 1);
    // Something outside the lock (proxy.ts on a navigation) rotates while our
    // refresh request is in flight, so ours fails with "Already Used".
    const tab = createRefreshCoordinator({
      readMarker: () => w.world.marker,
      now: () => w.world.now,
      callRefresh: async () => {
        const token = w.world.refreshToken;
        await w.spend(token); // the navigation wins
        return w.spend(token); // ours: Already Used
      },
      withLock: makeLock(),
    });
    expect(await tab.refreshAfterRejection(NOW - 1)).toBe(true);
    expect(w.world.alreadyUsed).toBe(1);
  });

  it("reports failure when the session is really dead", async () => {
    const w = makeWorld(NOW - 1);
    const tab = createRefreshCoordinator({
      readMarker: () => w.world.marker,
      now: () => w.world.now,
      callRefresh: async () => false,
      withLock: makeLock(),
    });
    expect(await tab.refreshAfterRejection(NOW - 1)).toBe(false);
  });

  it("survives a throwing refresh call and a broken lock", async () => {
    const w = makeWorld(NOW - 1);
    const throwing = createRefreshCoordinator({
      readMarker: () => w.world.marker,
      now: () => w.world.now,
      callRefresh: async () => {
        throw new Error("network");
      },
      withLock: makeLock(),
    });
    expect(await throwing.refreshAfterRejection(NOW - 1)).toBe(false);

    const brokenLock = createRefreshCoordinator({
      readMarker: () => w.world.marker,
      now: () => w.world.now,
      callRefresh: async () => true,
      withLock: async () => {
        throw new Error("locks unavailable");
      },
    });
    expect(await brokenLock.refreshAfterRejection(NOW - 1)).toBe(false);
  });

  it("refreshes ahead of expiry, once, for a burst of requests", async () => {
    const w = makeWorld(NOW + 10); // inside the 45s client buffer
    const tab = makeTab(w, makeLock());
    expect(tab.needsRefresh()).toBe(true);
    await Promise.all(Array.from({ length: 5 }, () => tab.ensureFresh()));
    expect(w.world.calls).toBe(1);
    expect(tab.needsRefresh()).toBe(false);
  });

  it("does not refresh pre-emptively without a readable marker", async () => {
    const w = makeWorld(NOW);
    w.world.marker = null;
    const tab = makeTab(w, makeLock());
    expect(tab.needsRefresh()).toBe(false);
    await tab.ensureFresh();
    expect(w.world.calls).toBe(0);
  });
});
