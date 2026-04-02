// ─── NOW Explanation Engine ───────────────────────────────────────────────────
//
// Template-based text generation for NOW recommendation cards.
// No AI required — deterministic templates based on moment + weather + time.
//
// Examples:
// - "Perfect for a sunny afternoon nearby"
// - "Great cozy spot for a rainy evening"
// - "Ideal for a quick lunch right now"

import type { MomentTag, NowTimeOfDay, WeatherCondition } from './now.moments'
import { getMomentLabel } from './now.moments'

// ─── Template system ─────────────────────────────────────────────────────────

interface ExplanationParts {
  adjective: string
  timePhrase: string
  weatherPhrase: string
  proximityPhrase: string
}

// ── Adjectives by moment ─────────────────────────────────────────────────────

const MOMENT_ADJECTIVES: Record<string, Record<MomentTag, string[]>> = {
  en: {
    coffee_break:    ['Perfect', 'Ideal', 'A lovely spot'],
    quick_lunch:     ['Ideal', 'Great', 'Just right'],
    long_lunch:      ['Perfect', 'A refined choice', 'Ideal'],
    sunset_drink:    ['Stunning', 'Beautiful', 'The perfect spot'],
    dinner:          ['An elegant choice', 'A refined selection', 'Perfect'],
    late_drinks:     ['A great find', 'Perfect', 'An excellent pick'],
    evening_walk:    ['Lovely', 'Beautiful', 'A charming spot'],
    shopping_stroll: ['A curated find', 'Perfect', 'Delightful'],
    rain_plan:       ['A cozy retreat', 'Perfect shelter', 'A warm hideaway'],
    indoor_culture:  ['Fascinating', 'An inspiring choice', 'A cultural gem'],
    relax_spa:       ['A sanctuary', 'Pure relaxation', 'An oasis'],
    treat_yourself:  ['You deserve this', 'A special treat', 'Indulge'],
  },
  pt: {
    coffee_break:    ['Perfeito', 'Ideal', 'Um ótimo lugar'],
    quick_lunch:     ['Ideal', 'Perfeito', 'Exatamente o que precisa'],
    long_lunch:      ['Perfeito', 'Uma escolha refinada', 'Ideal'],
    sunset_drink:    ['Deslumbrante', 'Lindo', 'O lugar perfeito'],
    dinner:          ['Uma escolha elegante', 'Uma seleção refinada', 'Perfeito'],
    late_drinks:     ['Uma ótima descoberta', 'Perfeito', 'Uma excelente escolha'],
    evening_walk:    ['Encantador', 'Lindo', 'Um lugar com charme'],
    shopping_stroll: ['Uma descoberta curada', 'Perfeito', 'Encantador'],
    rain_plan:       ['Um refúgio acolhedor', 'Abrigo perfeito', 'Um esconderijo quente'],
    indoor_culture:  ['Fascinante', 'Uma escolha inspiradora', 'Uma joia cultural'],
    relax_spa:       ['Um santuário', 'Puro relaxamento', 'Um oásis'],
    treat_yourself:  ['Merece isto', 'Um mimo especial', 'Permita-se'],
  },
  es: {
    coffee_break:    ['Perfecto', 'Ideal', 'Un gran lugar'],
    quick_lunch:     ['Ideal', 'Perfecto', 'Justo lo que necesitas'],
    long_lunch:      ['Perfecto', 'Una elección refinada', 'Ideal'],
    sunset_drink:    ['Impresionante', 'Hermoso', 'El lugar perfecto'],
    dinner:          ['Una elección elegante', 'Una selección refinada', 'Perfecto'],
    late_drinks:     ['Un gran hallazgo', 'Perfecto', 'Una excelente elección'],
    evening_walk:    ['Encantador', 'Hermoso', 'Un lugar con encanto'],
    shopping_stroll: ['Un hallazgo curado', 'Perfecto', 'Delicioso'],
    rain_plan:       ['Un refugio acogedor', 'Refugio perfecto', 'Un escondite cálido'],
    indoor_culture:  ['Fascinante', 'Una elección inspiradora', 'Una joya cultural'],
    relax_spa:       ['Un santuario', 'Relajación pura', 'Un oasis'],
    treat_yourself:  ['Te lo mereces', 'Un capricho especial', 'Date un gusto'],
  },
}

// ── Weather phrases ──────────────────────────────────────────────────────────

const WEATHER_PHRASES: Record<string, Record<WeatherCondition, string[]>> = {
  en: {
    sunny:  ['on this sunny day', 'under the sun', 'in this beautiful weather'],
    cloudy: ['on a mild day like this', 'this afternoon', 'today'],
    rainy:  ['on a rainy day', 'when it rains', 'to escape the rain'],
    hot:    ['to cool down', 'on this hot day', 'to beat the heat'],
    cold:   ['to warm up', 'on a chilly day', 'when it\'s cold outside'],
  },
  pt: {
    sunny:  ['neste dia de sol', 'sob o sol', 'com este tempo bonito'],
    cloudy: ['num dia ameno como este', 'esta tarde', 'hoje'],
    rainy:  ['num dia de chuva', 'quando chove', 'para fugir da chuva'],
    hot:    ['para refrescar', 'neste dia quente', 'para fugir do calor'],
    cold:   ['para aquecer', 'num dia frio', 'quando está frio lá fora'],
  },
  es: {
    sunny:  ['en este día soleado', 'bajo el sol', 'con este tiempo precioso'],
    cloudy: ['en un día suave como este', 'esta tarde', 'hoy'],
    rainy:  ['en un día de lluvia', 'cuando llueve', 'para escapar de la lluvia'],
    hot:    ['para refrescarte', 'en este día caluroso', 'para escapar del calor'],
    cold:   ['para entrar en calor', 'en un día frío', 'cuando hace frío fuera'],
  },
}

// ── Time phrases ─────────────────────────────────────────────────────────────

const TIME_PHRASES: Record<string, Record<NowTimeOfDay, string[]>> = {
  en: {
    morning:   ['this morning', 'to start your day', 'for a morning moment'],
    midday:    ['right now', 'for lunch', 'at midday'],
    afternoon: ['this afternoon', 'for the afternoon', 'right now'],
    evening:   ['this evening', 'tonight', 'for the evening'],
    night:     ['tonight', 'for a late night', 'to end the night'],
  },
  pt: {
    morning:   ['esta manhã', 'para começar o dia', 'para um momento matinal'],
    midday:    ['agora mesmo', 'para o almoço', 'ao meio-dia'],
    afternoon: ['esta tarde', 'para a tarde', 'agora mesmo'],
    evening:   ['esta noite', 'hoje à noite', 'para o fim de tarde'],
    night:     ['esta noite', 'para uma noite tardia', 'para terminar a noite'],
  },
  es: {
    morning:   ['esta mañana', 'para empezar el día', 'para un momento matinal'],
    midday:    ['ahora mismo', 'para el almuerzo', 'al mediodía'],
    afternoon: ['esta tarde', 'para la tarde', 'ahora mismo'],
    evening:   ['esta noche', 'hoy por la noche', 'para la tarde-noche'],
    night:     ['esta noche', 'para una noche tardía', 'para cerrar la noche'],
  },
}

// ── Proximity phrases ────────────────────────────────────────────────────────

function getProximityPhrase(distanceMeters: number | null, locale: string): string {
  const lang = locale.split('-')[0]
  if (distanceMeters == null) return ''
  if (distanceMeters <= 300) {
    if (lang === 'pt') return 'mesmo aqui ao lado'
    if (lang === 'es') return 'a solo unos pasos'
    return 'just steps away'
  }
  if (distanceMeters <= 800) {
    if (lang === 'pt') return 'pertinho de si'
    if (lang === 'es') return 'muy cerca'
    return 'nearby'
  }
  if (distanceMeters <= 1500) {
    if (lang === 'pt') return 'a poucos minutos'
    if (lang === 'es') return 'a pocos minutos'
    return 'a short walk away'
  }
  return ''
}

// ─── Main explanation builder ────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Generate a contextual explanation for a NOW recommendation.
 *
 * Examples:
 * - "Perfect for a quick lunch right now, just steps away"
 * - "A cozy retreat on a rainy day, nearby"
 * - "Stunning for sunset drinks this evening"
 */
export function buildNowExplanation(
  moment: MomentTag | null,
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  distanceMeters: number | null,
  locale = 'en',
): string {
  const lang = locale.split('-')[0]
  const l = lang === 'pt' ? 'pt' : (lang === 'es' ? 'es' : 'en')

  if (!moment) {
    // Generic fallback
    const timePhrase = pickRandom(TIME_PHRASES[l][timeOfDay])
    if (l === 'pt') return `Uma boa escolha ${timePhrase}`
    if (l === 'es') return `Una gran opción ${timePhrase}`
    return `A good pick ${timePhrase}`
  }

  const adjective = pickRandom(MOMENT_ADJECTIVES[l][moment] ?? ['Perfect'])
  const momentLabel = getMomentLabel(moment, locale).toLowerCase()

  // Decide whether to use weather or time phrase
  let contextPhrase: string
  if (weather && WEATHER_PHRASES[l][weather]) {
    contextPhrase = pickRandom(WEATHER_PHRASES[l][weather])
  } else {
    contextPhrase = pickRandom(TIME_PHRASES[l][timeOfDay])
  }

  const proximity = getProximityPhrase(distanceMeters, locale)

  // Build sentence
  const parts: string[] = []

  if (l === 'pt') {
    parts.push(`${adjective} para ${momentLabel}`)
    parts.push(contextPhrase)
    if (proximity) parts.push(proximity)
  } else if (l === 'es') {
    parts.push(`${adjective} para ${momentLabel}`)
    parts.push(contextPhrase)
    if (proximity) parts.push(proximity)
  } else {
    parts.push(`${adjective} for ${momentLabel.startsWith('a ') ? '' : 'a '}${momentLabel}`)
    parts.push(contextPhrase)
    if (proximity) parts.push(proximity)
  }

  // Join with commas, capitalize first letter
  let text = parts.join(', ')
  text = text.charAt(0).toUpperCase() + text.slice(1)

  return text
}

// ─── Title / Subtitle for NOW card (hard limits) ────────────────────────────

const NOW_TITLE_MAX = 60
const NOW_SUBTITLE_MAX = 100

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.lastIndexOf(' ', max - 1)
  return (cut > max * 0.5 ? text.slice(0, cut) : text.slice(0, max - 1)) + '…'
}

// ── Title templates: moment + city ──────────────────────────────────────────

const TITLE_TEMPLATES: Record<string, Record<MomentTag, string>> = {
  en: {
    coffee_break:    'Coffee break in {city}',
    quick_lunch:     'Quick lunch in {city}',
    long_lunch:      'A long lunch in {city}',
    sunset_drink:    'Sunset drinks in {city}',
    dinner:          'Dinner in {city}',
    late_drinks:     'Late-night drinks in {city}',
    evening_walk:    'Evening walk in {city}',
    shopping_stroll: 'Shopping in {city}',
    rain_plan:       'A cozy plan in {city}',
    indoor_culture:  'Culture in {city}',
    relax_spa:       'Time to relax in {city}',
    treat_yourself:  'Treat yourself in {city}',
  },
  pt: {
    coffee_break:    'Pausa para café em {city}',
    quick_lunch:     'Almoço rápido em {city}',
    long_lunch:      'Um almoço longo em {city}',
    sunset_drink:    'Drinks ao pôr do sol em {city}',
    dinner:          'Jantar em {city}',
    late_drinks:     'Copas noturnas em {city}',
    evening_walk:    'Passeio ao fim da tarde em {city}',
    shopping_stroll: 'Compras em {city}',
    rain_plan:       'Um plano acolhedor em {city}',
    indoor_culture:  'Cultura em {city}',
    relax_spa:       'Hora de relaxar em {city}',
    treat_yourself:  'Um mimo em {city}',
  },
  es: {
    coffee_break:    'Pausa para café en {city}',
    quick_lunch:     'Almuerzo rápido en {city}',
    long_lunch:      'Un almuerzo largo en {city}',
    sunset_drink:    'Copas al atardecer en {city}',
    dinner:          'Cena en {city}',
    late_drinks:     'Copas nocturnas en {city}',
    evening_walk:    'Paseo al atardecer en {city}',
    shopping_stroll: 'Compras en {city}',
    rain_plan:       'Un plan acogedor en {city}',
    indoor_culture:  'Cultura en {city}',
    relax_spa:       'Hora de relajarse en {city}',
    treat_yourself:  'Date un capricho en {city}',
  },
}

const TITLE_FALLBACK: Record<string, Record<NowTimeOfDay, string>> = {
  en: {
    morning: 'Good morning in {city}', midday: 'Lunchtime in {city}',
    afternoon: 'This afternoon in {city}', evening: 'Tonight in {city}', night: 'Late night in {city}',
  },
  pt: {
    morning: 'Bom dia em {city}', midday: 'Hora do almoço em {city}',
    afternoon: 'Esta tarde em {city}', evening: 'Esta noite em {city}', night: 'Noite em {city}',
  },
  es: {
    morning: 'Buenos días en {city}', midday: 'Hora del almuerzo en {city}',
    afternoon: 'Esta tarde en {city}', evening: 'Esta noche en {city}', night: 'Noche en {city}',
  },
}

// ── Subtitle templates: editorial one-liner ─────────────────────────────────

const SUBTITLE_TEMPLATES: Record<string, Record<MomentTag, string[]>> = {
  en: {
    coffee_break:    ['The perfect spot to slow down', 'A quiet moment, well deserved'],
    quick_lunch:     ['Fresh, fast, and just right', 'A smart pick for midday'],
    long_lunch:      ['Take your time — you\'ve earned it', 'A table worth lingering at'],
    sunset_drink:    ['Golden hour deserves a golden glass', 'The light is perfect right now'],
    dinner:          ['An evening to remember', 'Set the tone for tonight'],
    late_drinks:     ['The night is still young', 'One more — the good kind'],
    evening_walk:    ['Let the city unfold around you', 'A stroll worth taking'],
    shopping_stroll: ['Curated finds, no rush', 'Something special awaits'],
    rain_plan:       ['Let the rain set the mood', 'Warmth and character inside'],
    indoor_culture:  ['Feed your curiosity', 'A window into something deeper'],
    relax_spa:       ['Breathe out. You\'re here', 'Pure calm, no agenda'],
    treat_yourself:  ['Because you can', 'A little luxury goes a long way'],
  },
  pt: {
    coffee_break:    ['O lugar perfeito para abrandar', 'Um momento de calma, bem merecido'],
    quick_lunch:     ['Fresco, rápido e certeiro', 'Uma escolha inteligente para o dia'],
    long_lunch:      ['Não tenha pressa — merece', 'Uma mesa onde vale a pena ficar'],
    sunset_drink:    ['A hora dourada merece um brinde', 'A luz está perfeita agora'],
    dinner:          ['Uma noite para recordar', 'O cenário ideal para esta noite'],
    late_drinks:     ['A noite ainda é jovem', 'Mais um — do bom'],
    evening_walk:    ['Deixe a cidade revelar-se', 'Um passeio que vale a pena'],
    shopping_stroll: ['Achados curados, sem pressa', 'Algo especial à sua espera'],
    rain_plan:       ['Deixe a chuva criar o ambiente', 'Calor e carácter lá dentro'],
    indoor_culture:  ['Alimente a sua curiosidade', 'Uma janela para algo mais profundo'],
    relax_spa:       ['Respire fundo. Está aqui', 'Calma pura, sem agenda'],
    treat_yourself:  ['Porque pode', 'Um pequeno luxo faz toda a diferença'],
  },
  es: {
    coffee_break:    ['El lugar perfecto para frenar', 'Un momento de calma, bien merecido'],
    quick_lunch:     ['Fresco, rápido y certero', 'Una elección inteligente para el día'],
    long_lunch:      ['Tómate tu tiempo — te lo mereces', 'Una mesa donde merece la pena quedarse'],
    sunset_drink:    ['La hora dorada merece un brindis', 'La luz está perfecta ahora mismo'],
    dinner:          ['Una noche para recordar', 'El escenario ideal para esta noche'],
    late_drinks:     ['La noche aún es joven', 'Una más — de las buenas'],
    evening_walk:    ['Deja que la ciudad se revele', 'Un paseo que merece la pena'],
    shopping_stroll: ['Hallazgos curados, sin prisa', 'Algo especial te espera'],
    rain_plan:       ['Deja que la lluvia cree el ambiente', 'Calidez y carácter dentro'],
    indoor_culture:  ['Alimenta tu curiosidad', 'Una ventana a algo más profundo'],
    relax_spa:       ['Respira hondo. Estás aquí', 'Calma pura, sin agenda'],
    treat_yourself:  ['Porque puedes', 'Un pequeño lujo marca la diferencia'],
  },
}

/**
 * Build the NOW card title — max 60 chars.
 * Format: "{moment} in {city}" — short, contextual.
 */
export function buildNowTitle(
  moment: MomentTag | null,
  timeOfDay: NowTimeOfDay,
  cityName: string,
  locale = 'en',
): string {
  const l = locale.split('-')[0]
  const lang = l === 'pt' ? 'pt' : (l === 'es' ? 'es' : 'en')

  let template: string
  if (moment && TITLE_TEMPLATES[lang][moment]) {
    template = TITLE_TEMPLATES[lang][moment]
  } else {
    template = TITLE_FALLBACK[lang][timeOfDay]
  }

  return truncate(template.replace('{city}', cityName), NOW_TITLE_MAX)
}

/**
 * Build the NOW card subtitle — max 100 chars.
 * Short editorial copy, elegant and concise.
 */
export function buildNowSubtitle(
  moment: MomentTag | null,
  timeOfDay: NowTimeOfDay,
  locale = 'en',
): string {
  const l = locale.split('-')[0]
  const lang = l === 'pt' ? 'pt' : (l === 'es' ? 'es' : 'en')

  if (moment && SUBTITLE_TEMPLATES[lang][moment]) {
    return truncate(pickRandom(SUBTITLE_TEMPLATES[lang][moment]), NOW_SUBTITLE_MAX)
  }

  // Generic fallback
  if (lang === 'pt') return 'Uma escolha pensada para este momento'
  if (lang === 'es') return 'Una elección pensada para este momento'
  return 'A curated pick for right now'
}

/**
 * Build a short context summary for the Concierge handoff.
 * Used when NOW → Concierge to describe the alternatives.
 */
export function buildContextSummary(
  moment: MomentTag | null,
  timeOfDay: NowTimeOfDay,
  locale = 'en',
): string {
  const localeFamily = locale.split('-')[0]
  const lang = localeFamily === 'pt' ? 'pt' : (localeFamily === 'es' ? 'es' : 'en')
  const momentLabel = moment ? getMomentLabel(moment, locale).toLowerCase() : null

  if (lang === 'pt') {
    if (momentLabel) return `Outras opções para ${momentLabel}`
    const todMap: Record<NowTimeOfDay, string> = {
      morning: 'esta manhã', midday: 'este meio-dia',
      afternoon: 'esta tarde', evening: 'esta noite', night: 'esta noite',
    }
    return `Outras opções para ${todMap[timeOfDay]}`
  }

  if (lang === 'es') {
    if (momentLabel) return `Otras opciones para ${momentLabel}`
    const todMap: Record<NowTimeOfDay, string> = {
      morning: 'esta mañana', midday: 'este mediodía',
      afternoon: 'esta tarde', evening: 'esta noche', night: 'esta noche',
    }
    return `Otras opciones para ${todMap[timeOfDay]}`
  }

  if (momentLabel) return `Other great options for ${momentLabel}`
  const todMap: Record<NowTimeOfDay, string> = {
    morning: 'this morning', midday: 'this midday',
    afternoon: 'this afternoon', evening: 'this evening', night: 'tonight',
  }
  return `Other great options for ${todMap[timeOfDay]}`
}

/**
 * Build reason tags for the context object (machine-readable).
 */
export function buildReasonTags(
  moment: MomentTag | null,
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  distanceMeters: number | null,
): string[] {
  const tags: string[] = []
  if (moment) tags.push(`moment:${moment}`)
  tags.push(`time:${timeOfDay}`)
  if (weather) tags.push(`weather:${weather}`)
  if (distanceMeters != null) {
    if (distanceMeters <= 500) tags.push('proximity:very_close')
    else if (distanceMeters <= 1500) tags.push('proximity:close')
    else tags.push('proximity:moderate')
  }
  return tags
}
