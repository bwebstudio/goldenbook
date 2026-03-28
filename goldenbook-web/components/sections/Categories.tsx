'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { AnimatedSection, StaggerChildren, staggerItem } from '@/components/ui/AnimatedSection'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { WebCategoryDTO } from '@/lib/types'

interface CategoriesProps {
  categories: WebCategoryDTO[]
}

// Translation key lookup — maps backend category key → i18n key suffix.
// Falls back to the backend name if no match.
const I18N_KEY_MAP: Record<string, string> = {
  restaurants: 'restaurants',
  restaurant:  'restaurants',
  cafes:       'cafes',
  cafe:        'cafes',
  coffee:      'cafes',
  culture:     'culture',
  museum:      'culture',
  gallery:     'culture',
  shopping:    'shopping',
  shop:        'shopping',
  bars:        'bars',
  bar:         'bars',
  wine:        'bars',
  nature:      'nature',
  park:        'nature',
  outdoor:     'nature',
  experiences: 'experiences',
  experience:  'experiences',
  hotels:      'hotels',
  hotel:       'hotels',
}

export function Categories({ categories }: CategoriesProps) {
  const t = useTranslations('categories')

  // If no categories from backend, render nothing rather than an empty section
  if (categories.length === 0) return null

  return (
    <section id="cities" className="bg-ivory" aria-label="Categories">
      <div className="section-padding py-24 md:py-32">
        {/* Header */}
        <AnimatedSection className="mb-14 md:mb-16">
          <p className="eyebrow mb-3">{t('eyebrow')}</p>
          <h2 className="headline-section text-ink max-w-md whitespace-pre-line">
            {t('headline')}
          </h2>
        </AnimatedSection>

        {/* Divider */}
        <div className="h-px bg-ink/8 mb-12 md:mb-16" />

        {/* Category grid */}
        <StaggerChildren
          className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-y-8 gap-x-4"
          staggerDelay={0.06}
        >
          {categories.map((cat) => {
            // Resolve display name: prefer i18n translation, fall back to backend name
            const i18nKey = I18N_KEY_MAP[cat.key.toLowerCase()]
            let displayName: string
            try {
              displayName = i18nKey
                ? (t(i18nKey as Parameters<typeof t>[0]) as string)
                : cat.name
            } catch {
              displayName = cat.name
            }

            return (
              <motion.a
                key={cat.key}
                href="#download"
                variants={staggerItem}
                className="flex flex-col items-center gap-3 group cursor-pointer no-underline"
              >
                {/* Icon container */}
                <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-ivory-soft text-ink-muted group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300">
                  <CategoryIcon
                    iconName={cat.iconName ?? cat.key}
                    className="w-5 h-5 md:w-6 md:h-6"
                  />
                </div>

                {/* Label */}
                <span className="font-sans text-small text-ink-muted text-center leading-tight group-hover:text-ink transition-colors duration-200">
                  {displayName}
                </span>

                {/* Gold underline on hover */}
                <div className="h-px w-0 bg-primary group-hover:w-full transition-all duration-300" />
              </motion.a>
            )
          })}
        </StaggerChildren>
      </div>
    </section>
  )
}
