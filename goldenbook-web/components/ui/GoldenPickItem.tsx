'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import type { WebPlaceDTO } from '@/lib/types'

interface GoldenPickItemProps {
  place: WebPlaceDTO
  index: number
  layout?: 'imageRight' | 'imageLeft' | 'fullWidth'
}

/** Ivory gradient shown when a place has no image yet. */
function ImagePlaceholder() {
  return (
    <div
      className="w-full h-full"
      style={{
        background: 'linear-gradient(135deg, #222D52 0%, #161E38 100%)',
      }}
    />
  )
}

export function GoldenPickItem({ place, index, layout = 'imageRight' }: GoldenPickItemProps) {
  const t = useTranslations('goldenPicks')

  if (layout === 'fullWidth') {
    return (
      <motion.article
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-5%' }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '21/9' }}
      >
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt={place.name}
            fill
            sizes="100vw"
            className="object-cover"
            quality={90}
            priority={index === 0}
            unoptimized
          />
        ) : (
          <ImagePlaceholder />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-dark/90 via-navy-dark/50 to-transparent" />
        <div className="absolute inset-0 flex items-end p-12 md:p-20">
          <div className="max-w-xl">
            {place.category && <p className="eyebrow mb-3">{place.category}</p>}
            <h3 className="headline-medium text-ivory mb-4">{place.name}</h3>
            <div className="w-8 h-px bg-primary mb-4" />
            {place.whyWeLoveIt && (
              <p className="font-sans text-ivory/70 text-body leading-relaxed line-clamp-2">
                {place.whyWeLoveIt}
              </p>
            )}
          </div>
        </div>
      </motion.article>
    )
  }

  const isImageLeft = layout === 'imageLeft'

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
        className={`relative overflow-hidden ${isImageLeft ? 'lg:order-1' : 'lg:order-2'}`}
        style={{ aspectRatio: '4/3' }}
      >
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt={place.name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 hover:scale-[1.03]"
            quality={90}
            unoptimized
          />
        ) : (
          <ImagePlaceholder />
        )}
        <div className="absolute top-6 left-6">
          <span className="font-sans text-ivory/50 text-caption tracking-widest">
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>
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
        {place.category && <p className="eyebrow mb-4">{place.category}</p>}
        <h3 className="headline-medium text-ink mb-6">{place.name}</h3>
        <div className="w-8 h-px bg-primary mb-6" />

        {place.whyWeLoveIt && (
          <div>
            <p className="font-sans text-small text-primary uppercase tracking-wider font-medium mb-2">
              {t('whyWeLoveIt')}
            </p>
            <p className="font-sans text-ink-muted text-body leading-relaxed">
              {place.whyWeLoveIt}
            </p>
          </div>
        )}

        {place.address && (
          <p className="font-sans text-caption text-ink-muted/60 mt-6 tracking-wide">
            {place.address}
          </p>
        )}
      </div>
    </motion.article>
  )
}
