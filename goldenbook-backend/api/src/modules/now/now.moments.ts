// ─── NOW Moment System ───────────────────────────────────────────────────────
//
// Moment-based abstraction layer for contextual recommendations.
// Instead of relying on raw categories, we define "moments" — intent-like
// situations the user might be in — and map place_types, time of day,
// and weather conditions to them.
//
// Deterministic. No AI. No external services.

// ─── Moment tags ─────────────────────────────────────────────────────────────

export const MOMENT_TAGS = [
  'coffee_break',
  'quick_lunch',
  'long_lunch',
  'sunset_drink',
  'dinner',
  'late_drinks',
  'evening_walk',
  'shopping_stroll',
  'rain_plan',
  'indoor_culture',
  'relax_spa',
  'treat_yourself',
] as const

export type MomentTag = (typeof MOMENT_TAGS)[number]

// ─── Time of day ─────────────────────────────────────────────────────────────

export type NowTimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

export function getNowTimeOfDay(date: Date = new Date()): NowTimeOfDay {
  const hour = date.getHours()
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'midday'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

// ─── Weather conditions ──────────────────────────────────────────────────────

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'hot' | 'cold'

// ─── Place type → moment mapping ─────────────────────────────────────────────
//
// Each place_type maps to a set of possible moments.
// A place can match multiple moments; the scoring layer picks the best.

export const PLACE_TYPE_MOMENTS: Record<string, MomentTag[]> = {
  restaurant: ['coffee_break', 'quick_lunch', 'long_lunch', 'dinner', 'late_drinks'],
  cafe:       ['coffee_break', 'rain_plan'],
  bar:        ['sunset_drink', 'late_drinks'],
  shop:       ['shopping_stroll', 'rain_plan', 'treat_yourself'],
  hotel:      ['sunset_drink', 'relax_spa', 'coffee_break', 'treat_yourself'],
  museum:     ['indoor_culture', 'rain_plan'],
  activity:   ['indoor_culture', 'rain_plan', 'evening_walk'],
  landmark:   ['evening_walk', 'indoor_culture'],
  venue:      ['late_drinks', 'indoor_culture'],
  beach:      ['evening_walk', 'sunset_drink'],
  // Fallback: types not listed get no moment tags → scored lower
}

/**
 * Get computed moment tags for a place based on its place_type.
 */
export function getMomentTagsForPlace(placeType: string): MomentTag[] {
  return PLACE_TYPE_MOMENTS[placeType] ?? []
}

// ─── HARD GATE: Allowed moments per time window ─────────────────────────────
//
// A moment MUST appear in this list to be eligible at a given time.
// This prevents absurd results like "dinner at 15:00".
//
// rain_plan and relax_spa are allowed in ALL windows (weather/comfort are timeless).

const ALLOWED_MOMENTS: Record<NowTimeOfDay, Set<MomentTag>> = {
  morning:   new Set(['coffee_break', 'indoor_culture', 'rain_plan', 'relax_spa']),
  midday:    new Set(['quick_lunch', 'long_lunch', 'coffee_break', 'rain_plan', 'relax_spa']),
  afternoon: new Set(['coffee_break', 'shopping_stroll', 'treat_yourself', 'indoor_culture', 'rain_plan', 'relax_spa']),
  evening:   new Set(['sunset_drink', 'dinner', 'evening_walk', 'rain_plan', 'relax_spa']),
  night:     new Set(['late_drinks', 'dinner', 'rain_plan', 'relax_spa']),
}

/**
 * Soft transition: only SPECIFIC moments from the next window are allowed
 * early, with a penalty. This is curated — not "all of next window".
 *
 * Example: at 17:30 (still afternoon), sunset_drink makes sense.
 * But dinner at 15:00 does NOT, even though evening allows dinner.
 */
const TRANSITION_MOMENTS: Record<NowTimeOfDay, Set<MomentTag>> = {
  morning:   new Set(['quick_lunch']),                    // approaching midday: early lunch OK
  midday:    new Set(['shopping_stroll', 'treat_yourself']), // approaching afternoon
  afternoon: new Set(['sunset_drink', 'evening_walk']),   // approaching evening: sunset OK, dinner NOT
  evening:   new Set(['late_drinks']),                     // approaching night: late drinks OK
  night:     new Set(['coffee_break']),                    // approaching morning: early coffee OK
}

/** Penalty multiplier for transition moments */
const TRANSITION_PENALTY = 0.5

/**
 * Check if a moment is strictly allowed at this time of day.
 */
export function isMomentAllowed(timeOfDay: NowTimeOfDay, moment: MomentTag): boolean {
  return ALLOWED_MOMENTS[timeOfDay].has(moment)
}

/**
 * Check if a moment is allowed via soft transition (curated subset of next window).
 */
export function isMomentInTransition(timeOfDay: NowTimeOfDay, moment: MomentTag): boolean {
  return TRANSITION_MOMENTS[timeOfDay].has(moment)
}

/**
 * Get all moments allowed at the current time (primary + transitions).
 */
export function getAllowedMoments(timeOfDay: NowTimeOfDay): MomentTag[] {
  const primary = [...ALLOWED_MOMENTS[timeOfDay]]
  const transition = [...TRANSITION_MOMENTS[timeOfDay]].filter((m) => !ALLOWED_MOMENTS[timeOfDay].has(m))
  return [...primary, ...transition]
}

/**
 * Filter a place's moments to only those valid for the current time.
 * Returns { allowed, filtered } for debug visibility.
 */
export function filterMomentsForTime(
  placeType: string,
  timeOfDay: NowTimeOfDay,
): { allowed: MomentTag[]; filtered: MomentTag[] } {
  const all = getMomentTagsForPlace(placeType)
  const allowed: MomentTag[] = []
  const filtered: MomentTag[] = []

  for (const m of all) {
    if (isMomentAllowed(timeOfDay, m) || isMomentInTransition(timeOfDay, m)) {
      allowed.push(m)
    } else {
      filtered.push(m)
    }
  }

  return { allowed, filtered }
}

// ─── Time of day → moment priority ───────────────────────────────────────────
//
// Returns a weight map: which moments are most relevant at each time.
// 'high' = 1.0, 'medium' = 0.6, 'low' = 0.3
//
// IMPORTANT: Only moments in ALLOWED_MOMENTS will ever score > 0 after gating.

type MomentWeight = 'high' | 'medium' | 'low'
const W: Record<MomentWeight, number> = { high: 1.0, medium: 0.6, low: 0.3 }

const TIME_MOMENT_PRIORITY: Record<NowTimeOfDay, Partial<Record<MomentTag, MomentWeight>>> = {
  morning: {
    coffee_break:    'high',
    indoor_culture:  'medium',
    rain_plan:       'medium',
    relax_spa:       'low',
  },
  midday: {
    quick_lunch:     'high',
    long_lunch:      'medium',
    coffee_break:    'low',
    rain_plan:       'medium',
  },
  afternoon: {
    shopping_stroll: 'high',
    coffee_break:    'medium',
    treat_yourself:  'medium',
    indoor_culture:  'medium',
    rain_plan:       'medium',
    relax_spa:       'low',
  },
  evening: {
    sunset_drink:    'high',
    dinner:          'high',
    evening_walk:    'medium',
    rain_plan:       'medium',
  },
  night: {
    late_drinks:     'high',
    dinner:          'medium',
    rain_plan:       'low',
    relax_spa:       'low',
  },
}

/** Next window lookup — used only for transition weight resolution */
const NEXT_WINDOW: Record<NowTimeOfDay, NowTimeOfDay> = {
  morning: 'midday', midday: 'afternoon', afternoon: 'evening', evening: 'night', night: 'morning',
}

/**
 * Get the time-of-day weight for a specific moment tag.
 * Returns 0 if the moment is not in the priority map for this time.
 *
 * Transition moments (curated subset from next window) get TRANSITION_PENALTY applied.
 */
export function getTimeMomentWeight(timeOfDay: NowTimeOfDay, moment: MomentTag): number {
  // Check primary window
  const priority = TIME_MOMENT_PRIORITY[timeOfDay]?.[moment]
  if (priority) return W[priority]

  // Check transition (curated subset, penalized)
  if (isMomentInTransition(timeOfDay, moment)) {
    const nextWindow = NEXT_WINDOW[timeOfDay]
    const nextPriority = TIME_MOMENT_PRIORITY[nextWindow]?.[moment]
    if (nextPriority) return W[nextPriority] * TRANSITION_PENALTY
  }

  return 0
}

/**
 * Get the best moment tag for a place at a given time of day.
 * ONLY considers moments allowed by the hard gate.
 * Returns null if no moment is valid for this time.
 */
export function getBestMomentForPlace(
  placeType: string,
  timeOfDay: NowTimeOfDay,
  weather?: WeatherCondition,
): MomentTag | null {
  const { allowed } = filterMomentsForTime(placeType, timeOfDay)
  if (allowed.length === 0) return null

  let bestMoment: MomentTag | null = null
  let bestWeight = -1

  for (const moment of allowed) {
    let weight = getTimeMomentWeight(timeOfDay, moment)
    if (weather) {
      weight += getWeatherMomentBoost(weather, moment)
    }
    if (weight > bestWeight) {
      bestWeight = weight
      bestMoment = moment
    }
  }

  // Only return if the moment actually has weight — no silent fallback to invalid moments
  return bestWeight > 0 ? bestMoment : null
}

// ─── Weather → moment boosts ─────────────────────────────────────────────────
//
// Weather conditions boost certain moments. These are additive on top of
// time-of-day weights.

const WEATHER_MOMENT_BOOSTS: Record<WeatherCondition, Partial<Record<MomentTag, number>>> = {
  sunny: {
    sunset_drink:    0.3,
    evening_walk:    0.3,
    shopping_stroll: 0.2,
    rain_plan:      -0.8,   // suppress rain plan when it's sunny
  },
  cloudy: {
    indoor_culture:  0.1,
    coffee_break:    0.1,
  },
  rainy: {
    rain_plan:       0.6,   // strong boost
    indoor_culture:  0.3,
    coffee_break:    0.2,
  },
  hot: {
    indoor_culture:  0.2,
    coffee_break:    0.2,
    sunset_drink:    0.2,
    late_drinks:     0.2,
    rain_plan:      -0.8,   // suppress rain plan when it's hot
  },
  cold: {
    coffee_break:    0.3,
    indoor_culture:  0.2,
    rain_plan:       0.1,
    relax_spa:       0.2,
  },
}

/**
 * Get the weather boost for a specific moment tag.
 */
export function getWeatherMomentBoost(weather: WeatherCondition, moment: MomentTag): number {
  return WEATHER_MOMENT_BOOSTS[weather]?.[moment] ?? 0
}

// ─── Moment display labels (i18n) ────────────────────────────────────────────

const MOMENT_LABELS_I18N: Record<MomentTag, Record<string, string>> = {
  coffee_break:    { en: 'Coffee break',      pt: 'Pausa para café',            es: 'Pausa para café' },
  quick_lunch:     { en: 'Quick lunch',       pt: 'Almoço rápido',              es: 'Almuerzo rápido' },
  long_lunch:      { en: 'Long lunch',        pt: 'Almoço longo',               es: 'Almuerzo largo' },
  sunset_drink:    { en: 'Sunset drinks',     pt: 'Drinks ao pôr do sol',       es: 'Cócteles al atardecer' },
  dinner:          { en: 'Dinner',            pt: 'Jantar',                     es: 'Cena' },
  late_drinks:     { en: 'Late drinks',       pt: 'Drinks noturnos',            es: 'Copas nocturnas' },
  evening_walk:    { en: 'Evening walk',      pt: 'Passeio ao fim de tarde',    es: 'Paseo al atardecer' },
  shopping_stroll: { en: 'Shopping stroll',   pt: 'Passeio pelas lojas',        es: 'Paseo de compras' },
  rain_plan:       { en: 'Rainy day plan',    pt: 'Plano para dia de chuva',    es: 'Plan para día de lluvia' },
  indoor_culture:  { en: 'Indoor culture',    pt: 'Cultura interior',           es: 'Cultura en interiores' },
  relax_spa:       { en: 'Relax & spa',       pt: 'Relaxar & spa',              es: 'Relax y spa' },
  treat_yourself:  { en: 'Treat yourself',    pt: 'Um mimo para si',            es: 'Date un capricho' },
}

export function getMomentLabel(moment: MomentTag, locale = 'en'): string {
  const localeFamily = locale.split('-')[0]
  return MOMENT_LABELS_I18N[moment]?.[locale]
    ?? MOMENT_LABELS_I18N[moment]?.[localeFamily]
    ?? MOMENT_LABELS_I18N[moment]?.['en']
    ?? moment
}
