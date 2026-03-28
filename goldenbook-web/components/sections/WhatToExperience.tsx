'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { getTimeSlot, type TimeSlot } from '@/lib/time'
import type { WebHomeDTO } from '@/lib/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

interface WhatToExperienceProps {
  slots: WebHomeDTO['experienceNow']
}

// Stroke-style time-of-day icons — consistent with CategoryIcon visual language
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

const SLOT_LABELS: Record<TimeSlot, string> = {
  morning:   'Morning',
  afternoon: 'Afternoon',
  evening:   'Evening',
  night:     'Night',
}

// Fixed order so tabs always appear in the correct sequence
const SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening', 'night']

export function WhatToExperience({ slots }: WhatToExperienceProps) {
  const t = useTranslations('whatNow')
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('morning')

  // Default to the slot that matches the user's local time, on mount only
  useEffect(() => {
    const current = getTimeSlot()
    // Fall back to first available slot if current time slot has no data
    const available = SLOT_ORDER.filter((s) => slots[s] !== null)
    if (available.includes(current)) {
      setActiveSlot(current)
    } else if (available.length > 0) {
      setActiveSlot(available[0])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const availableSlots = SLOT_ORDER.filter((s) => slots[s] !== null)

  if (availableSlots.length === 0) return null

  // Ensure activeSlot is always valid (guard against stale state)
  const safeSlot: TimeSlot = availableSlots.includes(activeSlot) ? activeSlot : availableSlots[0]
  const place = slots[safeSlot]

  return (
    <section
      className="relative min-h-screen flex flex-col justify-end overflow-hidden"
      aria-label="What to experience now"
    >
      {/* ── Background image with soft fade ──────────────────────────── */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`bg-${safeSlot}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
          className="absolute inset-0 pointer-events-none"
        >
          {place?.imageUrl ? (
            <>
              <Image
                src={place.imageUrl}
                alt={place.name}
                fill
                sizes="100vw"
                className="object-cover"
                quality={90}
                priority
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-dark via-navy-dark/50 to-navy-dark/10" />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(160deg, #161E38 0%, #222D52 100%)' }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Time slot tabs ───────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="section-padding pt-8 flex gap-2 overflow-x-auto scrollbar-hide">
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
                    : 'bg-navy-dark/40 text-ivory/50 hover:text-ivory/80 hover:bg-navy-dark/60',
                ].join(' ')}
              >
                <Icon className="w-3.5 h-3.5" />
                {SLOT_LABELS[s]}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content with soft fade ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`content-${safeSlot}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative z-10 section-padding pb-20 md:pb-28"
        >
          <p className="eyebrow mb-4">{t('eyebrow')}</p>

          <p className="font-sans text-ivory/50 text-small mb-2">
            {t(safeSlot)}
          </p>

          {place ? (
            <>
              <h2 className="headline-section text-ivory mb-4 max-w-2xl">{place.name}</h2>

              {place.category && (
                <div className="flex items-center gap-3 mb-6">
                  <CategoryIcon iconName={place.iconName ?? null} className="w-5 h-5 text-primary" />
                  <span className="font-sans text-primary text-small">{place.category}</span>
                </div>
              )}

              {place.description && (
                <p className="font-sans text-ivory/65 text-body max-w-md leading-relaxed mb-10">
                  {place.description}
                </p>
              )}

              <a
                href="#download"
                className="inline-flex items-center gap-3 font-sans text-body text-ivory group"
              >
                <span className="border-b border-ivory/30 pb-0.5 group-hover:border-primary group-hover:text-primary transition-colors duration-200">
                  {t('explore')}
                </span>
                <span className="text-primary group-hover:translate-x-1 transition-transform duration-200">
                  →
                </span>
              </a>
            </>
          ) : (
            <p className="font-sans text-ivory/40 text-body">No recommendation available right now.</p>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
