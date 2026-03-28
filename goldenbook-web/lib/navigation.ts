// ─── next-intl typed navigation utilities ────────────────────────────────────
// Use these in place of next/link and next/navigation whenever you need
// locale-aware routing. The `Link` component accepts a `locale` prop that
// switches locale AND sets the NEXT_LOCALE cookie so the middleware does not
// redirect based on the browser's Accept-Language header.

import { createNavigation } from 'next-intl/navigation'

export const locales = ['en', 'pt', 'es'] as const
export type Locale = (typeof locales)[number]

export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
})
