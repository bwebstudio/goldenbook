// ─── Concierge Intent Registry ────────────────────────────────────────────────
//
// This is the single source of truth for all Concierge intents.
// Closed system — no AI, no dynamic generation. All intents are curated.
//
// V2 TODO: consider moving this to a DB table for admin editability.

import type { ContextTag } from '../shared-scoring/context-tags'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late_evening' | 'deep_night'

export interface ConciergeIntent {
  id: string
  title: string
  subtitle: string
  /** Material Symbols / icon name used by the frontend */
  icon: string
  /** Editorial labels shown on intent cards */
  labels: string[]
  /** DB place_type values that qualify places for this intent */
  placeTypes: string[]
  /** Editorial intent tags to match against places.intents column */
  editorialIntents: string[]
  /** Fallback intents: if primary doesn't match, try these (in order) */
  fallbackIntents: string[]
  /** Category slugs for secondary filtering (informational — used in future DB tag join) */
  categorySlugs: string[]
  /** Tags matched against short_description / editorial_summary for scoring */
  tags: string[]
  /**
   * Canonical context tags (subset of the 24 in shared-scoring/context-tags).
   * Used by concierge.service.ts to score places against the place_now_tags
   * table — gives a deterministic, structured signal on top of the legacy
   * description text matching.
   */
  canonicalTags: ContextTag[]
  /**
   * Canonical tags whose presence DISQUALIFIES a place from this intent.
   * E.g. `beautiful_spots` excludes places tagged dinner/lunch/cocktails so
   * restaurants and bars never appear in that pill's results.
   */
  canonicalExcludeTags?: ContextTag[]
  /** Times of day where this intent is most appropriate */
  preferredTimeOfDay: TimeOfDay[]
  /** User-input keywords that map to this intent (order matters: earlier = higher weight) */
  keywords: string[]
  /** Tie-breaking priority 1–10 (higher wins) */
  priority: number
}

export const INTENT_REGISTRY: ConciergeIntent[] = [
  // ── Dining ─────────────────────────────────────────────────────────────
  {
    id: 'romantic_dinner',
    title: 'Romantic dinner',
    subtitle: 'Atmospheric tables for two',
    icon: 'restaurant',
    labels: ["Editor's choice"],
    placeTypes: ['restaurant'],
    editorialIntents: ['romantic_dinner', 'date_night'],
    fallbackIntents: ['fine_dining'],
    categorySlugs: ['restaurant', 'fine-dining', 'dinner'],
    tags: ['romantic', 'date-night', 'fine-dining', 'intimate', 'candlelit'],
    canonicalTags: ['romantic', 'fine-dining', 'dinner'],
    // Dining service is over by late evening — keep this intent strictly
    // for the proper dinner window so the Concierge never suggests "romantic
    // dinner" at 23:44 (a real bug reported in pre-release testing).
    preferredTimeOfDay: ['evening'],
    keywords: ['romantic', 'romance', 'date', 'dinner', 'couple', 'anniversary', 'intimate'],
    priority: 9,
  },
  {
    id: 'long_lunch',
    title: 'Long lunch',
    subtitle: 'Unhurried midday dining at its finest',
    icon: 'restaurant',
    labels: ["Chef's recommendation"],
    placeTypes: ['restaurant'],
    editorialIntents: ['casual_dining', 'local_food', 'lunch_spot'],
    fallbackIntents: ['fine_dining'],
    categorySlugs: ['restaurant', 'brasserie', 'bistro', 'lunch'],
    tags: ['lunch', 'leisurely', 'brasserie', 'bistro', 'midday', 'sunday-lunch'],
    canonicalTags: ['lunch', 'brunch', 'sunday'],
    preferredTimeOfDay: ['morning', 'afternoon'],
    keywords: ['lunch', 'midday', 'afternoon dining', 'brasserie', 'bistro', 'leisurely'],
    priority: 6,
  },

  // ── Drinks (each with exclusive editorial territory) ───────────────────
  {
    id: 'sunset_drinks',
    title: 'Sunset drinks',
    subtitle: 'The golden hour, elevated',
    icon: 'wb_sunny',
    labels: ['Highly recommended'],
    placeTypes: ['bar', 'restaurant', 'hotel'],
    editorialIntents: ['rooftop', 'scenic_views'],
    fallbackIntents: [],
    categorySlugs: ['rooftop', 'terrace', 'bar'],
    tags: ['rooftop', 'terrace', 'sunset', 'outdoor', 'panoramic', 'golden-hour'],
    canonicalTags: ['sunset', 'rooftop', 'terrace', 'cocktails', 'wine'],
    preferredTimeOfDay: ['afternoon', 'evening'],
    keywords: ['sunset', 'rooftop', 'terrace', 'view', 'outdoor', 'panoramic', 'golden hour'],
    priority: 8,
  },
  {
    id: 'quiet_wine_bar',
    title: 'Quiet wine bar',
    subtitle: 'Elegant pours and a slower pace',
    icon: 'wine_bar',
    labels: ['Highly recommended'],
    placeTypes: ['bar'],
    editorialIntents: ['wine_bar'],
    fallbackIntents: [],
    categorySlugs: ['bar', 'wine-bar', 'wine'],
    tags: ['wine', 'wine-bar', 'natural-wine', 'sommelier', 'quiet'],
    canonicalTags: ['wine'],
    preferredTimeOfDay: ['afternoon', 'evening', 'late_evening'],
    keywords: ['wine', 'wines', 'vino', 'winery', 'wine bar', 'natural wine'],
    priority: 7,
  },
  {
    id: 'cocktail_bars',
    title: 'Cocktail bars',
    subtitle: 'Handcrafted drinks and craft spirits',
    icon: 'local_bar',
    labels: ['Highly recommended'],
    placeTypes: ['bar'],
    editorialIntents: ['cocktail_bar'],
    fallbackIntents: [],
    categorySlugs: ['cocktail-bar', 'bar', 'speakeasy'],
    tags: ['cocktails', 'speakeasy', 'mixology', 'craft-drinks', 'spirits'],
    canonicalTags: ['cocktails', 'late-night', 'rooftop'],
    preferredTimeOfDay: ['evening', 'late_evening'],
    keywords: ['cocktail', 'cocktails', 'drink', 'drinks', 'spirits', 'mixology', 'speakeasy'],
    priority: 7,
  },
  {
    id: 'after_dinner_drinks',
    title: 'After-dinner drinks',
    subtitle: 'A refined cap to the evening',
    icon: 'nightlife',
    labels: ['Evening essential'],
    placeTypes: ['bar', 'hotel'],
    editorialIntents: ['nightlife'],
    fallbackIntents: ['hotel_bar'],
    categorySlugs: ['bar', 'lounge', 'whisky-bar', 'hotel-bar'],
    tags: ['digestif', 'lounge', 'after-dinner', 'whisky', 'nightcap', 'hotel-bar'],
    canonicalTags: ['cocktails', 'wine', 'late-night'],
    preferredTimeOfDay: ['evening', 'late_evening'],
    keywords: ['after dinner', 'nightcap', 'lounge', 'digestif', 'late drinks', 'whisky', 'whiskey'],
    priority: 6,
  },
  {
    id: 'late_night_drinks',
    title: 'Late-night drinks',
    subtitle: 'The bar is still open',
    icon: 'local_bar',
    labels: ['Night owl'],
    placeTypes: ['bar', 'hotel'],
    editorialIntents: ['late_night', 'hotel_bar'],
    fallbackIntents: ['nightlife'],
    categorySlugs: ['bar', 'hotel-bar', 'lounge', 'nightclub'],
    tags: ['late-night', 'nightlife', 'lounge', 'hotel-bar'],
    canonicalTags: ['late-night', 'cocktails', 'wine'],
    preferredTimeOfDay: ['late_evening', 'deep_night'],
    keywords: ['late drink', 'still open', 'bar open', 'nightcap', 'last drink', 'after hours'],
    priority: 7,
  },
  {
    id: 'late_night_jazz',
    title: 'Late-night jazz',
    subtitle: 'Sophisticated music after dark',
    icon: 'music_note',
    labels: ['Hidden gem'],
    placeTypes: ['bar', 'venue'],
    editorialIntents: ['jazz_bar', 'live_music'],
    fallbackIntents: ['nightlife'],
    categorySlugs: ['jazz', 'live-music', 'nightclub', 'music'],
    tags: ['jazz', 'live-music', 'music', 'nightlife', 'late-night', 'blues'],
    canonicalTags: ['live-music', 'late-night', 'cocktails'],
    preferredTimeOfDay: ['evening', 'late_evening', 'deep_night'],
    keywords: ['jazz', 'music', 'live music', 'nightlife', 'night', 'blues', 'concert'],
    priority: 3,
  },

  // ── Discovery & Culture ────────────────────────────────────────────────
  {
    id: 'beautiful_spots',
    title: 'Beautiful spots',
    subtitle: 'Scenic and elegant places worth discovering',
    icon: 'photo_camera',
    labels: ['Visually stunning'],
    placeTypes: ['landmark', 'museum', 'activity', 'beach'],
    editorialIntents: ['scenic_views', 'viewpoint'],
    fallbackIntents: ['nature'],
    categorySlugs: ['viewpoint', 'garden', 'park', 'nature', 'landmark'],
    tags: ['viewpoint', 'scenic', 'panoramic', 'heritage', 'garden', 'architecture'],
    canonicalTags: ['viewpoint', 'nature', 'sunset', 'terrace'],
    // Hard exclusion: any of these tags removes the place from the candidate
    // set entirely (applied as -1000 score in concierge.route.ts STEP 2f-bis,
    // which gets dropped by the `score > 0` filter).
    canonicalExcludeTags: ['dinner', 'lunch', 'fine-dining', 'cocktails', 'wine'],
    preferredTimeOfDay: ['morning', 'afternoon', 'evening'],
    keywords: [
      'beautiful', 'scenic', 'views', 'viewpoint', 'miradouro', 'bonito', 'bonita',
      'fotogénico', 'photogenic', 'architecture', 'arquitectura', 'garden', 'jardín', 'jardim',
      'palace', 'palacio', 'palácio', 'heritage', 'patrimonio', 'património',
      'landscape', 'paisaje', 'paisagem', 'elegant', 'elegante',
      'discover', 'descobrir', 'descubrir', 'lugar bonito', 'lugares bonitos',
    ],
    priority: 7,
  },
  {
    id: 'hidden_gems',
    title: 'Hidden gems',
    subtitle: 'Local favourites away from the crowds',
    icon: 'diamond',
    labels: ["Editor's choice"],
    placeTypes: ['restaurant', 'cafe', 'shop'],
    editorialIntents: ['hidden_gem_restaurant', 'local_food'],
    fallbackIntents: ['concept_store'],
    categorySlugs: [],
    tags: ['hidden', 'secret', 'local', 'neighbourhood', 'off-the-beaten-path', 'undiscovered'],
    canonicalTags: ['local-secret'],
    preferredTimeOfDay: ['morning', 'afternoon'],
    keywords: ['hidden', 'secret', 'local', 'gem', 'discover', 'undiscovered', 'off beaten'],
    priority: 5,
  },
  {
    id: 'gallery_afternoon',
    title: 'Gallery afternoon',
    subtitle: 'Art, culture and refined spaces',
    icon: 'museum',
    labels: ['Cultural highlight'],
    placeTypes: ['museum', 'activity', 'landmark'],
    editorialIntents: ['explore_city'],
    fallbackIntents: [],
    categorySlugs: ['gallery', 'museum', 'art', 'culture', 'landmark'],
    tags: ['gallery', 'art', 'museum', 'culture', 'contemporary', 'exhibition', 'heritage', 'monument'],
    canonicalTags: ['culture', 'rainy-day'],
    canonicalExcludeTags: ['dinner', 'cocktails', 'late-night'],
    preferredTimeOfDay: ['morning', 'afternoon'],
    keywords: ['gallery', 'art', 'museum', 'culture', 'exhibition', 'contemporary'],
    priority: 5,
  },
  {
    id: 'design_shopping',
    title: 'Design shopping',
    subtitle: 'Curated boutiques and independent stores',
    icon: 'shopping_bag',
    labels: ['Curated selection'],
    placeTypes: ['shop'],
    editorialIntents: ['concept_store', 'luxury_shopping', 'local_shops'],
    fallbackIntents: [],
    categorySlugs: ['boutique', 'design', 'fashion', 'shop', 'concept-store'],
    tags: ['boutique', 'design', 'fashion', 'concept-store', 'independent', 'shopping'],
    canonicalTags: ['shopping'],
    canonicalExcludeTags: ['dinner', 'cocktails', 'late-night'],
    preferredTimeOfDay: ['morning', 'afternoon'],
    keywords: ['shop', 'shopping', 'boutique', 'fashion', 'design', 'concept store', 'buy'],
    priority: 4,
  },

  // ── Night / Outdoors ───────────────────────────────────────────────────
  {
    id: 'night_walk',
    title: 'Night walk',
    subtitle: 'The city after dark, on foot',
    icon: 'explore',
    labels: ['After hours'],
    placeTypes: ['landmark', 'beach', 'activity'],
    editorialIntents: ['viewpoint', 'scenic_walk'],
    fallbackIntents: [],
    categorySlugs: ['viewpoint', 'park', 'bridge', 'promenade', 'plaza'],
    tags: ['viewpoint', 'night-walk', 'scenic', 'city-lights', 'waterfront'],
    canonicalTags: ['viewpoint', 'sunset', 'romantic', 'nature'],
    canonicalExcludeTags: ['dinner', 'shopping'],
    // Removed deep_night: at 02:00+ Goldenbook only recommends bars and hotels.
    preferredTimeOfDay: ['evening', 'late_evening'],
    keywords: ['night walk', 'city lights', 'walk', 'stroll', 'paseo', 'promenade', 'viewpoint at night'],
    priority: 5,
  },

  // ── Daytime casual ─────────────────────────────────────────────────────
  {
    id: 'coffee_and_work',
    title: 'Coffee & work',
    subtitle: 'Thoughtfully brewed and quiet',
    icon: 'coffee',
    labels: ['Perfect for mornings'],
    placeTypes: ['cafe'],
    editorialIntents: ['coffee_shop', 'work_friendly', 'breakfast'],
    fallbackIntents: ['brunch'],
    categorySlugs: ['cafe', 'coffee', 'specialty-coffee'],
    tags: ['coffee', 'specialty-coffee', 'wifi', 'work', 'cafe', 'espresso'],
    canonicalTags: ['coffee', 'brunch', 'quick-stop'],
    canonicalExcludeTags: ['dinner', 'late-night', 'cocktails'],
    preferredTimeOfDay: ['morning', 'afternoon'],
    keywords: ['coffee', 'cafe', 'espresso', 'work', 'laptop', 'breakfast', 'brunch', 'morning'],
    priority: 5,
  },
]

// ─── Intent conflict pairs (never show together in bootstrap) ────────────
//
// Each pair represents intents that are too similar in results to appear as
// separate pills in the same bootstrap set. Used by getBootstrapIntents()
// and getDynamicFallbackIntents() to guarantee editorial diversity.

export const INTENT_CONFLICTS: [string, string][] = [
  ['cocktail_bars',     'after_dinner_drinks'],   // both: drinks at a bar
  ['cocktail_bars',     'late_night_drinks'],      // both: drinks late
  ['quiet_wine_bar',    'after_dinner_drinks'],    // both: quiet drinks
  ['beautiful_spots',   'hidden_gems'],            // both: discover places
  ['romantic_dinner',   'quiet_wine_bar'],         // both: intimate dining/drinking
  ['sunset_drinks',     'beautiful_spots'],        // both: scenic places
  ['gallery_afternoon', 'beautiful_spots'],        // both: cultural/scenic
  ['late_night_drinks', 'late_night_jazz'],         // both: late night out
]

// ─── Bootstrap editorial matrix ──────────────────────────────────────────
//
// Curated sets of 3 pills per time slot. The first set is preferred;
// fallback sets are tried if the primary set lacks viable intents in the city.
// No two conflicting intents ever appear in the same set.

export const BOOTSTRAP_MATRIX: Record<TimeOfDay, string[][]> = {
  morning: [
    ['coffee_and_work', 'beautiful_spots', 'gallery_afternoon'],
    ['coffee_and_work', 'hidden_gems', 'design_shopping'],
    ['coffee_and_work', 'beautiful_spots', 'design_shopping'],
  ],
  afternoon: [
    ['long_lunch', 'beautiful_spots', 'design_shopping'],
    ['long_lunch', 'gallery_afternoon', 'hidden_gems'],
    ['long_lunch', 'beautiful_spots', 'gallery_afternoon'],
  ],
  evening: [
    ['sunset_drinks', 'romantic_dinner', 'quiet_wine_bar'],
    ['sunset_drinks', 'romantic_dinner', 'cocktail_bars'],
    ['romantic_dinner', 'cocktail_bars', 'quiet_wine_bar'],
  ],
  late_evening: [
    // After 23:00 the night is for drinks, jazz and quiet wine bars —
    // never for "romantic dinner" pills, since most kitchens are closed
    // by then. Sets are tried in order until one is fully viable.
    ['cocktail_bars', 'after_dinner_drinks', 'late_night_jazz'],
    ['cocktail_bars', 'after_dinner_drinks', 'quiet_wine_bar'],
    ['late_night_drinks', 'cocktail_bars', 'late_night_jazz'],
  ],
  deep_night: [
    // After 02:00: only bars and hotels. No walks, beaches, nature.
    ['late_night_drinks', 'late_night_jazz', 'cocktail_bars'],
    ['late_night_drinks', 'cocktail_bars', 'quiet_wine_bar'],
    ['cocktail_bars', 'late_night_jazz', 'quiet_wine_bar'],
  ],
}

// Fast lookup by id
export const INTENT_MAP = new Map<string, ConciergeIntent>(
  INTENT_REGISTRY.map((intent) => [intent.id, intent]),
)

export function getIntentById(id: string): ConciergeIntent | undefined {
  return INTENT_MAP.get(id)
}

// ─── Intent label i18n ────────────────────────────────────────────────────────
//
// Locale-aware labels for intent titles / subtitles / editorial labels.
// Resolution order: exact locale → locale family → 'en'

export interface IntentLabels {
  title: string
  subtitle: string
  labels: string[]
}

const INTENT_LABELS_I18N: Record<string, Partial<Record<string, IntentLabels>>> = {
  romantic_dinner: {
    en: { title: 'Romantic dinner',       subtitle: 'Atmospheric tables for two',            labels: ["Editor's choice"] },
    pt: { title: 'Jantar romântico',      subtitle: 'Mesas intimistas para dois',            labels: ['Escolha do editor'] },
    es: { title: 'Cena romántica',        subtitle: 'Mesas íntimas para dos',                 labels: ['Elección del editor'] },
  },
  hidden_gems: {
    en: { title: 'Hidden gems',           subtitle: 'Curated places away from the crowds',   labels: ["Editor's choice"] },
    pt: { title: 'Lugares secretos',      subtitle: 'Lugares longe das multidões',            labels: ['Escolha do editor'] },
    es: { title: 'Lugares secretos',      subtitle: 'Lugares lejos de las multitudes',        labels: ['Elección del editor'] },
  },
  sunset_drinks: {
    en: { title: 'Sunset drinks',         subtitle: 'The golden hour, elevated',             labels: ['Highly recommended'] },
    pt: { title: 'Drinks ao pôr do sol',  subtitle: 'A hora dourada, elevada',               labels: ['Muito recomendado'] },
    es: { title: 'Cócteles al atardecer', subtitle: 'La hora dorada, elevada',               labels: ['Muy recomendado'] },
  },
  quiet_wine_bar: {
    en: { title: 'Quiet wine bar',        subtitle: 'Elegant pours and a slower pace',       labels: ['Highly recommended'] },
    pt: { title: 'Bar de vinhos',         subtitle: 'Vinhos refinados e um ritmo mais lento', labels: ['Muito recomendado'] },
    es: { title: 'Bar de vinos tranquilo', subtitle: 'Vinos refinados y un ritmo más lento',  labels: ['Muy recomendado'] },
  },
  cocktail_bars: {
    en: { title: 'Cocktail bars',         subtitle: 'Handcrafted drinks and craft spirits',  labels: ['Highly recommended'] },
    pt: { title: 'Bares de cocktails',    subtitle: 'Bebidas artesanais e destilados',       labels: ['Muito recomendado'] },
    es: { title: 'Bares de cócteles',     subtitle: 'Bebidas artesanales y destilados',      labels: ['Muy recomendado'] },
  },
  late_night_jazz: {
    en: { title: 'Late-night jazz',       subtitle: 'Sophisticated music after dark',        labels: ['Hidden gem'] },
    pt: { title: 'Jazz nocturno',         subtitle: 'Música sofisticada depois do anoitecer', labels: ['Joia escondida'] },
    es: { title: 'Jazz nocturno',         subtitle: 'Música sofisticada al caer la noche',   labels: ['Joya escondida'] },
  },
  long_lunch: {
    en: { title: 'Long lunch',            subtitle: 'Unhurried midday dining at its finest', labels: ["Chef's recommendation"] },
    pt: { title: 'Almoço longo',          subtitle: 'Refeição de meio-dia sem pressa',       labels: ['Recomendação do chef'] },
    es: { title: 'Almuerzo largo',        subtitle: 'Comida de mediodía sin prisas',         labels: ['Recomendación del chef'] },
  },
  after_dinner_drinks: {
    en: { title: 'After-dinner drinks',   subtitle: 'A refined cap to the evening',          labels: ['Evening essential'] },
    pt: { title: 'Digestivos',            subtitle: 'Um final refinado para a noite',        labels: ['Essencial à noite'] },
    es: { title: 'Copas después de cenar', subtitle: 'Un final refinado para la noche',      labels: ['Esencial nocturno'] },
  },
  night_walk: {
    en: { title: 'Night walk',             subtitle: 'The city after dark, on foot',          labels: ['After hours'] },
    pt: { title: 'Passeio noturno',        subtitle: 'A cidade depois de escurecer, a pé',   labels: ['Depois da hora'] },
    es: { title: 'Paseo nocturno',         subtitle: 'La ciudad de noche, a pie',             labels: ['Fuera de horario'] },
  },
  late_night_drinks: {
    en: { title: 'Late-night drinks',      subtitle: 'The bar is still open',                 labels: ['Night owl'] },
    pt: { title: 'Drinks de madrugada',    subtitle: 'O bar ainda está aberto',               labels: ['Noctívago'] },
    es: { title: 'Copas de madrugada',     subtitle: 'El bar aún está abierto',               labels: ['Noctámbulo'] },
  },
  coffee_and_work: {
    en: { title: 'Coffee & work',         subtitle: 'Thoughtfully brewed and quiet',         labels: ['Perfect for mornings'] },
    pt: { title: 'Café & trabalho',       subtitle: 'Café de especialidade e tranquilidade', labels: ['Perfeito de manhã'] },
    es: { title: 'Café y trabajo',        subtitle: 'Café de especialidad y calma',           labels: ['Perfecto para la mañana'] },
  },
  gallery_afternoon: {
    en: { title: 'Gallery afternoon',     subtitle: 'Art, culture and refined spaces',       labels: ['Cultural highlight'] },
    pt: { title: 'Tarde em galeria',      subtitle: 'Arte, cultura e espaços refinados',     labels: ['Destaque cultural'] },
    es: { title: 'Tarde de galerías',     subtitle: 'Arte, cultura y espacios refinados',    labels: ['Destacado cultural'] },
  },
  design_shopping: {
    en: { title: 'Design shopping',       subtitle: 'Curated boutiques and independent stores', labels: ['Curated selection'] },
    pt: { title: 'Compras de design',     subtitle: 'Boutiques e lojas independentes',       labels: ['Seleção curada'] },
    es: { title: 'Compras de diseño',     subtitle: 'Boutiques y tiendas independientes',     labels: ['Selección curada'] },
  },
  beautiful_spots: {
    en: { title: 'Beautiful spots',        subtitle: 'Scenic and elegant places worth discovering',         labels: ['Visually stunning'] },
    pt: { title: 'Lugares bonitos',        subtitle: 'Lugares com beleza e carácter que valem a visita',    labels: ['Visualmente marcantes'] },
    es: { title: 'Lugares bonitos',        subtitle: 'Lugares con belleza y carácter que merecen la visita', labels: ['Visualmente memorables'] },
  },
}

export function getIntentLabels(intentId: string, locale: string): IntentLabels {
  const localeMap = INTENT_LABELS_I18N[intentId]
  if (!localeMap) {
    const intent = getIntentById(intentId)
    return intent
      ? { title: intent.title, subtitle: intent.subtitle, labels: intent.labels }
      : { title: intentId, subtitle: '', labels: [] }
  }
  const localeFamily = locale.split('-')[0]
  return localeMap[locale] ?? localeMap[localeFamily] ?? localeMap['en']!
}
