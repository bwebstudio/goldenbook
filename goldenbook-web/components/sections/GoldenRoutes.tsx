'use client'

import { useTranslations } from 'next-intl'
import { AnimatedSection } from '@/components/ui/AnimatedSection'
import { RouteCard } from '@/components/ui/RouteCard'
import type { WebRouteDTO } from '@/lib/types'

interface GoldenRoutesProps {
  routes: WebRouteDTO[]
}

export function GoldenRoutes({ routes }: GoldenRoutesProps) {
  const t = useTranslations('goldenRoutes')

  return (
    <section id="routes" className="bg-ivory-soft overflow-hidden" aria-label="Golden Routes">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="section-padding pt-28 pb-16 md:pt-36 md:pb-20">
        <AnimatedSection>
          <p className="eyebrow mb-4">{t('eyebrow')}</p>
        </AnimatedSection>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <AnimatedSection delay={0.1}>
            <h2 className="headline-section text-ink max-w-lg whitespace-pre-line">
              {t('headline')}
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={0.2} direction="left">
            <p className="font-sans text-ink-muted/65 text-body max-w-xs leading-relaxed">
              {t('subheadline')}
            </p>
          </AnimatedSection>
        </div>
      </div>

      {/* ── Horizontal scroll ───────────────────────────────────────────── */}
      <div className="pl-6 md:pl-12 lg:pl-24 pb-20 md:pb-28">
        <div className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide pr-6 md:pr-12 lg:pr-24">
          {routes.map((route, i) => (
            <RouteCard key={route.id} route={route} index={i} />
          ))}
        </div>
      </div>

      {/* ── View all ────────────────────────────────────────────────────── */}
      <AnimatedSection>
        <div className="section-padding pb-16">
          <a href="#" className="inline-flex items-center gap-3 font-sans text-body text-ink-muted group">
            <span className="border-b border-ink/20 pb-0.5 group-hover:border-primary group-hover:text-ink transition-colors duration-200">
              {t('viewAll')}
            </span>
            <span className="text-primary group-hover:translate-x-1 transition-transform duration-200">
              →
            </span>
          </a>
        </div>
      </AnimatedSection>
    </section>
  )
}
