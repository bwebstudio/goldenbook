'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { CTAButton } from '@/components/ui/CTAButton'
import { env } from '@/lib/env'

interface HeroProps {
  imageUrl?: string | null
  cityName?: string | null
}

export function Hero({ imageUrl, cityName }: HeroProps) {
  const t = useTranslations('hero')

  return (
    <section
      className="relative flex flex-col justify-end min-h-screen overflow-hidden"
      aria-label="Hero"
    >
      {/* ── Background ──────────────────────────────────────────────────── */}
      {/* Base navy layer — always present */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, #161E38 0%, #222D52 45%, #161E38 100%)',
        }}
      />

      {/* Real city image from backend — fades over the base layer */}
      {imageUrl && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        >
          <Image
            src={imageUrl}
            alt={cityName ?? 'City'}
            fill
            sizes="100vw"
            className="object-cover"
            quality={90}
            priority
            unoptimized
          />
          {/* Navy overlay to keep text readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-dark via-navy-dark/60 to-navy-dark/20" />
        </motion.div>
      )}

      {/* Decorative geometric overlay when no real image */}
      {!imageUrl && (
        <>
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
            {[15, 28, 42, 55, 68, 78].map((pos) => (
              <div
                key={pos}
                className="absolute bottom-0 w-px"
                style={{
                  left: `${pos}%`,
                  height: `${30 + Math.sin(pos) * 20}%`,
                  background: 'linear-gradient(to top, rgba(210,182,138,0.15), transparent)',
                }}
              />
            ))}
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 50% 30% at 75% 30%, rgba(210,182,138,0.07) 0%, transparent 70%)',
            }}
          />
        </>
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 section-padding pb-24 md:pb-32">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="w-10 h-px bg-primary" />
          <span className="eyebrow">{t('eyebrow')}</span>
        </motion.div>

        {/* Main headline */}
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

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.75 }}
          className="font-sans text-ivory/55 text-body max-w-sm leading-relaxed mb-12"
        >
          {t('subheadline')}
        </motion.p>

        {/* CTAs */}
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
