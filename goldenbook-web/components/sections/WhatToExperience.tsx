'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { getTimeSlot, type TimeSlot } from '@/lib/time'
import type { WebHomeDTO } from '@/lib/types'
import { getNowSlotImage, getNowSlotMood } from '@/lib/images'

interface WhatToExperienceProps {
  slots: WebHomeDTO['experienceNow']
}

// Stroke-style time-of-day icons
function MorningSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function AfternoonSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 12a5 5 0 1 1-10 0" />
      <path d="M12 2v2M4.22 4.22l1.42 1.42M2 12h2M4.22 19.78l1.42-1.42M12 20v2M19.78 19.78l-1.42-1.42M22 12h-2M19.78 4.22l-1.42 1.42" />
      <line x1="2" x2="22" y1="20" y2="20" />
    </svg>
  )
}

function EveningSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 10V2" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m8 6 4-4 4 4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  )
}

function NightSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

const SLOT_ICONS: Record<TimeSlot, (p: { className?: string }) => JSX.Element> = {
  morning:   MorningSVG,
  afternoon: AfternoonSVG,
  evening:   EveningSVG,
  night:     NightSVG,
}

const SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening', 'night']

export function WhatToExperience({ slots }: WhatToExperienceProps) {
  const t = useTranslations('whatNow')
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('morning')

  useEffect(() => {
    const current = getTimeSlot()
    const available = SLOT_ORDER.filter((s) => slots[s] !== null)
    if (available.includes(current)) {
      setActiveSlot(current)
    } else if (available.length > 0) {
      setActiveSlot(available[0])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const availableSlots = SLOT_ORDER.filter((s) => slots[s] !== null)
  if (availableSlots.length === 0) return null

  const safeSlot: TimeSlot = availableSlots.includes(activeSlot) ? activeSlot : availableSlots[0]
  const place = slots[safeSlot]
  const mood = getNowSlotMood(safeSlot)
  const imageSrc = getNowSlotImage(safeSlot)

  return (
    <section
      className="bg-navy-dark"
      aria-label="What to experience now"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[85vh]">
        {/* ── Image side ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden min-h-[50vh] lg:min-h-full group">
          <AnimatePresence mode="sync">
            <motion.div
              key={`bg-${safeSlot}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute inset-0"
            >
              <Image
                src={imageSrc}
                alt={t(`mood.${mood}.title`)}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover editorial-image transition-transform duration-700 group-hover:scale-[1.03]"
                quality={90}
                priority
              />
              {/* Right-fade overlay for text readability on content side */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(to right, rgba(10,10,10,0.05), rgba(10,10,10,0.55))',
                }}
              />
            </motion.div>
          </AnimatePresence>

          {/* Bottom gradient on mobile */}
          <div
            className="absolute inset-0 lg:hidden pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, transparent 50%, rgba(22,30,56,0.6))',
            }}
          />
        </div>

        {/* ── Content side ────────────────────────────────────────────── */}
        <div className="flex flex-col justify-center px-8 py-16 md:px-14 md:py-20 lg:px-20 lg:py-24">
          {/* Time slot tabs */}
          <div className="flex gap-2 mb-12 overflow-x-auto scrollbar-hide">
            {availableSlots.map((s) => {
              const Icon = SLOT_ICONS[s]
              const isActive = s === safeSlot
              return (
                <button
                  key={s}
                  onClick={() => setActiveSlot(s)}
                  className={[
                    'flex-shrink-0 flex items-center gap-1.5 font-sans text-small px-4 py-2 rounded-full transition-all duration-300',
                    isActive
                      ? 'bg-primary text-navy-dark font-medium'
                      : 'bg-ivory/8 text-ivory/50 hover:text-ivory/80 hover:bg-ivory/12',
                  ].join(' ')}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(`tab.${s}`)}
                </button>
              )
            })}
          </div>

          {/* Mood-driven editorial copy */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`content-${safeSlot}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <p className="eyebrow mb-6">{t(`mood.${mood}.eyebrow`)}</p>

              <h2 className="headline-section text-ivory mb-5">
                {t(`mood.${mood}.title`)}
              </h2>

              <div className="w-8 h-px bg-primary mb-6" />

              <p className="font-sans text-ivory/50 text-body max-w-sm leading-relaxed mb-10">
                {t(`mood.${mood}.subtitle`)}
              </p>

              {/* Place info from DB — secondary to the mood copy */}
              {place && (
                <div className="border-t border-ivory/10 pt-8">
                  <p className="font-sans text-primary text-small uppercase tracking-wider font-medium mb-2">
                    {t('suggestion')}
                  </p>
                  <p className="headline-small text-ivory mb-2">{place.name}</p>
                  {place.category && (
                    <p className="font-sans text-ivory/40 text-small">{place.category}</p>
                  )}
                  {place.description && (
                    <p className="font-sans text-ivory/45 text-small leading-relaxed mt-3 max-w-sm line-clamp-2">
                      {place.description}
                    </p>
                  )}
                </div>
              )}

              <a
                href="#download"
                className="inline-flex items-center gap-3 font-sans text-body text-ivory group mt-10"
              >
                <span className="border-b border-ivory/30 pb-0.5 group-hover:border-primary group-hover:text-primary transition-colors duration-200">
                  {t('explore')}
                </span>
                <span className="text-primary group-hover:translate-x-1 transition-transform duration-200">
                  →
                </span>
              </a>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
