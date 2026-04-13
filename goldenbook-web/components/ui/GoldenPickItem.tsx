'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import type { WebPlaceDTO } from '@/lib/types'
import { getBestImage } from '@/lib/images'

interface GoldenPickItemProps {
  place: WebPlaceDTO
  index: number
  layout?: 'imageRight' | 'imageLeft' | 'fullWidth'
}

export function GoldenPickItem({ place, index, layout = 'imageRight' }: GoldenPickItemProps) {
  const t = useTranslations('goldenPicks')
  const src = getBestImage({ section: 'goldenPicks', index, dbImageUrl: place.imageUrl })

  if (layout === 'fullWidth') {
    return (
      <motion.article
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-5%' }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full overflow-hidden group"
        style={{ aspectRatio: '21/9' }}
      >
        <Image
          src={src}
          alt={place.name}
          fill
          sizes="100vw"
          className="object-cover editorial-image transition-transform duration-700 group-hover:scale-[1.03]"
          quality={90}
          priority={index === 0}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(10,10,10,0.55), rgba(10,10,10,0.2), transparent)',
          }}
        />
        <div className="absolute inset-0 flex items-end p-12 md:p-20">
          <div className="max-w-xl">
            {place.category && <p className="eyebrow mb-3">{place.category}</p>}
            <h3 className="headline-medium text-ivory mb-4">{place.name}</h3>
            <div className="w-8 h-px bg-primary mb-4" />
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
        className={`relative overflow-hidden group ${isImageLeft ? 'lg:order-1' : 'lg:order-2'}`}
        style={{ aspectRatio: '4/3' }}
      >
        <Image
          src={src}
          alt={place.name}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover editorial-image transition-transform duration-700 group-hover:scale-[1.03]"
          quality={90}
        />
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

        {place.address && (
          <p className="font-sans text-caption text-ink-muted/60 mt-6 tracking-wide">
            {place.address}
          </p>
        )}
      </div>
    </motion.article>
  )
}
