// ─── Generate Place from Google Places ────────────────────────────────────
// Takes a Google Place ID, fetches all details, and returns a preview
// with all fields pre-filled. The place is NOT created until the editor saves.

import { db } from '../../../db/postgres'

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

// ─── Google Places API (New) ──────────────────────────────────────────────

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location',
  'internationalPhoneNumber', 'websiteUri', 'googleMapsUri',
  'regularOpeningHours', 'priceLevel', 'rating', 'userRatingCount',
  'primaryType', 'types', 'reservable', 'editorialSummary', 'reviews',
  'photos',
].join(',')

interface GooglePlaceDetail {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  regularOpeningHours?: {
    periods?: Array<{
      open: { day: number; hour: number; minute: number }
      close?: { day: number; hour: number; minute: number }
    }>
    weekdayDescriptions?: string[]
  }
  priceLevel?: string
  rating?: number
  userRatingCount?: number
  primaryType?: string
  types?: string[]
  reservable?: boolean
  editorialSummary?: { text: string }
  reviews?: Array<{ text?: { text: string }; rating?: number }>
  photos?: Array<{ name: string; widthPx: number; heightPx: number; authorAttributions?: Array<{ displayName: string; uri: string }> }>
}

async function fetchGooglePlaceDetails(placeId: string): Promise<GooglePlaceDetail | null> {
  const url = `https://places.googleapis.com/v1/places/${placeId}`
  try {
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': DETAIL_FIELDS,
      },
    })
    if (!res.ok) return null
    return await res.json() as GooglePlaceDetail
  } catch {
    return null
  }
}

// ─── Google Places Autocomplete ───────────────────────────────────────────

interface AutocompleteResult {
  placeId: string
  name: string
  address: string
  lat?: number
  lng?: number
}

export async function searchGooglePlaces(query: string): Promise<AutocompleteResult[]> {
  if (!GOOGLE_API_KEY) return []
  const url = 'https://places.googleapis.com/v1/places:searchText'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'pt',
        maxResultCount: 8,
      }),
    })
    if (!res.ok) return []
    const data = await res.json() as { places?: Array<{ id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }> }
    return (data.places ?? []).map(p => ({
      placeId: p.id,
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? '',
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    }))
  } catch {
    return []
  }
}

// ─── Auto-detect city by coordinates ──────────────────────────────────────

const CITY_CENTERS: { slug: string; lat: number; lng: number }[] = [
  { slug: 'porto',   lat: 41.1579, lng: -8.6291 },
  { slug: 'lisboa',  lat: 38.7223, lng: -9.1393 },
  { slug: 'algarve', lat: 37.0194, lng: -7.9304 },
  { slug: 'madeira', lat: 32.6669, lng: -16.9241 },
]

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function detectCity(lat: number, lng: number): string {
  let closest = 'lisboa'
  let minDist = Infinity
  for (const c of CITY_CENTERS) {
    const d = haversineKm(lat, lng, c.lat, c.lng)
    if (d < minDist) { minDist = d; closest = c.slug }
  }
  return closest
}

// ─── Type mapping ─────────────────────────────────────────────────────────

const GOOGLE_TYPE_TO_PLACE_TYPE: Record<string, string> = {
  restaurant: 'restaurant', fine_dining_restaurant: 'restaurant',
  seafood_restaurant: 'restaurant', italian_restaurant: 'restaurant',
  japanese_restaurant: 'restaurant', french_restaurant: 'restaurant',
  cafe: 'cafe', coffee_shop: 'cafe', bakery: 'cafe',
  bar: 'bar', wine_bar: 'bar', cocktail_bar: 'bar', pub: 'bar',
  hotel: 'hotel', resort_hotel: 'hotel', guest_house: 'hotel',
  museum: 'museum', art_gallery: 'museum',
  tourist_attraction: 'landmark', church: 'landmark', historical_landmark: 'landmark',
  beach: 'beach', national_park: 'activity', park: 'activity',
  spa: 'activity', gym: 'activity', golf_course: 'activity',
  shopping_mall: 'shop', clothing_store: 'shop', jewelry_store: 'shop',
  night_club: 'venue', event_venue: 'venue',
}

const CUISINE_MAP: Record<string, string> = {
  portuguese_restaurant: 'portuguese', seafood_restaurant: 'seafood',
  italian_restaurant: 'italian', japanese_restaurant: 'japanese',
  french_restaurant: 'french', chinese_restaurant: 'chinese',
  indian_restaurant: 'indian', mexican_restaurant: 'mexican',
  spanish_restaurant: 'spanish', thai_restaurant: 'thai',
  mediterranean_restaurant: 'mediterranean', asian_restaurant: 'asian',
  fine_dining_restaurant: 'fine-dining', brunch_restaurant: 'brunch',
  steak_house: 'steakhouse', sushi_restaurant: 'japanese',
  vegan_restaurant: 'vegan', vegetarian_restaurant: 'vegetarian',
}

function mapPlaceType(googleTypes: string[]): string {
  for (const t of googleTypes) {
    if (GOOGLE_TYPE_TO_PLACE_TYPE[t]) return GOOGLE_TYPE_TO_PLACE_TYPE[t]
  }
  return 'restaurant'
}

function extractCuisines(googleTypes: string[]): string[] {
  const cuisines = new Set<string>()
  for (const t of googleTypes) { if (CUISINE_MAP[t]) cuisines.add(CUISINE_MAP[t]) }
  return [...cuisines]
}

function mapPriceLevel(level: string | undefined): number | null {
  switch (level) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE': return 1
    case 'PRICE_LEVEL_MODERATE': return 2
    case 'PRICE_LEVEL_EXPENSIVE': return 3
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4
    default: return null
  }
}

function toSlug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ─── Category resolution ──────────────────────────────────────────────────

const TYPE_TO_CATEGORY: Record<string, string> = {
  restaurant: 'gastronomy', cafe: 'gastronomy', bar: 'gastronomy',
  hotel: 'alojamento', shop: 'retail', museum: 'culture',
  landmark: 'culture', activity: 'experiences', beach: 'natureza-outdoor',
  venue: 'experiences', transport: 'mobilidade',
}

const TYPE_TO_SUBCATEGORY: Record<string, string> = {
  restaurant: 'restaurantes', cafe: 'cafes', bar: 'bares',
  hotel: 'hoteis', shop: 'lojas-locais', museum: 'museus',
  landmark: 'sitios-historicos', activity: 'experiencias-unicas',
  beach: 'praias', venue: 'eventos',
}

// ─── Editorial note generation ────────────────────────────────────────────

// Extract location context (coastal, historic, etc.) from the address — NOT the street address
function extractLocationContext(address: string): string | null {
  const addr = address.toLowerCase()
  // Coastal / seaside
  if (['praia', 'beach', 'marina', 'cais', 'doca', 'marginal', 'estoril', 'cascais', 'guincho', 'foz', 'matosinhos'].some(k => addr.includes(k)))
    return 'on the coast'
  // Riverside
  if (['ribeira', 'rio', 'douro', 'tejo', 'tagus'].some(k => addr.includes(k)))
    return 'by the river'
  // Historic centre
  if (['centro histórico', 'zona velha', 'old town', 'alfama', 'bairro alto', 'chiado', 'baixa', 'sé', 'largo'].some(k => addr.includes(k)))
    return 'in the historic centre'
  // Hilltop / viewpoint
  if (['miradouro', 'alto', 'castelo', 'serra'].some(k => addr.includes(k)))
    return 'with elevated views'
  // Town references for context
  if (addr.includes('sintra')) return 'in the hills of Sintra'
  if (addr.includes('braga')) return 'in Braga'
  if (addr.includes('guimarães') || addr.includes('guimaraes')) return 'in Guimarães'
  if (addr.includes('funchal')) return 'in Funchal'
  if (addr.includes('vilamoura')) return 'in Vilamoura'
  if (addr.includes('albufeira')) return 'in Albufeira'
  if (addr.includes('portimão') || addr.includes('portimao')) return 'in Portimão'
  if (addr.includes('faro')) return 'in Faro'
  if (addr.includes('ponta do sol')) return 'in Ponta do Sol'
  if (addr.includes('gaia')) return 'in Vila Nova de Gaia'
  return null
}

function generateEditorialNote(name: string, placeType: string, city: string, address: string, cuisines: string[], priceTier: number | null, rating: number | null): string {
  const cityName = { porto: 'Porto', lisboa: 'Lisbon', algarve: 'the Algarve', madeira: 'Madeira' }[city] ?? city
  const location = extractLocationContext(address)

  if (placeType === 'restaurant') {
    const parts: string[] = []
    if (priceTier === 4) parts.push('A refined dining address')
    else if (priceTier === 3) parts.push('A well-regarded restaurant')
    else parts.push('A welcoming restaurant')
    if (location) parts.push(location)
    else parts.push(`in ${cityName}`)
    if (cuisines.includes('seafood')) parts.push('with a focus on fresh seafood')
    else if (cuisines.includes('italian')) parts.push('drawing on Italian tradition')
    else if (cuisines.includes('japanese')) parts.push('with precise Japanese cooking')
    else if (cuisines.includes('portuguese')) parts.push('rooted in Portuguese tradition')
    else if (cuisines.includes('fine-dining')) parts.push('where each course is composed with care')
    if (rating && rating >= 4.5) parts.push(`and a loyal following (${rating}★)`)
    return parts.join(' ') + '.'
  }
  const ctx = location ?? `in ${cityName}`
  if (placeType === 'cafe') return `A café ${ctx} worth lingering over.`
  if (placeType === 'bar') return `A bar ${ctx} where the drink list is considered and the atmosphere earned.`
  if (placeType === 'hotel') return `A hotel ${ctx} with well-judged rooms and a sense of place.`
  if (placeType === 'shop') return `A curated shop ${ctx} with a selection that speaks to local taste.`
  if (placeType === 'museum') return `A museum ${ctx} that rewards the curious visitor.`
  if (placeType === 'landmark') return `A landmark ${ctx} that anchors the neighbourhood and rewards an unhurried visit.`
  if (placeType === 'beach') return `A stretch of coast ${ctx} with the right balance of space, water, and atmosphere.`
  if (placeType === 'activity') return `An experience ${ctx} worth carving out time for.`
  return `A distinctive address ${ctx}.`
}

function generateInsiderTip(placeType: string): string {
  const tips: Record<string, string[]> = {
    restaurant: ['Arrive without a fixed order in mind — the daily suggestions are often the strongest.', 'The lunch service tends to be calmer — ideal for tasting the menu at its best.'],
    cafe: ['Come before 10 for the full selection and a quiet seat.', 'The outdoor seats are perfect for a slow morning coffee.'],
    bar: ['The first hour after opening is the best time for a seat and full attention at the bar.', 'Ask the bartender for something off-menu.'],
    hotel: ['Ask for a room with a view when booking — the upgrade is often available.'],
    shop: ['Visit on a weekday morning for the most unhurried browsing experience.'],
    museum: ['Visit in the first hour after opening — the galleries are quieter.'],
    landmark: ['Visit outside peak hours for a more contemplative experience.'],
    beach: ['Arrive before midday for the best spots.'],
    activity: ['Book in advance — walk-ins are possible but the schedule fills quickly.'],
  }
  const arr = tips[placeType] ?? ['Worth arriving with extra time — the details reward attention.']
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Description generation (editorial, signal-based) ───────────────────

// Signal keywords extracted from reviews — grouped by what they tell us
const ATMOSPHERE_SIGNALS: Record<string, string[]> = {
  calm:     ['quiet', 'tranquil', 'peaceful', 'calmo', 'tranquilo', 'relaxing', 'serene', 'sossegado'],
  lively:   ['lively', 'vibrant', 'buzzing', 'animado', 'energetic', 'busy'],
  cosy:     ['cosy', 'cozy', 'intimate', 'acolhedor', 'aconchegante', 'warm', 'charming'],
  elegant:  ['elegant', 'refined', 'sophisticated', 'classy', 'chic', 'stylish', 'upscale'],
  casual:   ['casual', 'relaxed', 'laid-back', 'informal', 'easygoing', 'descontraído'],
  romantic: ['romantic', 'romântico', 'candlelit', 'date night', 'date-night'],
}

const QUALITY_SIGNALS: Record<string, string[]> = {
  food:       ['delicious', 'tasty', 'flavour', 'flavor', 'fresh', 'saboroso', 'fresco', 'well-cooked', 'perfectly cooked'],
  drinks:     ['cocktail', 'wine list', 'wine selection', 'craft beer', 'gin', 'natural wine'],
  coffee:     ['coffee', 'espresso', 'café', 'flat white', 'latte', 'pastry', 'pastries', 'baked'],
  service:    ['attentive', 'friendly staff', 'warm service', 'welcoming', 'simpático', 'hospitaleiro'],
  views:      ['view', 'vista', 'panoramic', 'overlook', 'terrace', 'rooftop', 'outdoor', 'esplanada', 'terraço'],
  selection:  ['curated', 'selection', 'variety', 'unique finds', 'local brands', 'handmade', 'artisanal'],
}

const EXPERIENCE_SIGNALS: Record<string, string[]> = {
  morning:  ['breakfast', 'brunch', 'morning', 'pequeno-almoço', 'start the day'],
  slow:     ['linger', 'spend hours', 'stay all day', 'lose track of time', 'slow', 'unhurried'],
  social:   ['friends', 'group', 'family', 'gathering', 'celebration', 'amigos', 'família'],
  solo:     ['alone', 'solo', 'book', 'reading', 'laptop', 'work from'],
  special:  ['special occasion', 'anniversary', 'birthday', 'celebration', 'memorable'],
}

interface DescriptionSignals {
  atmospheres: string[]
  qualities: string[]
  experiences: string[]
}

function extractSignalsFromReviews(reviews: Array<{ text?: { text: string }; rating?: number }>): DescriptionSignals {
  const good = reviews
    .filter(r => r.rating && r.rating >= 4 && r.text?.text && r.text.text.length > 20)
    .map(r => r.text!.text.toLowerCase())

  const text = good.join(' ')
  const atmospheres: string[] = []
  const qualities: string[] = []
  const experiences: string[] = []

  // A signal is "consistent" if it appears in at least 2 reviews, or the corpus is small (≤3 reviews)
  const threshold = good.length <= 3 ? 1 : 2

  for (const [signal, keywords] of Object.entries(ATMOSPHERE_SIGNALS)) {
    const count = good.filter(r => keywords.some(k => r.includes(k))).length
    if (count >= threshold) atmospheres.push(signal)
  }
  for (const [signal, keywords] of Object.entries(QUALITY_SIGNALS)) {
    const count = good.filter(r => keywords.some(k => r.includes(k))).length
    if (count >= threshold) qualities.push(signal)
  }
  for (const [signal, keywords] of Object.entries(EXPERIENCE_SIGNALS)) {
    const count = good.filter(r => keywords.some(k => r.includes(k))).length
    if (count >= threshold) experiences.push(signal)
  }

  return { atmospheres, qualities, experiences }
}

// ── Editorial phrase banks (never copy reviews — compose from signals) ──

const ATMOSPHERE_PHRASES: Record<string, string> = {
  calm:     'with a calm, unhurried feel',
  lively:   'with a lively energy that draws a regular crowd',
  cosy:     'with an intimate, well-worn charm',
  elegant:  'with a polished, understated elegance',
  casual:   'with an easygoing character and no pretence',
  romantic: 'with an atmosphere suited to quieter, more personal evenings',
}

const QUALITY_PHRASES: Record<string, string[]> = {
  food:       ['where the cooking is precise and flavour-led', 'where the kitchen takes ingredients seriously'],
  drinks:     ['with a drink list that rewards curiosity', 'where the drinks are considered and well-made'],
  coffee:     ['with coffee that sets the standard', 'where the coffee and pastry selection are above average'],
  service:    ['where the service feels genuine rather than rehearsed', 'with a warmth in the welcome that sets the tone'],
  views:      ['with a setting that opens up to the surroundings', 'where the outdoor space adds a natural draw'],
  selection:  ['with a curated selection that reflects local taste', 'where the range is edited rather than exhaustive'],
}

const EXPERIENCE_PHRASES: Record<string, string> = {
  morning:  'It works especially well for a slow start to the day.',
  slow:     'It rewards those who come without a schedule.',
  social:   'A natural fit for easy gatherings and shared meals.',
  solo:     'Equally suited to solo visits and quiet pauses.',
  special:  'Worth considering when the occasion calls for something a little more considered.',
}

// ── Type-specific openers ─────────────────────────────────────────────

function getTypeOpener(placeType: string, cuisines: string[], priceTier: number | null): string {
  if (placeType === 'restaurant') {
    if (priceTier === 4) return 'A refined dining room'
    if (priceTier === 3) return 'A well-regarded restaurant'
    if (cuisines.includes('seafood')) return 'A seafood-focused restaurant'
    if (cuisines.includes('portuguese')) return 'A restaurant grounded in Portuguese cooking'
    if (cuisines.includes('japanese')) return 'A Japanese restaurant with a careful hand'
    if (cuisines.includes('italian')) return 'An Italian restaurant with honest roots'
    if (cuisines.includes('french')) return 'A restaurant with a French-inflected kitchen'
    if (cuisines.includes('mediterranean')) return 'A restaurant with a Mediterranean register'
    return 'A neighbourhood restaurant'
  }
  if (placeType === 'cafe') return 'A café'
  if (placeType === 'bar') return 'A bar'
  if (placeType === 'hotel') return 'A hotel'
  if (placeType === 'shop') return 'A shop'
  if (placeType === 'museum') return 'A museum'
  if (placeType === 'landmark') return 'A landmark'
  if (placeType === 'beach') return 'A stretch of coast'
  if (placeType === 'activity') return 'An experience'
  if (placeType === 'venue') return 'A venue'
  return 'A distinctive address'
}

// ── Main description generator ─────────────────────────────────────────

function generateFullDescription(
  google: GooglePlaceDetail,
  placeType: string,
  _cityName: string,
  cuisines: string[],
  _noteEN: string,
): string {
  const priceTier = mapPriceLevel(google.priceLevel)
  const signals = extractSignalsFromReviews(google.reviews ?? [])

  // ─ Sentence 1: What is this place + atmosphere ─
  const opener = getTypeOpener(placeType, cuisines, priceTier)

  // Pick the single strongest atmosphere signal
  const atmPhrase = signals.atmospheres.length > 0
    ? ATMOSPHERE_PHRASES[signals.atmospheres[0]] ?? null
    : null

  // If Google has a usable editorial summary, distill it into a clean opening
  let editorialHint: string | null = null
  if (google.editorialSummary?.text) {
    const raw = google.editorialSummary.text.trim()
    // Only use if it's short and not just repeating the name
    if (raw.length > 15 && raw.length < 200) {
      editorialHint = raw
    }
  }

  let sentence1: string
  if (editorialHint && !atmPhrase) {
    // Rewrite the editorial summary in our voice: strip trailing period, lowercase first char if needed
    const clean = editorialHint.replace(/\.$/, '')
    sentence1 = `${opener} — ${clean.charAt(0).toLowerCase()}${clean.slice(1)}.`
  } else if (atmPhrase) {
    sentence1 = `${opener} ${atmPhrase}.`
  } else {
    // Fallback: type-aware defaults
    const defaults: Record<string, string> = {
      restaurant: 'with a kitchen that earns its regulars.',
      cafe:       'suited to slow coffee, light bites and easy conversation.',
      bar:        'where the drinks are taken seriously and the setting follows suit.',
      hotel:      'with a sense of place and well-considered rooms.',
      shop:       'with a selection that speaks to local craft and taste.',
      museum:     'that rewards curiosity and an unhurried pace.',
      landmark:   'that anchors the area and rewards a closer look.',
      beach:      'with the right mix of space, light and water.',
      activity:   'worth carving out proper time for.',
      venue:      'built for gatherings that feel considered.',
    }
    sentence1 = `${opener} ${defaults[placeType] ?? 'with a character worth discovering.'}`
  }

  // ─ Sentence 2: Distinguishing quality ─
  let sentence2: string | null = null
  if (signals.qualities.length > 0) {
    const topQuality = signals.qualities[0]
    const phrases = QUALITY_PHRASES[topQuality]
    if (phrases) {
      // Pick a random phrase from the pair
      const phrase = phrases[Math.floor(Math.random() * phrases.length)]
      // Capitalise and turn into a sentence
      sentence2 = phrase.charAt(0).toUpperCase() + phrase.slice(1) + '.'
    }
  }
  // If no review signals but we have an editorial summary we haven't used, repurpose it
  if (!sentence2 && editorialHint && atmPhrase) {
    const clean = editorialHint.replace(/\.$/, '')
    sentence2 = clean.charAt(0).toUpperCase() + clean.slice(1) + '.'
  }

  // ─ Sentence 3: Experience / moment fit ─
  let sentence3: string | null = null
  if (signals.experiences.length > 0) {
    sentence3 = EXPERIENCE_PHRASES[signals.experiences[0]] ?? null
  }
  // If nothing from reviews, add a type-aware closer
  if (!sentence3) {
    const closers: Record<string, string> = {
      restaurant: 'The kind of place that improves with a second visit.',
      cafe:       'A natural stop for a pause between plans.',
      bar:        'Best enjoyed without a fixed plan for the rest of the evening.',
      hotel:      'A base that shapes the trip rather than simply hosting it.',
      shop:       'Worth a detour even if you came for something else.',
      museum:     'Allow more time than you think — the collection earns it.',
      landmark:   'Best appreciated outside the busiest hours.',
      beach:      'The kind of place where the afternoon stretches without effort.',
      activity:   'Arrive with time to spare — rushing would miss the point.',
      venue:      'A setting that does half the work for any occasion.',
    }
    sentence3 = closers[placeType] ?? null
  }

  // ─ Compose (2–4 sentences, 220–380 chars target) ─
  const sentences = [sentence1, sentence2, sentence3].filter(Boolean) as string[]

  // If we have 3 sentences and it's too long, drop the middle one
  let result = sentences.join(' ')
  if (result.length > 420 && sentences.length === 3) {
    result = [sentences[0], sentences[2]].join(' ')
  }
  // If still too long, just use first two
  if (result.length > 420 && sentences.length >= 2) {
    result = sentences[0]
  }

  return result
}

// ─── Google photo URL builder ─────────────────────────────────────────────

const MAX_PREVIEW_PHOTOS = 6

function buildGooglePhotoUrl(photoName: string, maxWidth = 800): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}`
}

// ─── Duplicate detection ──────────────────────────────────────────────────

export async function checkDuplicate(googlePlaceId: string, name: string): Promise<{ isDuplicate: boolean; existingSlug?: string }> {
  // Check by google_place_id
  const { rows: byGoogleId } = await db.query<{ slug: string }>(
    'SELECT slug FROM places WHERE google_place_id = $1 LIMIT 1', [googlePlaceId])
  if (byGoogleId[0]) return { isDuplicate: true, existingSlug: byGoogleId[0].slug }

  // Check by normalized name (fuzzy)
  const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim()
  const { rows: byName } = await db.query<{ slug: string; name: string }>(
    `SELECT slug, name FROM places WHERE
      LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9 ]', '', 'g')) = $1
      AND status != 'archived'
    LIMIT 1`, [normalized])
  if (byName[0]) return { isDuplicate: true, existingSlug: byName[0].slug }

  return { isDuplicate: false }
}

// ─── Preview (returns all data, does NOT create) ──────────────────────────

export interface PlacePreview {
  // Basic info
  name: string
  slug: string
  citySlug: string
  placeType: string
  categorySlug: string
  subcategorySlug: string
  // Contact
  addressLine: string | null
  phone: string | null
  websiteUrl: string | null
  // Location
  latitude: number | null
  longitude: number | null
  // Google enrichment
  googlePlaceId: string
  googleRating: number | null
  googleRatingCount: number | null
  googleMapsUrl: string | null
  priceTier: number | null
  cuisineTypes: string[]
  reservable: boolean
  // Editorial
  shortDescription: string
  fullDescription: string
  goldenbookNote: string
  insiderTip: string
  // Opening hours
  openingHours: Array<{ dayOfWeek: number; opensAt: string; closesAt: string }>
  // Google photos (URLs for preview, photoNames for ingestion)
  photoUrls: string[]
  photoNames: string[]
}

export async function previewPlaceFromGoogle(googlePlaceId: string): Promise<PlacePreview> {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_MAPS_API_KEY not configured')

  // 1. Fetch Google Place details
  const google = await fetchGooglePlaceDetails(googlePlaceId)
  if (!google) throw new Error('Could not fetch place details from Google')

  const name = google.displayName?.text ?? 'Unnamed Place'
  const types = google.types ?? []
  const placeType = mapPlaceType(types)
  const cuisines = extractCuisines(types)
  const priceTier = mapPriceLevel(google.priceLevel)

  // 2. Auto-detect city
  const citySlug = google.location
    ? detectCity(google.location.latitude, google.location.longitude)
    : 'lisboa'

  const slug = toSlug(name) + '-' + citySlug
  const categorySlug = TYPE_TO_CATEGORY[placeType] ?? 'gastronomy'
  const subcategorySlug = TYPE_TO_SUBCATEGORY[placeType] ?? 'restaurantes'

  // 3. Check for duplicates
  const { isDuplicate, existingSlug } = await checkDuplicate(google.id, name)
  if (isDuplicate) {
    throw new Error(`DUPLICATE:${existingSlug}`)
  }

  // 4. Generate editorial texts
  const cityDisplay = { porto: 'Porto', lisboa: 'Lisbon', algarve: 'the Algarve', madeira: 'Madeira' }[citySlug] ?? citySlug
  const noteEN = generateEditorialNote(name, placeType, citySlug, google.formattedAddress ?? '', cuisines, priceTier, google.rating ?? null)
  const tipEN = generateInsiderTip(placeType)
  const shortDescEN = google.editorialSummary?.text ?? noteEN
  const fullDescEN = generateFullDescription(google, placeType, cityDisplay, cuisines, noteEN)

  // 5. Parse opening hours — skip for types where hours don't make sense
  const SKIP_HOURS_TYPES = new Set(['hotel', 'landmark', 'beach', 'transport'])
  const openingHours: PlacePreview['openingHours'] = []
  if (!SKIP_HOURS_TYPES.has(placeType) && google.regularOpeningHours?.periods) {
    for (const p of google.regularOpeningHours.periods) {
      openingHours.push({
        dayOfWeek: p.open.day,
        opensAt: `${String(p.open.hour).padStart(2, '0')}:${String(p.open.minute).padStart(2, '0')}`,
        closesAt: p.close
          ? `${String(p.close.hour).padStart(2, '0')}:${String(p.close.minute).padStart(2, '0')}`
          : '23:59',
      })
    }
  }

  return {
    name: name.toUpperCase(),
    slug,
    citySlug,
    placeType,
    categorySlug,
    subcategorySlug,
    addressLine: google.formattedAddress ?? null,
    phone: google.internationalPhoneNumber ?? null,
    websiteUrl: google.websiteUri ?? null,
    latitude: google.location?.latitude ?? null,
    longitude: google.location?.longitude ?? null,
    googlePlaceId: google.id,
    googleRating: google.rating ?? null,
    googleRatingCount: google.userRatingCount ?? null,
    googleMapsUrl: google.googleMapsUri ?? null,
    priceTier,
    cuisineTypes: cuisines,
    reservable: google.reservable ?? false,
    shortDescription: shortDescEN,
    fullDescription: fullDescEN,
    goldenbookNote: noteEN,
    insiderTip: tipEN,
    openingHours,
    // Photos: up to MAX_PREVIEW_PHOTOS from Google, resolved to displayable URLs
    photoUrls: (google.photos ?? []).slice(0, MAX_PREVIEW_PHOTOS).map(p => buildGooglePhotoUrl(p.name)),
    photoNames: (google.photos ?? []).slice(0, MAX_PREVIEW_PHOTOS).map(p => p.name),
  }
}

// ─── Photo ingestion (download from Google → upload to Supabase) ─────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const IMAGE_BUCKET = 'place-images'

async function downloadGooglePhoto(photoName: string): Promise<{ data: ArrayBuffer; mimeType: string } | null> {
  const url = buildGooglePhotoUrl(photoName, 1200)
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const data = await res.arrayBuffer()
    return { data, mimeType: contentType.split(';')[0] }
  } catch {
    return null
  }
}

async function uploadToSupabaseStorage(bucket: string, path: string, data: ArrayBuffer, mimeType: string): Promise<boolean> {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(data),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function ingestGooglePhotos(
  placeId: string,
  photoNames: string[],
): Promise<{ ingested: number; failed: number }> {
  let ingested = 0
  let failed = 0

  for (let i = 0; i < photoNames.length; i++) {
    const photoName = photoNames[i]

    // 1. Download from Google
    const photo = await downloadGooglePhoto(photoName)
    if (!photo) { failed++; continue }

    // 2. Determine extension from MIME
    const ext = photo.mimeType === 'image/png' ? 'png'
      : photo.mimeType === 'image/webp' ? 'webp' : 'jpg'
    const storagePath = `places/${placeId}/${Date.now()}-${i}.${ext}`

    // 3. Upload to Supabase storage
    const uploaded = await uploadToSupabaseStorage(IMAGE_BUCKET, storagePath, photo.data, photo.mimeType)
    if (!uploaded) { failed++; continue }

    // 4. Create media_asset record
    const { rows: [asset] } = await db.query<{ id: string }>(`
      INSERT INTO media_assets (bucket, path, mime_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (bucket, path) DO UPDATE SET mime_type = EXCLUDED.mime_type
      RETURNING id
    `, [IMAGE_BUCKET, storagePath, photo.mimeType])

    // 5. Get next sort order
    const { rows: [{ max_order }] } = await db.query<{ max_order: number }>(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS max_order
      FROM place_images WHERE place_id = $1 AND image_role = 'gallery'
    `, [placeId])

    // 6. Create place_image — first photo becomes hero, rest are gallery
    const role = i === 0 ? 'hero' : 'gallery'
    const isPrimary = i === 0
    await db.query(`
      INSERT INTO place_images (place_id, asset_id, image_role, sort_order, is_primary)
      VALUES ($1, $2, $3, $4, $5)
    `, [placeId, asset.id, role, i === 0 ? 0 : max_order, isPrimary])

    ingested++
  }

  return { ingested, failed }
}
