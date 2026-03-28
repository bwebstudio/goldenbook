'use client'

import { useTranslations } from 'next-intl'
import { AnimatedSection } from '@/components/ui/AnimatedSection'
import { GoldenPickItem } from '@/components/ui/GoldenPickItem'
import type { WebPlaceDTO } from '@/lib/types'

interface GoldenPicksProps {
  picks: WebPlaceDTO[]
}

export function GoldenPicks({ picks }: GoldenPicksProps) {
  const t = useTranslations('goldenPicks')

  const layouts = ['imageRight', 'imageLeft', 'fullWidth'] as const
  const limitedPicks = picks.slice(0, 3)

  return (
    <section id="picks" className="bg-ivory" aria-label="Golden Picks">
      {/* ── Section header ──────────────────────────────────────────────── */}
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

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <AnimatedSection>
        <div className="section-padding">
          <div className="h-px bg-ink/8" />
        </div>
      </AnimatedSection>

      {/* ── Picks — editorial layout ────────────────────────────────────── */}
      <div className="mt-4">
        {limitedPicks.map((place, i) => (
          <div key={place.id} className={i < limitedPicks.length - 1 ? 'mb-1' : ''}>
            <GoldenPickItem
              place={place}
              index={i}
              layout={layouts[i] ?? 'imageRight'}
            />
          </div>
        ))}
      </div>

      {/* ── View all CTA ────────────────────────────────────────────────── */}
      <AnimatedSection>
        <div className="section-padding py-16 md:py-20">
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
