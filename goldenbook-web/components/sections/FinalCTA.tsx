'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { CTAButton } from '@/components/ui/CTAButton'
import { AnimatedSection } from '@/components/ui/AnimatedSection'

export function FinalCTA() {
  const t = useTranslations('finalCta')

  return (
    <section id="download" className="relative overflow-hidden bg-ivory" aria-label="Download Goldenbook Go">
      {/* Thin gold border top */}
      <div className="h-px bg-primary/20" />

      <div className="section-padding py-28 md:py-40">
        <div className="max-w-3xl">
          <AnimatedSection>
            <p className="eyebrow mb-6">{t('eyebrow')}</p>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <h2 className="headline-hero text-ink mb-8 whitespace-pre-line">
              {t('headline')}
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <p className="font-sans text-ink-muted/65 text-body max-w-md leading-relaxed mb-12">
              {t('subheadline')}
            </p>
          </AnimatedSection>

          <AnimatedSection delay={0.3}>
            <div className="flex flex-wrap gap-4 mb-8">
              <CTAButton
                href={process.env.NEXT_PUBLIC_APP_STORE_URL ?? '#'}
                variant="navy"
                store="apple"
                size="lg"
              >
                {t('appStore')}
              </CTAButton>
              <CTAButton
                href={process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '#'}
                variant="outline"
                store="google"
                size="lg"
                className="!text-ink !border-ink/20 hover:!border-ink/40"
              >
                {t('googlePlay')}
              </CTAButton>
            </div>

            <p className="font-sans text-caption text-ink-muted/40 tracking-wide uppercase">
              {t('free')}
            </p>
          </AnimatedSection>
        </div>

        {/* Decorative gold line — right side */}
        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          whileInView={{ scaleY: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ originY: 0 }}
          className="absolute right-24 top-16 bottom-16 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent hidden lg:block"
        />
      </div>
    </section>
  )
}
