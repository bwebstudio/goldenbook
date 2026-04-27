import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage is the cache backend for non-sensitive offline data:
// React Query persisted queries, the mutation queue, and any other
// "OK to lose, OK to read on next launch" payloads. Auth tokens stay in
// SecureStore (managed by supabase-js itself) — DO NOT persist them here.
//
// Keys are namespaced under `gb:` so we never collide with Expo / RN
// internals or third-party libs that share the same AsyncStorage instance,
// and so a future "wipe all caches" sweep can scope itself with a prefix
// instead of a `clear()` that would also nuke other libraries.

export const STORAGE_NAMESPACE = 'gb:';

export const StorageKeys = {
  reactQueryCache: `${STORAGE_NAMESPACE}rq-cache`,
  mutationQueue:   `${STORAGE_NAMESPACE}mutation-queue`,
} as const;

export const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
  /** Clear every cache entry under our namespace. Leaves SecureStore /
   *  Supabase / other library data untouched. */
  clearNamespace: async () => {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(STORAGE_NAMESPACE));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  },
};
