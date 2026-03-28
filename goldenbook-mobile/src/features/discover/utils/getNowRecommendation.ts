import type { TimeSegment } from '@/types/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NowCopy {
  eyebrow: string
  headline: string
  supportingText: string
}

// ─── Client-side time segment ─────────────────────────────────────────────────
// Used to generate copy from the user's local time, independent of server time.

export function getClientTimeSegment(): TimeSegment {
  const hour = new Date().getHours()
  if (hour >= 6 && hour <= 10) return 'morning'
  if (hour >= 11 && hour <= 14) return 'midday'
  if (hour >= 15 && hour <= 18) return 'afternoon'
  if (hour >= 19 && hour <= 21) return 'evening'
  return 'night'
}

// ─── Copy builder ─────────────────────────────────────────────────────────────
// Generates contextual copy based on the time segment and city name.
// This intentionally avoids generic editorial copy — every string must answer
// "what should I do right now?" not "what are the best places in this city?".

export function buildNowCopy(timeSegment: TimeSegment, cityName: string): NowCopy {
  const city = cityName

  const eyebrows: Record<TimeSegment, string> = {
    morning:   `RIGHT NOW IN ${city.toUpperCase()}`,
    midday:    `FOR THIS MOMENT IN ${city.toUpperCase()}`,
    afternoon: `YOUR GOLDENBOOK NOW`,
    evening:   `PERFECT RIGHT NOW IN ${city.toUpperCase()}`,
    night:     `FOR THIS EVENING IN ${city.toUpperCase()}`,
  }

  const headlines: Record<TimeSegment, string> = {
    morning:   'A perfect late-morning stop',
    midday:    `Ideal for right now in ${city}`,
    afternoon: 'Just right for a slow afternoon',
    evening:   'The kind of place to experience this evening',
    night:     'A beautiful spot for tonight',
  }

  const supporting: Record<TimeSegment, string> = {
    morning:   'Open now · Calm atmosphere · Central',
    midday:    'Open now · Central location',
    afternoon: 'Open now · Worth every moment',
    evening:   'Open now · Elegant · Tonight',
    night:     'Open now · For the night ahead',
  }

  return {
    eyebrow:       eyebrows[timeSegment],
    headline:      headlines[timeSegment],
    supportingText: supporting[timeSegment],
  }
}
