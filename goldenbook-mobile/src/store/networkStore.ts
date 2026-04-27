import { useEffect } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

// Single source of truth for network reachability. The whole app subscribes
// here; we never call NetInfo directly from screens / hooks.
//
// `isOnline` reflects "device thinks it can reach the internet right now".
// `lastOnlineAt` / `lastOfflineAt` exist so the mutation queue can flush on
// the offline→online transition without firing on every NetInfo wobble.

interface NetworkState {
  /** True iff NetInfo reports both `isConnected` AND
   *  `isInternetReachable !== false`. Defaults optimistic so the very first
   *  request on cold start isn't blocked while NetInfo is still measuring. */
  isOnline: boolean;
  /** True the moment we have observed at least one NetInfo state. Lets the
   *  OfflineBanner avoid flashing during the first 50–200ms of cold start. */
  hasResolved: boolean;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
  setFromNetInfo: (state: NetInfoState) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  hasResolved: false,
  lastOnlineAt: null,
  lastOfflineAt: null,
  setFromNetInfo: (state) => {
    // `isInternetReachable` is null on initial probe — treat null as
    // "assume reachable" because we don't want to spuriously flip the
    // banner on the very first sample. Only `false` is conclusive offline.
    const reachable = state.isInternetReachable !== false;
    const nextOnline = !!state.isConnected && reachable;
    set((prev) => ({
      isOnline: nextOnline,
      hasResolved: true,
      lastOnlineAt:  nextOnline && !prev.isOnline ? Date.now() : prev.lastOnlineAt,
      lastOfflineAt: !nextOnline && prev.isOnline ? Date.now() : prev.lastOfflineAt,
    }));
  },
}));

let unsubscribe: (() => void) | null = null;

/**
 * Mount-once hook. Wires up the NetInfo subscription that drives
 * `useNetworkStore`. Call this from `app/_layout.tsx` exactly once — every
 * other screen reads via `useNetworkStore`. Idempotent.
 */
export function useNetworkInit(): void {
  useEffect(() => {
    if (unsubscribe) return; // already subscribed
    unsubscribe = NetInfo.addEventListener((state) => {
      useNetworkStore.getState().setFromNetInfo(state);
    });
    // Kick once so the initial state is recorded promptly instead of
    // waiting for the first network change.
    NetInfo.fetch().then((state) => {
      useNetworkStore.getState().setFromNetInfo(state);
    });
    return () => {
      // We deliberately don't tear down on unmount — the listener should
      // live for the life of the app process. The cleanup is here only as
      // a courtesy in case the layout is ever remounted in dev refresh.
    };
  }, []);
}

/** Convenience selector. */
export const selectIsOnline = (s: NetworkState) => s.isOnline;
export const selectIsOffline = (s: NetworkState) => !s.isOnline && s.hasResolved;
