// ─── Editorial image system ──────────────────────────────────────────────────
// ONLY local assets from /public/images/ are used.
// DB images are a last-resort fallback — never the primary source.

import type { TimeSlot } from './time'

// ─── Time → Image + Mood mapping ────────────────────────────────────────────

export type Mood = 'calm' | 'vibrant' | 'relaxed' | 'intimate'

interface TimeConfig {
  image: string
  mood: Mood
}

export const TIME_CONFIG: Record<TimeSlot, TimeConfig> = {
  morning: {
    image: '/images/morning-lisbon2.png',
    mood: 'calm',
  },
  afternoon: {
    image: '/images/sunset-lisbon.png',
    mood: 'vibrant',
  },
  evening: {
    image: '/images/coastal-cascais.png',
    mood: 'relaxed',
  },
  night: {
    image: '/images/lisboa-night.png',
    mood: 'intimate',
  },
}

// ─── Section image registry ─────────────────────────────────────────────────

export type ImageSection = 'hero' | 'goldenPicks' | 'routes' | 'categories'

const CURATED: Record<ImageSection, string[]> = {
  hero: [
    '/images/sunset-lisbon.png',
    '/images/lisboa-night.png',
    '/images/coastal-cascais.png',
  ],
  goldenPicks: [
    '/images/luxury-hotel-lisboa.png',
    '/images/main_palacio-biester.jpg',
    '/images/sunset-lisbon.png',
  ],
  routes: [
    '/images/architectural-lisbon.png',
    '/images/morning-lisbon2.png',
    '/images/luxury-restaurante.png',
    '/images/coastal-cascais.png',
  ],
  categories: [
    '/images/architectural-lisbon.png',
    '/images/morning-lisbon.png',
  ],
}

const DEFAULT_FALLBACK = '/images/sunset-lisbon.png'

/**
 * Returns the best image for a given section and index.
 *
 * Priority:
 *  1. Curated local asset (by section + index)
 *  2. DB image (explicit fallback only)
 *  3. Wrap-around curated or default
 */
export function getBestImage(opts: {
  section: ImageSection
  index?: number
  dbImageUrl?: string | null
}): string {
  const { section, index = 0, dbImageUrl } = opts
  const curated = CURATED[section]

  if (curated[index]) return curated[index]
  if (dbImageUrl) return dbImageUrl
  if (curated.length > 0) return curated[index % curated.length]
  return DEFAULT_FALLBACK
}

/**
 * Returns the curated local image for a time slot.
 */
export function getNowSlotImage(slot: TimeSlot): string {
  return TIME_CONFIG[slot].image
}

/**
 * Returns the mood for a time slot.
 */
export function getNowSlotMood(slot: TimeSlot): Mood {
  return TIME_CONFIG[slot].mood
}
