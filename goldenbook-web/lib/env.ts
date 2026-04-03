// ─── Web environment variables ────────────────────────────────────────────────
// Centralise all env var access so callers never use process.env directly.

export const env = {
  /** Supabase storage base URL for any direct asset references */
  storageUrl: process.env.NEXT_PUBLIC_STORAGE_URL ?? '',

  /** App Store download link */
  appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL ?? '#',

  /** Google Play download link */
  playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '#',
} as const
