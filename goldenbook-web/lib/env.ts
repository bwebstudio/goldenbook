// ─── Web environment variables ────────────────────────────────────────────────
// Centralise all env var access so callers never use process.env directly.

export const env = {
  /** Goldenbook backend base URL, e.g. https://api.goldenbook.app */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',

  /** Supabase storage base URL for any direct asset references */
  storageUrl: process.env.NEXT_PUBLIC_STORAGE_URL ?? '',

  /** App Store download link */
  appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL ?? '#',

  /** Google Play download link */
  playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '#',
} as const
