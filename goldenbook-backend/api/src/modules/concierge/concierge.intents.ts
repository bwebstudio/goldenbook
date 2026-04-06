// ─── Concierge Intent Registry ────────────────────────────────────────────────
//
// This is the single source of truth for all Concierge intents.
// Closed system — no AI, no dynamic generation. All intents are curated.
//
// V2 TODO: consider moving this to a DB table for admin editability.

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

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
  /** Times of day where this intent is most appropriate */
  preferredTimeOfDay: TimeOfDay[]
  /** User-input keywords that map to this intent (order matters: earlier = higher weight) */
  keywords: string[]
  /** Tie-breaking priority 1–10 (higher wins) */
  priority: number
}

export const INTENT_REGISTRY: ConciergeIntent[] = [
  {
    id: 'romantic_dinner',
    title: 'Romantic dinner',
    subtitle: 'Atmospheric tables for two',
    icon: 'restaurant',
    labels: ["Editor's choice"],
    placeTypes: ['restaurant'],
    editorialIntents: ['romantic_dinner', 'date_night'],
    fallbackIntents: ['fine_dining', 'trendy_restaurant'],
    categorySlugs: ['restaurant', 'fine-dining', 'dinner'],
    tags: ['romantic', 'date-night', 'atmospheric', 'fine-dining', 'intimate', 'candlelit', 'couple'],
    preferredTimeOfDay: ['evening'],
    keywords: ['romantic', 'romance', 'date', 'dinner', 'couple', 'anniversary', 'intimate'],
    priority: 9,
  },
  {
    id: 'hidden_gems',
    title: 'Hidden gems',
    subtitle: 'Curated places away from the crowds',
    icon: 'diamond',
    labels: ["Editor's choice"],
    placeTypes: ['restaurant', 'bar', 'cafe', 'shop', 'venue'],
    editorialIntents: ['hidden_gem_restaurant', 'local_food'],
    fallbackIntents: ['casual_dining', 'concept_store'],
    categorySlugs: [],
    tags: ['hidden', 'secret', 'local', 'neighbourhood', 'off-the-beaten-path', 'gem', 'undiscovered'],
    preferredTimeOfDay: ['morning', 'afternoon', 'evening'],
    keywords: ['hidden', 'secret', 'local', 'gem', 'discover', 'undiscovered', 'off beaten'],
    priority: 8,
  },
  {
    id: 'sunset_drinks',
    title: 'Sunset drinks',
    subtitle: 'The golden hour, elevated',
    icon: 'wb_sunny',
    labels: ['Highly recommended'],
    placeTypes: ['bar', 'restaurant'],
    editorialIntents: ['rooftop', 'scenic_views'],
    fallbackIntents: ['cocktail_bar', 'wine_bar'],
    categorySlugs: ['rooftop', 'terrace', 'view', 'bar'],
    tags: ['rooftop', 'terrace', 'view', 'sunset', 'outdoor', 'panoramic', 'golden-hour'],
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
    placeTypes: ['bar', 'restaurant'],
    editorialIntents: ['wine_bar'],
    fallbackIntents: ['fine_dining', 'date_night'],
    categorySlugs: ['bar', 'wine-bar', 'wine'],
    tags: ['wine', 'quiet', 'intimate', 'wine-bar', 'natural-wine', 'sommelier'],
    preferredTimeOfDay: ['afternoon', 'evening'],
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
    editorialIntents: ['cocktail_bar', 'nightlife'],
    fallbackIntents: ['wine_bar', 'late_night'],
    categorySlugs: ['cocktail-bar', 'bar', 'speakeasy'],
    tags: ['cocktails', 'craft-drinks', 'speakeasy', 'mixology', 'spirits', 'bartender'],
    preferredTimeOfDay: ['afternoon', 'evening'],
    keywords: ['cocktail', 'cocktails', 'drink', 'drinks', 'spirits', 'mixology', 'speakeasy'],
    priority: 7,
  },
  {
    id: 'late_night_jazz',
    title: 'Late-night jazz',
    subtitle: 'Sophisticated music after dark',
    icon: 'music_note',
    labels: ['Hidden gem'],
    placeTypes: ['bar', 'venue'],
    editorialIntents: ['jazz_bar', 'live_music', 'late_night'],
    fallbackIntents: ['nightlife', 'cocktail_bar'],
    categorySlugs: ['jazz', 'live-music', 'nightclub', 'music'],
    tags: ['jazz', 'live-music', 'music', 'nightlife', 'late-night', 'blues'],
    preferredTimeOfDay: ['evening'],
    keywords: ['jazz', 'music', 'live music', 'nightlife', 'night', 'blues', 'concert'],
    priority: 3,  // low: very few live-music venues across cities — only show if user searches for it
  },
  {
    id: 'long_lunch',
    title: 'Long lunch',
    subtitle: 'Unhurried midday dining at its finest',
    icon: 'restaurant',
    labels: ["Chef's recommendation"],
    placeTypes: ['restaurant'],
    editorialIntents: ['casual_dining', 'local_food', 'lunch_spot'],
    fallbackIntents: ['trendy_restaurant', 'fine_dining'],
    categorySlugs: ['restaurant', 'brasserie', 'bistro', 'lunch'],
    tags: ['lunch', 'leisurely', 'brasserie', 'bistro', 'midday', 'sunday-lunch'],
    preferredTimeOfDay: ['morning', 'afternoon'],
    keywords: ['lunch', 'midday', 'afternoon dining', 'brasserie', 'bistro', 'leisurely'],
    priority: 6,
  },
  {
    id: 'after_dinner_drinks',
    title: 'After-dinner drinks',
    subtitle: 'A refined cap to the evening',
    icon: 'nightlife',
    labels: ['Evening essential'],
    placeTypes: ['bar'],
    editorialIntents: ['cocktail_bar', 'late_night', 'nightlife'],
    fallbackIntents: ['wine_bar', 'jazz_bar'],
    categorySlugs: ['bar', 'cocktail-bar', 'lounge', 'whisky-bar'],
    tags: ['digestif', 'lounge', 'after-dinner', 'whisky', 'spirits', 'nightcap'],
    preferredTimeOfDay: ['evening'],
    keywords: ['after dinner', 'nightcap', 'lounge', 'digestif', 'late drinks', 'whisky', 'whiskey'],
    priority: 6,
  },
  {
    id: 'coffee_and_work',
    title: 'Coffee & work',
    subtitle: 'Thoughtfully brewed and quiet',
    icon: 'coffee',
    labels: ['Perfect for mornings'],
    placeTypes: ['cafe'],
    editorialIntents: ['coffee_shop', 'work_friendly', 'breakfast'],
    fallbackIntents: ['brunch', 'casual_dining'],
    categorySlugs: ['cafe', 'coffee', 'specialty-coffee'],
    tags: ['coffee', 'specialty-coffee', 'wifi', 'quiet', 'work', 'cafe', 'espresso', 'brunch'],
    preferredTimeOfDay: ['morning', 'afternoon'],
    keywords: ['coffee', 'cafe', 'espresso', 'work', 'laptop', 'breakfast', 'brunch', 'morning'],
    priority: 5,
  },
  {
    id: 'gallery_afternoon',
    title: 'Gallery afternoon',
    subtitle: 'Art, culture and refined spaces',
    icon: 'museum',
    labels: ['Cultural highlight'],
    placeTypes: ['museum', 'activity', 'landmark'],
    editorialIntents: ['explore_city', 'scenic_views'],
    fallbackIntents: ['nature', 'relaxing'],
    categorySlugs: ['gallery', 'museum', 'art', 'culture', 'landmark'],
    tags: ['gallery', 'art', 'museum', 'culture', 'contemporary', 'exhibition', 'design', 'heritage', 'monument'],
    preferredTimeOfDay: ['morning', 'afternoon'],
    keywords: ['gallery', 'art', 'museum', 'culture', 'exhibition', 'contemporary', 'design'],
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
    fallbackIntents: ['explore_city'],
    categorySlugs: ['boutique', 'design', 'fashion', 'shop', 'concept-store'],
    tags: ['boutique', 'design', 'fashion', 'concept-store', 'independent', 'shopping'],
    preferredTimeOfDay: ['morning', 'afternoon'],
    keywords: ['shop', 'shopping', 'boutique', 'fashion', 'design', 'concept store', 'buy'],
    priority: 4,
  },
  {
    id: 'relaxed_walk',
    title: 'Relaxed walk',
    subtitle: 'Beautiful stops along the way',
    icon: 'directions_walk',
    labels: ['Perfect for strolling'],
    placeTypes: ['cafe', 'bar', 'museum', 'activity', 'landmark', 'venue', 'shop'],
    editorialIntents: ['explore_city', 'scenic_views', 'hidden_gem_restaurant'],
    fallbackIntents: ['nature', 'relaxing', 'coffee_shop'],
    categorySlugs: ['viewpoint', 'terrace', 'cafe', 'culture', 'garden'],
    tags: ['viewpoint', 'terrace', 'coffee', 'local-secret', 'culture', 'sunset', 'wine', 'quiet', 'garden', 'scenic'],
    preferredTimeOfDay: ['morning', 'afternoon', 'evening'],
    keywords: ['walk', 'stroll', 'paseo', 'tranquilo', 'quiet walk', 'relax walk', 'caminar', 'passear', 'descobrir'],
    priority: 7,
  },
]

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
  relaxed_walk: {
    en: { title: 'Relaxed walk',          subtitle: 'Beautiful stops along the way',          labels: ['Perfect for strolling'] },
    pt: { title: 'Passeio tranquilo',     subtitle: 'Paragens bonitas pelo caminho',          labels: ['Perfeito para passear'] },
    es: { title: 'Paseo tranquilo',       subtitle: 'Paradas bonitas por el camino',          labels: ['Perfecto para pasear'] },
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
