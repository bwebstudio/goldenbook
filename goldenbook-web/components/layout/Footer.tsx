'use client'

import { Link } from '@/lib/navigation'
import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')
  const year = new Date().getFullYear()

  return (
    <footer className="bg-navy-dark">
      <div className="section-padding py-16 md:py-20">
        {/* Top row */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10 md:gap-0 pb-12 border-b border-ivory/8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span
                className="font-sans text-[18px] font-bold uppercase text-ivory"
                style={{ letterSpacing: '0.18em' }}
              >
                Goldenbook Go
              </span>
            </div>
            <p className="font-sans text-ivory/40 text-small">{t('tagline')}</p>
            <p className="font-sans text-ivory/30 text-caption mt-2 tracking-wide">
              {t('cities')}
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {(['about', 'privacy', 'terms', 'contact'] as const).map((key) => (
              <Link
                key={key}
                href={`/${key}`}
                className="font-sans text-small text-ivory/40 hover:text-ivory/70 transition-colors duration-200 no-underline"
              >
                {t(`links.${key}`)}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom row */}
        <div className="pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="font-sans text-caption text-ivory/25">
            {t('copyright', { year })}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-px bg-primary/30" />
            <p className="font-sans text-caption text-ivory/20 tracking-widest uppercase">
              The curated guide
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
