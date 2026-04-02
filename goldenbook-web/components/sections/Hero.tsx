'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { CTAButton } from '@/components/ui/CTAButton'
import { env } from '@/lib/env'
import { getBestImage } from '@/lib/images'

interface HeroProps {
  imageUrl?: string | null
  cityName?: string | null
}

export function Hero({ imageUrl, cityName }: HeroProps) {
  const t = useTranslations('hero')
  const src = getBestImage({ section: 'hero', index: 0, dbImageUrl: imageUrl })

  return (
    <section
      className="relative flex flex-col justify-end min-h-screen overflow-hidden"
      aria-label="Hero"
    >
      {/* ── Background image ───────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <Image
          src={src}
          alt={cityName ?? 'City'}
          fill
          sizes="100vw"
          className="object-cover editorial-image"
          quality={90}
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(10,10,10,0.55), rgba(10,10,10,0.15))',
          }}
        />
      </motion.div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 section-padding pb-24 md:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="w-10 h-px bg-primary" />
          <span className="eyebrow">{t('eyebrow')}</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="headline-hero text-ivory mb-8 max-w-3xl"
        >
          The city,
          <br />
          <span className="text-primary italic">curated.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.75 }}
          className="font-sans text-ivory/55 text-body max-w-sm leading-relaxed mb-12"
        >
          {t('subheadline')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.95 }}
          className="flex flex-wrap gap-3"
        >
          <CTAButton href={env.appStoreUrl} variant="gold" store="apple" size="md">
            {t('cta.appStore')}
          </CTAButton>
          <CTAButton href={env.playStoreUrl} variant="outline" store="google" size="md">
            {t('cta.googlePlay')}
          </CTAButton>
        </motion.div>
      </div>

      {/* ── Scroll indicator ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="absolute bottom-8 right-8 md:right-24 flex flex-col items-center gap-3"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-2"
        >
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-primary/50 to-primary" />
          <div className="w-1 h-1 rounded-full bg-primary" />
        </motion.div>
      </motion.div>

      {/* ── City label ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-6 md:left-24"
      >
        <p className="font-sans text-ivory/30 text-caption tracking-widest uppercase">
          Lisboa · Porto · Algarve · Madeira
        </p>
      </motion.div>
    </section>
  )
}
