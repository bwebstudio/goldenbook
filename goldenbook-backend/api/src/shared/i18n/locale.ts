export type AppLocale = 'en' | 'pt' | 'es'

const SUPPORTED: readonly AppLocale[] = ['en', 'pt', 'es'] as const

// Canonical default. Portuguese is the editorial source-of-truth (see
// modules/admin/places/translation-policy.ts), so when we can't resolve a
// caller's locale we serve PT — the row that's guaranteed to exist and to be
// fresh. Previously this defaulted to 'en' which silently fell back to a
// derived translation for every malformed Accept-Language header.
const DEFAULT_LOCALE: AppLocale = 'pt'

function toFamily(locale: string): string {
  return locale.trim().toLowerCase().replace('_', '-').split('-')[0] ?? DEFAULT_LOCALE
}

export function normalizeLocale(locale: string | null | undefined): AppLocale {
  if (!locale) return DEFAULT_LOCALE
  const family = toFamily(locale)
  return (SUPPORTED as readonly string[]).includes(family) ? (family as AppLocale) : DEFAULT_LOCALE
}
