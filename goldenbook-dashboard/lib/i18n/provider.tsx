"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import en, { type TranslationKeys } from "./locales/en";
import pt from "./locales/pt";

export type Locale = "en" | "pt";

const LOCALES: Record<Locale, TranslationKeys> = { en, pt };
const STORAGE_KEY = "gb_locale";
export const LOCALE_COOKIE = "gb_locale";

function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  // Readable by server components via next/headers cookies(). Persisted for a
  // year; mirrors localStorage so both client and server resolve the same
  // locale without a flash of English on first server render.
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "pt") return stored;
  // Detect browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("pt")) return "pt";
  return "en";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  // One-time client-side hydration: localStorage is only reachable after
  // mount, and the "render with 'en' until mounted" branch below prevents the
  // hydration mismatch. Not a cascading render — the effect runs once.
  useEffect(() => {
    const initial = getInitialLocale();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(initial);
    writeLocaleCookie(initial);
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    writeLocaleCookie(newLocale);
  }, []);

  const t = LOCALES[locale];

  // Prevent hydration mismatch — render with "en" until mounted
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: "en", setLocale, t: en }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(I18nContext);
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}

export function useT() {
  return useContext(I18nContext).t;
}
