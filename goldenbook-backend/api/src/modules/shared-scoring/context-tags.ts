// ─── Context Tag System ──────────────────────────────────────────────────────
//
// Canonical registry of the 23 dashboard context tags.
// These tags are the ONLY source of contextual relevance — no invented tags.
//
// Weather and time-of-day boosts RANK candidates, they never FILTER them.
// A place with "Rainy Day" tag on a sunny day simply gets a lower context score,
// but remains eligible if other tags match.

import type { NowTimeOfDay, WeatherCondition } from './types'

// ─── The 24 dashboard context tags ──────────────────────────────────────────

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
  'lunch',
  'nature',
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
    'nature':      0.8,    // gardens, beaches, parks at start of day
    'quick-stop':  0.8,
    'family':      0.7,    // family-friendly daytime activities
    'wellness':    0.6,
    'lunch':       0.4,    // some places open for early lunch
    'shopping':    0.4,
    'terrace':     0.4,
    'sunday':      0.3,
  },
  midday: {
    'lunch':       1.0,    // prime lunch time
    'brunch':      1.0,
    'quick-stop':  1.0,
    'culture':     0.8,    // cultural visits pair well with lunch
    'coffee':      0.7,
    'terrace':     0.6,
    'viewpoint':   0.6,
    'nature':      0.6,
    'family':      0.6,
    'shopping':    0.5,
    'wine':        0.4,
    'wellness':    0.4,
  },
  afternoon: {
    'culture':     1.0,    // prime time for museums, galleries, municipalities
    'shopping':    0.9,
    'coffee':      0.8,
    'terrace':     0.7,
    'sunset':      0.6,
    'wellness':    0.6,
    'viewpoint':   0.6,
    'nature':      0.6,
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
  late_evening: {
    // 22:00–02:00 — kitchens closed, dinner is OVER. NEVER list dinner /
    // fine-dining here: a "Cena en Lisboa" at 00:54 is the exact bug we are
    // killing. Only late-night drinking, music, and scenic spots survive.
    'late-night':   1.0,
    'cocktails':    1.0,
    'wine':         0.9,
    'live-music':   0.9,
    'rooftop':      0.8,
    'viewpoint':    0.6,   // night views still interesting
    'romantic':     0.5,   // intimate late-night drinks
    'local-secret': 0.4,
  },
  deep_night: {
    // 02:00–06:00 — only bars and hotels. No nature, beaches, landmarks.
    // The eligibility filter in scoring-engine.ts enforces this hard:
    // only bar, hotel, and restaurant+late-night survive.
    'late-night':   1.0,
    'cocktails':    1.0,
    'wine':         0.8,
    'wellness':     0.5,   // hotel spas
    'romantic':     0.4,   // hotel bars
    'rooftop':      0.4,   // hotel rooftops
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
    'nature':      0.3,
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
    'nature':     -0.3,
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
  'lunch':        { en: 'Lunch',          pt: 'Almoço',                 es: 'Almuerzo' },
  'nature':       { en: 'Nature',         pt: 'Natureza',               es: 'Naturaleza' },
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
 *
 * Buckets (canonical):
 *   06:00–11:00 → morning      (cafes, brunch, museums)
 *   11:00–15:00 → midday       (lunch service)
 *   15:00–18:00 → afternoon    (culture, coffee, terraces, shopping)
 *   18:00–22:00 → evening      (dinner, sunset drinks)
 *   22:00–02:00 → late_evening (cocktail bars, wine bars, late-night spots — NEVER dinner)
 *   02:00–06:00 → deep_night   (after-hours, scenic night fallback)
 *
 * The dinner window deliberately ends at 22:00. After that, kitchens are
 * either closed or about to close in Portugal/Spain, and recommending a
 * "Cena en Lisboa" at 00:54 is the exact bug we are preventing here.
 */
export function getNowTimeOfDay(date: Date = new Date(), citySlug?: string): NowTimeOfDay {
  const tz = (citySlug && CITY_TIMEZONES[citySlug]) || 'Europe/Lisbon'
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric', hour12: false, timeZone: tz,
  }).format(date)
  const hour = parseInt(hourStr, 10)

  if (hour >= 6  && hour < 11) return 'morning'         // 06:00–11:00
  if (hour >= 11 && hour < 15) return 'midday'          // 11:00–15:00
  if (hour >= 15 && hour < 18) return 'afternoon'       // 15:00–18:00
  if (hour >= 18 && hour < 22) return 'evening'         // 18:00–22:00
  if (hour >= 22 || hour < 2)  return 'late_evening'    // 22:00–02:00 (late night)
  return 'deep_night'                                    // 02:00–06:00 (after hours)
}
