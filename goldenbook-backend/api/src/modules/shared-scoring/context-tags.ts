// ─── Context Tag System ──────────────────────────────────────────────────────
//
// Canonical registry of the 22 dashboard context tags.
// These tags are the ONLY source of contextual relevance — no invented tags.
//
// Weather and time-of-day boosts RANK candidates, they never FILTER them.
// A place with "Rainy Day" tag on a sunny day simply gets a lower context score,
// but remains eligible if other tags match.

import type { NowTimeOfDay, WeatherCondition } from './types'

// ─── The 22 dashboard context tags ──────────────────────────────────────────

export const CONTEXT_TAGS = [
  'brunch',
  'celebration',
  'cocktails',
  'coffee',
  'culture',
  'dinner',
  'family',
  'fine-dining',
  'late-night',
  'live-music',
  'local-secret',
  'quick-stop',
  'rainy-day',
  'romantic',
  'rooftop',
  'shopping',
  'sunday',
  'sunset',
  'terrace',
  'viewpoint',
  'wellness',
  'wine',
] as const

export type ContextTag = (typeof CONTEXT_TAGS)[number]

// ─── Time-of-day → tag boosts ───────────────────────────────────────────────
//
// Higher = more relevant at this time. Range: 0.0 – 1.0
// Tags not listed for a time window default to a small base score (0.15),
// ensuring they're never completely penalized — just ranked lower.

export const BASE_TIME_SCORE = 0.15

export const TIME_TAG_BOOSTS: Record<NowTimeOfDay, Partial<Record<ContextTag, number>>> = {
  morning: {
    'coffee':      1.0,
    'brunch':      1.0,
    'culture':     0.8,    // museums, municipalities, galleries — great morning visits
    'viewpoint':   0.8,    // miradouros, scenic walks
    'quick-stop':  0.8,
    'family':      0.7,    // family-friendly daytime activities
    'wellness':    0.6,
    'shopping':    0.4,
    'terrace':     0.4,
    'sunday':      0.3,
  },
  midday: {
    'brunch':      1.0,
    'quick-stop':  1.0,
    'culture':     0.8,    // cultural visits pair well with lunch
    'coffee':      0.7,
    'terrace':     0.6,
    'viewpoint':   0.6,
    'family':      0.6,
    'shopping':    0.5,
    'wellness':    0.4,
    'wine':        0.3,
  },
  afternoon: {
    'culture':     1.0,    // prime time for museums, galleries, municipalities
    'shopping':    0.9,
    'coffee':      0.8,
    'terrace':     0.7,
    'sunset':      0.6,
    'wellness':    0.6,
    'viewpoint':   0.6,
    'rooftop':     0.5,
    'wine':        0.5,
    'quick-stop':  0.5,
    'family':      0.5,
  },
  evening: {
    'dinner':      1.0,
    'fine-dining': 1.0,
    'sunset':      1.0,
    'cocktails':   0.9,
    'romantic':    0.9,
    'rooftop':     0.8,
    'wine':        0.8,
    'live-music':  0.7,
    'terrace':     0.6,
    'viewpoint':   0.5,
    'celebration': 0.5,
    'local-secret': 0.4,
  },
  night: {
    'late-night':  1.0,
    'cocktails':   1.0,
    'live-music':  0.9,
    'wine':        0.7,
    'dinner':      0.6,
    'fine-dining': 0.6,
    'romantic':    0.6,
    'celebration': 0.5,
    'local-secret': 0.4,
  },
}

// ─── Weather → tag boosts ───────────────────────────────────────────────────
//
// Positive = weather makes this tag more relevant.
// Negative = weather makes this tag less relevant (but never removes it).
// Tags not listed get 0 weather adjustment.

export const WEATHER_TAG_BOOSTS: Record<WeatherCondition, Partial<Record<ContextTag, number>>> = {
  sunny: {
    'terrace':     0.4,
    'rooftop':     0.4,
    'sunset':      0.3,
    'viewpoint':   0.3,
    'coffee':      0.1,
    'quick-stop':  0.1,
    'rainy-day':  -0.4,   // less relevant when sunny, but NOT removed
  },
  cloudy: {
    'culture':     0.2,
    'coffee':      0.1,
    'shopping':    0.1,
    'wellness':    0.1,
  },
  rainy: {
    'rainy-day':   0.6,   // strong boost
    'culture':     0.3,
    'coffee':      0.2,
    'shopping':    0.2,
    'wellness':    0.2,
    'wine':        0.1,
    'terrace':    -0.3,   // less appealing in rain
    'rooftop':    -0.3,
    'viewpoint':  -0.2,
    'sunset':     -0.2,
  },
  hot: {
    'wellness':    0.2,
    'coffee':      0.2,
    'rooftop':     0.1,
    'cocktails':   0.1,
    'rainy-day':  -0.3,
  },
  cold: {
    'coffee':      0.3,
    'wellness':    0.2,
    'culture':     0.2,
    'wine':        0.1,
    'rainy-day':   0.1,  // indoor plan is OK when cold
    'terrace':    -0.2,
    'rooftop':    -0.2,
  },
}

// ─── Editorial tags (curated quality signals) ───────────────────────────────
//
// These tags indicate editorial curation and get a bonus in editorialScore.

export const EDITORIAL_TAGS = new Set<ContextTag>([
  'local-secret',
  'romantic',
  'fine-dining',
  'culture',
  'wellness',
])

// ─── Tag display labels (i18n) ──────────────────────────────────────────────

export const TAG_LABELS: Record<ContextTag, Record<string, string>> = {
  'brunch':       { en: 'Brunch',         pt: 'Brunch',                 es: 'Brunch' },
  'celebration':  { en: 'Celebration',    pt: 'Celebração',             es: 'Celebración' },
  'cocktails':    { en: 'Cocktails',      pt: 'Cocktails',              es: 'Cócteles' },
  'coffee':       { en: 'Coffee',         pt: 'Café',                   es: 'Café' },
  'culture':      { en: 'Culture',        pt: 'Cultura',                es: 'Cultura' },
  'dinner':       { en: 'Dinner',         pt: 'Jantar',                 es: 'Cena' },
  'family':       { en: 'Family',         pt: 'Família',                es: 'Familia' },
  'fine-dining':  { en: 'Fine Dining',    pt: 'Fine Dining',            es: 'Alta cocina' },
  'late-night':   { en: 'Late Night',     pt: 'Noite',                  es: 'Noche' },
  'live-music':   { en: 'Live Music',     pt: 'Música ao vivo',         es: 'Música en vivo' },
  'local-secret': { en: 'Local Secret',   pt: 'Segredo local',          es: 'Secreto local' },
  'quick-stop':   { en: 'Quick Stop',     pt: 'Paragem rápida',         es: 'Parada rápida' },
  'rainy-day':    { en: 'Rainy Day',      pt: 'Dia de chuva',           es: 'Día de lluvia' },
  'romantic':     { en: 'Romantic',        pt: 'Romântico',              es: 'Romántico' },
  'rooftop':      { en: 'Rooftop',        pt: 'Rooftop',                es: 'Azotea' },
  'shopping':     { en: 'Shopping',        pt: 'Compras',                es: 'Compras' },
  'sunday':       { en: 'Sunday',          pt: 'Domingo',                es: 'Domingo' },
  'sunset':       { en: 'Sunset',          pt: 'Pôr do sol',             es: 'Atardecer' },
  'terrace':      { en: 'Terrace',         pt: 'Terraço',                es: 'Terraza' },
  'viewpoint':    { en: 'Viewpoint',       pt: 'Miradouro',              es: 'Mirador' },
  'wellness':     { en: 'Wellness',        pt: 'Bem-estar',              es: 'Bienestar' },
  'wine':         { en: 'Wine',            pt: 'Vinho',                  es: 'Vino' },
}

export function getTagLabel(tag: string, locale = 'en'): string {
  const lang = locale.split('-')[0]
  const t = tag as ContextTag
  return TAG_LABELS[t]?.[lang] ?? TAG_LABELS[t]?.['en'] ?? tag
}

// ─── City timezone mapping ──────────────────────────────────────────────────

const CITY_TIMEZONES: Record<string, string> = {
  lisbon: 'Europe/Lisbon', lisboa: 'Europe/Lisbon',
  porto: 'Europe/Lisbon', algarve: 'Europe/Lisbon',
  madeira: 'Atlantic/Madeira',
  barcelona: 'Europe/Madrid', madrid: 'Europe/Madrid',
  paris: 'Europe/Paris', london: 'Europe/London',
  rome: 'Europe/Rome', milan: 'Europe/Rome',
  amsterdam: 'Europe/Amsterdam', berlin: 'Europe/Berlin',
}

// ─── Time-of-day detection ──────────────────────────────────────────────────

/**
 * Get time-of-day for a city. Uses the city's timezone, not the server's.
 * Falls back to Europe/Lisbon if city is unknown.
 */
export function getNowTimeOfDay(date: Date = new Date(), citySlug?: string): NowTimeOfDay {
  const tz = (citySlug && CITY_TIMEZONES[citySlug]) || 'Europe/Lisbon'
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric', hour12: false, timeZone: tz,
  }).format(date)
  const hour = parseInt(hourStr, 10)

  if (hour >= 6 && hour < 11)  return 'morning'
  if (hour >= 11 && hour < 14) return 'midday'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}
