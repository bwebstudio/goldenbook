// ─── Weather-Aware Copy Templates ────────────────────────────────────────────
//
// Generates recommendation text based on context tags + weather + time.
// Adapts the COPY to context, not the place selection.
//
// Priority: weather override → tag-specific template → time-of-day fallback

import type { NowTimeOfDay, WeatherCondition } from './types'
import type { ContextTag } from './context-tags'
import { getTagLabel } from './context-tags'

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.lastIndexOf(' ', max - 1)
  return (cut > max * 0.5 ? text.slice(0, cut) : text.slice(0, max - 1)) + '…'
}

function resolveLocale(locale: string): 'en' | 'pt' | 'es' {
  const lang = locale.split('-')[0]
  return lang === 'pt' ? 'pt' : lang === 'es' ? 'es' : 'en'
}

// ─── Weather-aware adjectives ───────────────────────────────────────────────

const WEATHER_ADJECTIVES: Record<string, Record<WeatherCondition, string[]>> = {
  en: {
    sunny:  ['A perfect sunny stop', 'Golden light awaits', 'Sunshine calls for this'],
    cloudy: ['A good pick for today', 'An inspiring choice', 'Just right for now'],
    rainy:  ['A cozy stop', 'Perfect shelter', 'Warmth and character inside'],
    hot:    ['Beat the heat here', 'A refreshing escape', 'Cool down in style'],
    cold:   ['Warm up here', 'A cozy retreat', 'Comfort awaits'],
  },
  pt: {
    sunny:  ['Uma paragem perfeita ao sol', 'Luz dourada espera', 'O sol pede isto'],
    cloudy: ['Uma boa escolha para hoje', 'Uma escolha inspiradora', 'Perfeito para agora'],
    rainy:  ['Um refúgio acolhedor', 'Abrigo perfeito', 'Calor e carácter lá dentro'],
    hot:    ['Fuja do calor aqui', 'Um escape refrescante', 'Refresque-se com estilo'],
    cold:   ['Aqueça-se aqui', 'Um refúgio acolhedor', 'Conforto à espera'],
  },
  es: {
    sunny:  ['Una parada perfecta bajo el sol', 'Luz dorada te espera', 'El sol pide esto'],
    cloudy: ['Una buena elección para hoy', 'Una elección inspiradora', 'Perfecto para ahora'],
    rainy:  ['Un refugio acogedor', 'Refugio perfecto', 'Calidez y carácter dentro'],
    hot:    ['Escapa del calor aquí', 'Un escape refrescante', 'Refresca con estilo'],
    cold:   ['Entra en calor aquí', 'Un refugio acogedor', 'Confort te espera'],
  },
}

// ─── Tag-specific title templates ───────────────────────────────────────────

const TAG_TITLES: Record<string, Partial<Record<ContextTag, string>>> = {
  en: {
    'brunch':       'Brunch in {city}',
    'coffee':       'Coffee break in {city}',
    'cocktails':    'Cocktails in {city}',
    'dinner':       'Dinner in {city}',
    'lunch':        'Lunch in {city}',
    'fine-dining':  'Fine dining in {city}',
    'sunset':       'Sunset in {city}',
    'late-night':   'Late night in {city}',
    'wine':         'Wine in {city}',
    'culture':      'Culture in {city}',
    'shopping':     'Shopping in {city}',
    'wellness':     'Time to relax in {city}',
    'romantic':     'A romantic escape in {city}',
    'rooftop':      'Rooftop views in {city}',
    'terrace':      'Al fresco in {city}',
    'viewpoint':    'A view of {city}',
    'live-music':   'Live music in {city}',
    'local-secret': 'A local secret in {city}',
    'rainy-day':    'A cozy plan in {city}',
    'quick-stop':   'A quick stop in {city}',
    'celebration':  'Celebrate in {city}',
    'family':       'Family time in {city}',
    'sunday':       'A Sunday in {city}',
  },
  pt: {
    'brunch':       'Brunch em {city}',
    'coffee':       'Pausa para café em {city}',
    'cocktails':    'Cocktails em {city}',
    'dinner':       'Jantar em {city}',
    'lunch':        'Almoço em {city}',
    'fine-dining':  'Fine dining em {city}',
    'sunset':       'Pôr do sol em {city}',
    'late-night':   'Noite em {city}',
    'wine':         'Vinho em {city}',
    'culture':      'Cultura em {city}',
    'shopping':     'Compras em {city}',
    'wellness':     'Hora de relaxar em {city}',
    'romantic':     'Uma escapada romântica em {city}',
    'rooftop':      'Vistas do rooftop em {city}',
    'terrace':      'Ao ar livre em {city}',
    'viewpoint':    'Uma vista de {city}',
    'live-music':   'Música ao vivo em {city}',
    'local-secret': 'Um segredo local em {city}',
    'rainy-day':    'Um plano acolhedor em {city}',
    'quick-stop':   'Uma paragem rápida em {city}',
    'celebration':  'Celebre em {city}',
    'family':       'Tempo em família em {city}',
    'sunday':       'Um domingo em {city}',
  },
  es: {
    'brunch':       'Brunch en {city}',
    'coffee':       'Pausa para café en {city}',
    'cocktails':    'Cócteles en {city}',
    'dinner':       'Cena en {city}',
    'lunch':        'Almuerzo en {city}',
    'fine-dining':  'Alta cocina en {city}',
    'sunset':       'Atardecer en {city}',
    'late-night':   'Noche en {city}',
    'wine':         'Vino en {city}',
    'culture':      'Cultura en {city}',
    'shopping':     'Compras en {city}',
    'wellness':     'Hora de relajarse en {city}',
    'romantic':     'Una escapada romántica en {city}',
    'rooftop':      'Vistas desde la azotea en {city}',
    'terrace':      'Al aire libre en {city}',
    'viewpoint':    'Una vista de {city}',
    'live-music':   'Música en vivo en {city}',
    'local-secret': 'Un secreto local en {city}',
    'rainy-day':    'Un plan acogedor en {city}',
    'quick-stop':   'Una parada rápida en {city}',
    'celebration':  'Celebra en {city}',
    'family':       'Tiempo en familia en {city}',
    'sunday':       'Un domingo en {city}',
  },
}

// ─── Tag-specific subtitle templates (editorial one-liners) ─────────────────

const TAG_SUBTITLES: Record<string, Partial<Record<ContextTag, string[]>>> = {
  en: {
    'brunch':       ['A slow morning, well spent', 'The perfect way to start'],
    'coffee':       ['The perfect spot to slow down', 'A quiet moment, well deserved'],
    'cocktails':    ['The night starts here', 'A glass worth savoring'],
    'dinner':       ['An evening to remember', 'Set the tone for tonight'],
    'lunch':        ['A midday pause worth making', 'Where afternoon plans begin'],
    'fine-dining':  ['An experience, not just a meal', 'Where every detail matters'],
    'sunset':       ['Golden hour deserves a golden glass', 'The light is perfect now'],
    'late-night':   ['The night is still young', 'One more — the good kind'],
    'wine':         ['A glass and a story', 'Where wine meets place'],
    'culture':      ['Feed your curiosity', 'A window into something deeper'],
    'shopping':     ['Curated finds, no rush', 'Something special awaits'],
    'wellness':     ['Breathe out. You\'re here', 'Pure calm, no agenda'],
    'romantic':     ['Just the two of you', 'An intimate escape'],
    'rooftop':      ['Above the city', 'The view does the talking'],
    'terrace':      ['Open air, open mind', 'A breath of fresh air'],
    'viewpoint':    ['See the city from here', 'A perspective worth finding'],
    'live-music':   ['Let the music carry you', 'Sound and atmosphere'],
    'local-secret': ['Not everyone knows this place', 'A hidden gem'],
    'rainy-day':    ['Let the rain set the mood', 'Warmth and character inside'],
    'quick-stop':   ['In and out — but unforgettable', 'Small stop, big impression'],
    'celebration':  ['Because today is special', 'Mark the moment'],
    'family':       ['For everyone to enjoy', 'Together is better'],
    'sunday':       ['A lazy, lovely day', 'The art of doing less'],
  },
  pt: {
    'brunch':       ['Uma manhã calma, bem passada', 'A maneira perfeita de começar'],
    'coffee':       ['O lugar perfeito para abrandar', 'Um momento de calma'],
    'cocktails':    ['A noite começa aqui', 'Um copo que merece ser saboreado'],
    'dinner':       ['Uma noite para recordar', 'O cenário ideal para esta noite'],
    'lunch':        ['Uma pausa que vale a pena', 'Onde a tarde começa bem'],
    'fine-dining':  ['Uma experiência, não apenas uma refeição', 'Onde cada detalhe importa'],
    'sunset':       ['A hora dourada merece um brinde', 'A luz está perfeita agora'],
    'late-night':   ['A noite ainda é jovem', 'Mais um — do bom'],
    'wine':         ['Um copo e uma história', 'Onde o vinho encontra o lugar'],
    'culture':      ['Alimente a sua curiosidade', 'Uma janela para algo mais profundo'],
    'shopping':     ['Achados curados, sem pressa', 'Algo especial à sua espera'],
    'wellness':     ['Respire fundo. Está aqui', 'Calma pura, sem agenda'],
    'romantic':     ['Só vocês dois', 'Uma escapada íntima'],
    'rooftop':      ['Acima da cidade', 'A vista fala por si'],
    'terrace':      ['Ao ar livre, mente aberta', 'Um sopro de ar fresco'],
    'viewpoint':    ['Veja a cidade daqui', 'Uma perspetiva que vale a pena'],
    'live-music':   ['Deixe a música guiá-lo', 'Som e atmosfera'],
    'local-secret': ['Nem todos conhecem este lugar', 'Uma joia escondida'],
    'rainy-day':    ['Deixe a chuva criar o ambiente', 'Calor e carácter lá dentro'],
    'quick-stop':   ['Rápido — mas inesquecível', 'Paragem pequena, grande impressão'],
    'celebration':  ['Porque hoje é especial', 'Marque o momento'],
    'family':       ['Para todos desfrutarem', 'Juntos é melhor'],
    'sunday':       ['Um dia calmo e adorável', 'A arte de fazer menos'],
  },
  es: {
    'brunch':       ['Una mañana tranquila, bien aprovechada', 'La manera perfecta de empezar'],
    'coffee':       ['El lugar perfecto para frenar', 'Un momento de calma'],
    'cocktails':    ['La noche empieza aquí', 'Un trago que merece ser saboreado'],
    'dinner':       ['Una noche para recordar', 'El escenario ideal para esta noche'],
    'lunch':        ['Una pausa que merece la pena', 'Donde empieza una buena tarde'],
    'fine-dining':  ['Una experiencia, no solo una comida', 'Donde cada detalle importa'],
    'sunset':       ['La hora dorada merece un brindis', 'La luz está perfecta ahora'],
    'late-night':   ['La noche aún es joven', 'Una más — de las buenas'],
    'wine':         ['Una copa y una historia', 'Donde el vino encuentra su lugar'],
    'culture':      ['Alimenta tu curiosidad', 'Una ventana a algo más profundo'],
    'shopping':     ['Hallazgos curados, sin prisa', 'Algo especial te espera'],
    'wellness':     ['Respira hondo. Estás aquí', 'Calma pura, sin agenda'],
    'romantic':     ['Solo ustedes dos', 'Una escapada íntima'],
    'rooftop':      ['Por encima de la ciudad', 'La vista habla por sí sola'],
    'terrace':      ['Al aire libre, mente abierta', 'Un soplo de aire fresco'],
    'viewpoint':    ['Ve la ciudad desde aquí', 'Una perspectiva que vale la pena'],
    'live-music':   ['Deja que la música te lleve', 'Sonido y atmósfera'],
    'local-secret': ['No todos conocen este lugar', 'Una joya escondida'],
    'rainy-day':    ['Deja que la lluvia cree el ambiente', 'Calidez y carácter dentro'],
    'quick-stop':   ['Rápido — pero inolvidable', 'Parada pequeña, gran impresión'],
    'celebration':  ['Porque hoy es especial', 'Marca el momento'],
    'family':       ['Para que todos disfruten', 'Juntos es mejor'],
    'sunday':       ['Un día tranquilo y encantador', 'El arte de hacer menos'],
  },
}

// ─── Time-of-day fallback titles ────────────────────────────────────────────

const TIME_FALLBACK_TITLES: Record<string, Record<NowTimeOfDay, string>> = {
  en: {
    morning: 'Good morning in {city}', midday: 'Lunchtime in {city}',
    afternoon: 'This afternoon in {city}', evening: 'Tonight in {city}',
    night: 'Late night in {city}', late_evening: 'The night is still young in {city}',
    deep_night: 'After hours in {city}',
  },
  pt: {
    morning: 'Bom dia em {city}', midday: 'Hora do almoço em {city}',
    afternoon: 'Esta tarde em {city}', evening: 'Esta noite em {city}',
    night: 'Noite em {city}', late_evening: 'A noite ainda é jovem em {city}',
    deep_night: 'De madrugada em {city}',
  },
  es: {
    morning: 'Buenos días en {city}', midday: 'Hora del almuerzo en {city}',
    afternoon: 'Esta tarde en {city}', evening: 'Esta noche en {city}',
    night: 'Noche en {city}', late_evening: 'La noche aún es joven en {city}',
    deep_night: 'De madrugada en {city}',
  },
}

// ─── Weather phrases ────────────────────────────────────────────────────────

const WEATHER_PHRASES: Record<string, Record<WeatherCondition, string[]>> = {
  en: {
    sunny:  ['on this sunny day', 'under the sun', 'in this beautiful weather'],
    cloudy: ['on a mild day like this', 'today'],
    rainy:  ['on a rainy day', 'to escape the rain'],
    hot:    ['to cool down', 'on this hot day'],
    cold:   ['to warm up', 'on a chilly day'],
  },
  pt: {
    sunny:  ['neste dia de sol', 'sob o sol', 'com este tempo bonito'],
    cloudy: ['num dia ameno como este', 'hoje'],
    rainy:  ['num dia de chuva', 'para fugir da chuva'],
    hot:    ['para refrescar', 'neste dia quente'],
    cold:   ['para aquecer', 'num dia frio'],
  },
  es: {
    sunny:  ['en este día soleado', 'bajo el sol', 'con este tiempo precioso'],
    cloudy: ['en un día suave como este', 'hoy'],
    rainy:  ['en un día de lluvia', 'para escapar de la lluvia'],
    hot:    ['para refrescarte', 'en este día caluroso'],
    cold:   ['para entrar en calor', 'en un día frío'],
  },
}

// ─── Time phrases ───────────────────────────────────────────────────────────

const TIME_PHRASES: Record<string, Record<NowTimeOfDay, string[]>> = {
  en: {
    morning:      ['this morning', 'to start your day'],
    midday:       ['right now', 'for lunch'],
    afternoon:    ['this afternoon', 'right now'],
    evening:      ['this evening', 'tonight'],
    night:        ['tonight', 'for a late night'],
    late_evening: ['right now', 'before the night ends'],
    deep_night:   ['at this hour', 'while the city sleeps'],
  },
  pt: {
    morning:      ['esta manhã', 'para começar o dia'],
    midday:       ['agora mesmo', 'para o almoço'],
    afternoon:    ['esta tarde', 'agora mesmo'],
    evening:      ['esta noite', 'hoje à noite'],
    night:        ['esta noite', 'para uma noite tardia'],
    late_evening: ['agora mesmo', 'antes da noite acabar'],
    deep_night:   ['a esta hora', 'enquanto a cidade dorme'],
  },
  es: {
    morning:      ['esta mañana', 'para empezar el día'],
    midday:       ['ahora mismo', 'para el almuerzo'],
    afternoon:    ['esta tarde', 'ahora mismo'],
    evening:      ['esta noche', 'hoy por la noche'],
    night:        ['esta noche', 'para una noche tardía'],
    late_evening: ['ahora mismo', 'antes de que acabe la noche'],
    deep_night:   ['a esta hora', 'mientras la ciudad duerme'],
  },
}

// ─── Proximity phrases ──────────────────────────────────────────────────────

function getProximityPhrase(distanceMeters: number | null, lang: string): string {
  if (distanceMeters == null) return ''
  if (distanceMeters <= 300) {
    return lang === 'pt' ? 'mesmo aqui ao lado' : lang === 'es' ? 'a solo unos pasos' : 'just steps away'
  }
  if (distanceMeters <= 800) {
    return lang === 'pt' ? 'pertinho de si' : lang === 'es' ? 'muy cerca' : 'nearby'
  }
  if (distanceMeters <= 1500) {
    return lang === 'pt' ? 'a poucos minutos' : lang === 'es' ? 'a pocos minutos' : 'a short walk away'
  }
  return ''
}

// ─── Public API ─────────────────────────────────────────────────────────────

const TITLE_MAX = 60
const SUBTITLE_MAX = 100

// ─── Place-type guard ──────────────────────────────────────────────────────
// Prevents absurd combos like "Fine dining" for a shop or "Shopping" for a museum.
// Returns a safe bestTag given the place_type.

const FOOD_TAGS = new Set<string>([
  'brunch', 'coffee', 'cocktails', 'dinner', 'lunch', 'fine-dining', 'wine', 'late-night',
])
const PLACE_TYPE_SAFE_TAGS: Record<string, Set<string>> = {
  restaurant: FOOD_TAGS,
  cafe:       new Set(['brunch', 'coffee', 'lunch', 'quick-stop']),
  bar:        new Set(['cocktails', 'wine', 'late-night', 'live-music']),
  shop:       new Set(['shopping', 'local-secret', 'quick-stop']),
  museum:     new Set(['culture', 'rainy-day', 'family']),
  landmark:   new Set(['culture', 'viewpoint', 'family', 'sunset']),
  hotel:      new Set(['wellness', 'romantic', 'celebration']),
  beach:      new Set(['sunset', 'family', 'viewpoint']),
  activity:   new Set(['wellness', 'culture', 'family', 'wine', 'local-secret']),
  venue:      new Set(['live-music', 'late-night', 'cocktails', 'celebration']),
}

// Fallback tag when bestTag is inappropriate for the place type
const PLACE_TYPE_FALLBACK_TAG: Record<string, ContextTag> = {
  restaurant: 'dinner',
  cafe:       'coffee',
  bar:        'cocktails',
  shop:       'shopping',
  museum:     'culture',
  landmark:   'culture',
  hotel:      'wellness',
  beach:      'sunset',
  activity:   'local-secret',
  venue:      'live-music',
}

function sanitizeBestTag(bestTag: string | null, placeType?: string): string | null {
  if (!bestTag || !placeType) return bestTag
  const safeSet = PLACE_TYPE_SAFE_TAGS[placeType]
  if (!safeSet) return bestTag  // Unknown type — don't filter
  if (safeSet.has(bestTag)) return bestTag  // Tag is valid for this type
  // Tag is inappropriate — use fallback
  return PLACE_TYPE_FALLBACK_TAG[placeType] ?? bestTag
}

/**
 * Build the NOW card title — max 60 chars.
 * Uses tag-specific template, or falls back to time-of-day generic.
 * placeType is used to prevent absurd tag/copy combos.
 */
export function buildTitle(
  bestTag: string | null,
  timeOfDay: NowTimeOfDay,
  cityName: string,
  locale = 'en',
  placeType?: string,
): string {
  const l = resolveLocale(locale)
  const tag = sanitizeBestTag(bestTag, placeType) as ContextTag | null

  let template: string
  if (tag && TAG_TITLES[l]?.[tag]) {
    template = TAG_TITLES[l][tag]!
  } else {
    template = TIME_FALLBACK_TITLES[l][timeOfDay]
  }

  return truncate(template.replace('{city}', cityName), TITLE_MAX)
}

/**
 * Build the NOW card subtitle — max 100 chars.
 * Short editorial one-liner keyed by best tag.
 */
export function buildSubtitle(
  bestTag: string | null,
  timeOfDay: NowTimeOfDay,
  locale = 'en',
  placeType?: string,
): string {
  const l = resolveLocale(locale)
  const tag = sanitizeBestTag(bestTag, placeType) as ContextTag | null

  if (tag && TAG_SUBTITLES[l]?.[tag]) {
    return truncate(pick(TAG_SUBTITLES[l][tag]!), SUBTITLE_MAX)
  }

  return l === 'pt' ? 'Uma escolha pensada para este momento'
       : l === 'es' ? 'Una elección pensada para este momento'
       : 'A curated pick for right now'
}

/**
 * Build the explanation text — weather-aware contextual copy.
 * Priority: weather override → tag-based template → time fallback.
 */
export function buildExplanation(
  bestTag: string | null,
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  distanceMeters: number | null,
  locale = 'en',
): string {
  const l = resolveLocale(locale)
  const tag = bestTag as ContextTag | null

  // Pick adjective: weather-aware if weather is provided
  let adjective: string
  if (weather && WEATHER_ADJECTIVES[l]?.[weather]) {
    adjective = pick(WEATHER_ADJECTIVES[l][weather])
  } else if (tag) {
    const tagLabel = getTagLabel(tag, locale).toLowerCase()
    adjective = l === 'pt' ? `Perfeito para ${tagLabel}`
              : l === 'es' ? `Perfecto para ${tagLabel}`
              : `Perfect for ${tagLabel}`
  } else {
    adjective = l === 'pt' ? 'Uma boa escolha' : l === 'es' ? 'Una gran opción' : 'A good pick'
  }

  // Context phrase: weather or time
  let contextPhrase: string
  if (weather && WEATHER_PHRASES[l]?.[weather]) {
    contextPhrase = pick(WEATHER_PHRASES[l][weather])
  } else {
    contextPhrase = pick(TIME_PHRASES[l][timeOfDay])
  }

  const proximity = getProximityPhrase(distanceMeters, l)

  const parts = [adjective, contextPhrase]
  if (proximity) parts.push(proximity)

  let text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Build reason tags for the context object (machine-readable).
 */
export function buildReasonTags(
  bestTag: string | null,
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  distanceMeters: number | null,
): string[] {
  const tags: string[] = []
  if (bestTag) tags.push(`tag:${bestTag}`)
  tags.push(`time:${timeOfDay}`)
  if (weather) tags.push(`weather:${weather}`)
  if (distanceMeters != null) {
    if (distanceMeters <= 500)       tags.push('proximity:very_close')
    else if (distanceMeters <= 1500) tags.push('proximity:close')
    else                             tags.push('proximity:moderate')
  }
  return tags
}

/**
 * Build a context summary for Concierge handoff.
 */
export function buildContextSummary(
  bestTag: string | null,
  timeOfDay: NowTimeOfDay,
  locale = 'en',
): string {
  const l = resolveLocale(locale)
  const label = bestTag ? getTagLabel(bestTag, locale).toLowerCase() : null

  const todMap: Record<string, Record<NowTimeOfDay, string>> = {
    en: { morning: 'this morning', midday: 'this midday', afternoon: 'this afternoon', evening: 'this evening', night: 'tonight', late_evening: 'tonight', deep_night: 'right now' },
    pt: { morning: 'esta manhã', midday: 'este meio-dia', afternoon: 'esta tarde', evening: 'esta noite', night: 'esta noite', late_evening: 'esta noite', deep_night: 'agora' },
    es: { morning: 'esta mañana', midday: 'este mediodía', afternoon: 'esta tarde', evening: 'esta noche', night: 'esta noche', late_evening: 'esta noche', deep_night: 'ahora' },
  }

  const subject = label ?? todMap[l][timeOfDay]

  return l === 'pt' ? `Outras opções para ${subject}`
       : l === 'es' ? `Otras opciones para ${subject}`
       : `Other great options for ${subject}`
}
