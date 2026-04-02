'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { AnimatedSection } from '@/components/ui/AnimatedSection'

// ─── Luxury archetype cards ─────────────────────────────────────────────────
// These are NOT database places — they are editorial lifestyle categories
// that position Goldenbook as a premium aspirational product.

const ARCHETYPES = [
  { key: 'stay',     image: '/images/luxury-hotel-lisboa.png' },
  { key: 'dine',     image: '/images/luxury-restaurante.png' },
  { key: 'discover', image: '/images/luxury-boutique.png' },
] as const

type ArchetypeKey = (typeof ARCHETYPES)[number]['key']

function EditorialCard({
  archetype,
  index,
}: {
  archetype: { key: ArchetypeKey; image: string }
  index: number
}) {
  const t = useTranslations('goldenPicks')

  // DINE (index 1): image left, text right — breaks the rhythm
  // STAY + DISCOVER: text left, image right
  const isImageLeft = archetype.key === 'dine'

  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-5%' }}
      transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-0"
    >
      {/* Image */}
      <div
        className={`relative overflow-hidden group ${isImageLeft ? 'lg:order-1' : 'lg:order-2'}`}
        style={{ aspectRatio: '4/3' }}
      >
        <Image
          src={archetype.image}
          alt={t(`archetype.${archetype.key}.title`)}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover editorial-image transition-transform duration-700 group-hover:scale-[1.03]"
          quality={90}
        />
      </div>

      {/* Text */}
      <div
        className={[
          'flex flex-col justify-center',
          'px-8 py-10 md:px-14 md:py-16 lg:py-20',
          isImageLeft ? 'lg:order-2' : 'lg:order-1',
          'bg-ivory-soft',
        ].join(' ')}
      >
        <p className="eyebrow mb-4">{t(`archetype.${archetype.key}.eyebrow`)}</p>
        <h3 className="headline-medium text-ink mb-6">
          {t(`archetype.${archetype.key}.title`)}
        </h3>
        <div className="w-8 h-px bg-primary mb-6" />
        <p className="font-sans text-ink-muted text-body leading-relaxed max-w-md">
          {t(`archetype.${archetype.key}.subtitle`)}
        </p>
      </div>
    </motion.article>
  )
}

export function GoldenPicks() {
  const t = useTranslations('goldenPicks')

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

      {/* ── Editorial archetype cards ───────────────────────────────────── */}
      <div>
        {ARCHETYPES.map((archetype, i) => (
          <EditorialCard key={archetype.key} archetype={archetype} index={i} />
        ))}
      </div>

      {/* ── View all CTA ────────────────────────────────────────────────── */}
      <AnimatedSection>
        <div className="section-padding py-16 md:py-20">
          <a href="#download" className="inline-flex items-center gap-3 font-sans text-body text-ink-muted group">
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
