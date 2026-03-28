/**
 * i18n/index.ts
 *
 * Minimal, type-safe translation system.
 *
 * Usage:
 *   const t = useTranslation();
 *   <Text>{t.profile.title}</Text>
 *
 * Architecture:
 * - Locale is stored in settingsStore (SecureStore-persisted Zustand store).
 * - Translation files live in ./locales/{locale}.ts.
 * - Adding a new locale: create the file, add it to the map below.
 * - Adding new keys: add to en.ts first (it's the type source), then pt.ts.
 * - All screens that need translation call useTranslation() — no context provider needed.
 */

import { useSettingsStore } from '@/store/settingsStore';
import { en } from './locales/en';
import { pt } from './locales/pt';
import type { Translations } from './locales/en';

const locales: Record<string, Translations> = {
  en,
  'pt-PT': pt,
};

/**
 * Returns the full typed translation object for the current locale.
 * Falls back to English if the locale key is not found.
 */
export function useTranslation(): Translations {
  const locale = useSettingsStore((s) => s.locale);
  return locales[locale] ?? locales.en;
}
