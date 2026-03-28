'use client'

import { CTAButton } from '@/components/ui/CTAButton'
import { Link as LocaleLink, usePathname as useIntlPathname } from '@/lib/navigation'
import { motion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const LOCALES = ['en', 'pt', 'es'] as const
const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  pt: 'PT',
  es: 'ES',
}

function GoldenbookLogo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 no-underline group">
      {/* Gold dot */}
      <div className="w-2 h-2 rounded-full bg-primary group-hover:scale-125 transition-transform duration-200" />
      <span
        className={[
          'font-sans text-18px] font-bold uppercase',
          dark ? 'text-navy-dark' : 'text-ivory',
        ].join(' ')}
        style={{ letterSpacing: '0.18em' }}
      >
        Goldenbook
      </span>
    </Link>
  )
}

export function NavBar() {
  const t = useTranslations('nav')
  const currentLocale = useLocale()
  const intlPathname = useIntlPathname()  // locale-stripped pathname, e.g. "/about"
  const [menuOpen, setMenuOpen] = useState(false)

  // On the homepage the navbar starts transparent and becomes solid on scroll.
  // On inner pages (about, privacy, terms, contact) the background is white from
  // the very top, so we always show the solid state.
  const isHomepage = intlPathname === '/'
  const [scrolled, setScrolled] = useState(!isHomepage)

  useEffect(() => {
    if (!isHomepage) {
      setScrolled(true)
      return
    }
    setScrolled(window.scrollY > 60)
    const handleScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isHomepage])

  const linkClass = [
    'font-sans text-small transition-colors duration-200',
    scrolled ? 'text-ink-muted hover:text-ink' : 'text-ivory/65 hover:text-ivory',
  ].join(' ')

  return (
    <motion.header
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-ivory/95 backdrop-blur-md border-b border-ink/5'
          : 'bg-transparent',
      ].join(' ')}
    >
      <nav className="section-padding py-5 flex items-center justify-between">
        {/* Logo */}
        <GoldenbookLogo dark={scrolled} />

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="#picks" className={linkClass}>
            {t('picks')}
          </Link>
          <Link href="#routes" className={linkClass}>
            {t('routes')}
          </Link>
          <Link href="#cities" className={linkClass}>
            {t('cities')}
          </Link>
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-6 pointer-events-auto">
          {/* Language switcher — uses next-intl Link with locale prop so that
              clicking EN always sets NEXT_LOCALE=en cookie and prevents the
              middleware from re-detecting locale from Accept-Language header */}
          <div className="flex items-center gap-2">
            {LOCALES.map((locale) => (
              <LocaleLink
                key={locale}
                href={intlPathname}
                locale={locale}
                className={[
                  'font-sans text-caption transition-colors duration-200',
                  locale === currentLocale
                    ? scrolled
                      ? 'text-ink font-medium'
                      : 'text-primary font-medium'
                    : scrolled
                      ? 'text-ink-muted/50 hover:text-ink-muted'
                      : 'text-ivory/35 hover:text-ivory/60',
                ].join(' ')}
              >
                {LOCALE_LABELS[locale]}
              </LocaleLink>
            ))}
          </div>

          {/* Download CTA */}
          <CTAButton
            href="#download"
            variant={scrolled ? 'navy' : 'gold'}
            size="sm"
          >
            {t('download')}
          </CTAButton>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <motion.div
            animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
            className={`w-6 h-px ${scrolled ? 'bg-ink' : 'bg-ivory'}`}
          />
          <motion.div
            animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
            className={`w-6 h-px ${scrolled ? 'bg-ink' : 'bg-ivory'}`}
          />
          <motion.div
            animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
            className={`w-6 h-px ${scrolled ? 'bg-ink' : 'bg-ivory'}`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      <motion.div
        initial={false}
        animate={menuOpen ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="overflow-hidden bg-ivory border-t border-ink/8 md:hidden"
      >
        <div className="section-padding py-6 flex flex-col gap-5">
          <Link href="#picks" className="font-sans text-body text-ink-muted hover:text-ink" onClick={() => setMenuOpen(false)}>
            {t('picks')}
          </Link>
          <Link href="#routes" className="font-sans text-body text-ink-muted hover:text-ink" onClick={() => setMenuOpen(false)}>
            {t('routes')}
          </Link>
          <Link href="#cities" className="font-sans text-body text-ink-muted hover:text-ink" onClick={() => setMenuOpen(false)}>
            {t('cities')}
          </Link>

          <div className="h-px bg-ink/8" />

          <div className="flex items-center gap-4">
            {LOCALES.map((locale) => (
              <LocaleLink
                key={locale}
                href={intlPathname}
                locale={locale}
                className={[
                  'font-sans text-small',
                  locale === currentLocale ? 'text-ink font-medium' : 'text-ink-muted/50',
                ].join(' ')}
                onClick={() => setMenuOpen(false)}
              >
                {LOCALE_LABELS[locale]}
              </LocaleLink>
            ))}
          </div>

          <CTAButton href="#download" variant="navy" size="md" className="w-full justify-center">
            {t('download')}
          </CTAButton>
        </div>
      </motion.div>
    </motion.header>
  )
}
