export type AppLocale = 'en' | 'pt' | 'es'

const SUPPORTED: readonly AppLocale[] = ['en', 'pt', 'es'] as const

function toFamily(locale: string): string {
  return locale.trim().toLowerCase().replace('_', '-').split('-')[0] ?? 'en'
}

export function normalizeLocale(locale: string | null | undefined): AppLocale {
  if (!locale) return 'en'
  const family = toFamily(locale)
  return (SUPPORTED as readonly string[]).includes(family) ? (family as AppLocale) : 'en'
}

