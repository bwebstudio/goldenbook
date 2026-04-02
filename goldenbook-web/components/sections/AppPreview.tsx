'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { AnimatedSection } from '@/components/ui/AnimatedSection'

// ─── Screenshot paths ─────────────────────────────────────────────────────────
// Place PNG files at these paths inside /public/
const SCREENSHOTS = {
  discover:   '/images/app/discover-home.png',
  placeDetail: '/images/app/place-detail.png',
  routes:     '/images/app/routes.png',
  concierge:  '/images/app/concierge.png',
  onboarding: '/images/app/onboarding-interests.png',
} as const

// ─── Phone mockup ─────────────────────────────────────────────────────────────
// CSS iPhone frame. The inner screen renders the actual screenshot via
// next/image. When the screenshot file doesn't exist yet, a navy placeholder
// is shown so the layout never breaks.

interface PhoneMockupProps {
  screenshot: string
  alt: string
  angle?: number
  zIndex?: number
  priority?: boolean
}

function PhoneMockup({
  screenshot,
  alt,
  angle = 0,
  zIndex = 0,
  priority = false,
}: PhoneMockupProps) {
  return (
    <div
      className="relative flex-shrink-0"
      style={{
        transform: `rotate(${angle}deg)`,
        zIndex,
        filter: 'drop-shadow(0 32px 64px rgba(22,30,56,0.4))',
      }}
    >
      {/* Phone body */}
      <div
        className="relative rounded-[3rem] border-[2px] border-white/10"
        style={{ width: '240px', height: '490px', background: '#0F1520' }}
      >
        {/* Dynamic island */}
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black z-10"
          style={{ width: '100px', height: '30px' }}
        />

        {/* Screen area — clipped to phone shape */}
        <div
          className="absolute inset-[2px] rounded-[calc(3rem-2px)] overflow-hidden bg-navy-dark"
        >
          <Image
            src={screenshot}
            alt={alt}
            fill
            sizes="240px"
            className="object-cover object-top"
            priority={priority}
          />
          {/* Subtle vignette so content reads well against frame */}
          <div className="absolute inset-0 rounded-[calc(3rem-2px)] shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]" />
        </div>

        {/* Physical side buttons */}
        <div
          className="absolute left-[-2.5px] rounded-l-sm bg-white/10"
          style={{ top: '90px', width: '2px', height: '32px' }}
        />
        <div
          className="absolute left-[-2.5px] rounded-l-sm bg-white/10"
          style={{ top: '132px', width: '2px', height: '32px' }}
        />
        <div
          className="absolute right-[-2.5px] rounded-r-sm bg-white/10"
          style={{ top: '100px', width: '2px', height: '60px' }}
        />
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function AppPreview() {
  const t = useTranslations('appPreview')

  const features = [
    { key: 'feature1' as const, icon: '◆' },
    { key: 'feature2' as const, icon: '◈' },
    { key: 'feature3' as const, icon: '◉' },
  ]

  return (
    <section className="bg-navy-dark overflow-hidden" aria-label="App preview">
      <div className="section-padding py-28 md:py-36">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* ── Text side ─────────────────────────────────────────────── */}
          <div>
            <AnimatedSection>
              <p className="eyebrow mb-4">{t('eyebrow')}</p>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <h2 className="headline-section text-ivory mb-6 whitespace-pre-line">
                {t('headline')}
              </h2>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <p className="font-sans text-ivory/55 text-body leading-relaxed mb-12 max-w-sm">
                {t('subheadline')}
              </p>
            </AnimatedSection>

            {/* Features */}
            <div className="space-y-8">
              {features.map((f, i) => (
                <AnimatedSection key={f.key} delay={0.3 + i * 0.1}>
                  <div className="flex items-start gap-5">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <span className="text-primary text-small">{f.icon}</span>
                    </div>
                    <div>
                      <p className="font-sans text-ivory text-body font-medium mb-1">
                        {t(`${f.key}.title`)}
                      </p>
                      <p className="font-sans text-ivory/50 text-small leading-relaxed">
                        {t(`${f.key}.description`)}
                      </p>
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>

          {/* ── Phone composition ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative flex items-center justify-center"
            style={{ minHeight: '540px' }}
          >
            {/* Ambient glow */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: '340px',
                height: '340px',
                background: 'radial-gradient(circle, rgba(210,182,138,0.07) 0%, transparent 70%)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* Three-phone composition */}
            <div className="relative flex items-end justify-center gap-4">
              {/* Left — slightly receded */}
              <div className="hidden md:block" style={{ marginBottom: '20px' }}>
                <PhoneMockup
                  screenshot={SCREENSHOTS.onboarding}
                  alt="Goldenbook Go onboarding screen"
                  angle={-5}
                  zIndex={1}
                />
              </div>

              {/* Centre — hero phone */}
              <PhoneMockup
                screenshot={SCREENSHOTS.discover}
                alt="Goldenbook Go discover screen"
                angle={0}
                zIndex={2}
                priority
              />

              {/* Right — slightly receded */}
              <div className="hidden md:block" style={{ marginBottom: '20px' }}>
                <PhoneMockup
                  screenshot={SCREENSHOTS.placeDetail}
                  alt="Goldenbook Go place detail screen"
                  angle={5}
                  zIndex={1}
                />
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
