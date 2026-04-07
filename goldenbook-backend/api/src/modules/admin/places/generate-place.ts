// ─── Generate Place from Google Places ────────────────────────────────────
// Takes a Google Place ID, fetches all details, creates the place with
// auto-filled fields, generates editorial notes, and translates to PT/ES.

import { db } from '../../../db/postgres'
import { createPlace } from './admin-places.query'
import { autoClassifyPlace } from './auto-classify'
import { translateText } from '../../../lib/translation/deepl'

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

// ─── Google Places API (New) ──────────────────────────────────────────────

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location',
  'internationalPhoneNumber', 'websiteUri', 'googleMapsUri',
  'regularOpeningHours', 'priceLevel', 'rating', 'userRatingCount',
  'primaryType', 'types', 'reservable', 'editorialSummary',
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
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'pt',
        maxResultCount: 8,
      }),
    })
    if (!res.ok) return []
    const data = await res.json() as { places?: Array<{ id: string; displayName?: { text: string }; formattedAddress?: string }> }
    return (data.places ?? []).map(p => ({
      placeId: p.id,
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? '',
    }))
  } catch {
    return []
  }
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
  return 'restaurant' // default
}

function extractCuisines(googleTypes: string[]): string[] {
  const cuisines = new Set<string>()
  for (const t of googleTypes) {
    if (CUISINE_MAP[t]) cuisines.add(CUISINE_MAP[t])
  }
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
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
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

function generateEditorialNote(name: string, placeType: string, city: string, address: string, cuisines: string[], priceTier: number | null, rating: number | null, googleDesc: string | null): string {
  const cityName = { porto: 'Porto', lisboa: 'Lisbon', algarve: 'the Algarve', madeira: 'Madeira' }[city] ?? city
  // Extract neighbourhood from address (first part before semicolon or comma)
  const neighbourhood = address.split(/[;,]/)[0]?.trim() ?? ''

  if (placeType === 'restaurant') {
    const parts: string[] = []
    if (priceTier === 4) parts.push(`A refined dining address`)
    else if (priceTier === 3) parts.push(`A well-regarded restaurant`)
    else parts.push(`A welcoming restaurant`)
    if (neighbourhood) parts.push(`on ${neighbourhood}`)
    if (cuisines.includes('seafood')) parts.push('with a focus on fresh seafood')
    else if (cuisines.includes('italian')) parts.push('drawing on Italian tradition')
    else if (cuisines.includes('japanese')) parts.push('with precise Japanese cooking')
    else if (cuisines.includes('portuguese')) parts.push('rooted in Portuguese tradition')
    else if (cuisines.includes('fine-dining')) parts.push('where each course is composed with care')
    if (rating && rating >= 4.5) parts.push(`and a loyal following (${rating}★)`)
    return parts.join(' ') + '.'
  }

  if (placeType === 'cafe') return `A café${neighbourhood ? ' on ' + neighbourhood : ''} in ${cityName} worth lingering over.`
  if (placeType === 'bar') return `A bar${neighbourhood ? ' on ' + neighbourhood : ''} in ${cityName} where the drink list is considered and the atmosphere earned.`
  if (placeType === 'hotel') return `A hotel${neighbourhood ? ' on ' + neighbourhood : ''} in ${cityName} with well-judged rooms and reliable comfort.`
  if (placeType === 'shop') return `A curated shop${neighbourhood ? ' on ' + neighbourhood : ''} in ${cityName} with a selection that speaks to local taste.`
  if (placeType === 'museum') return `A museum${neighbourhood ? ' on ' + neighbourhood : ''} in ${cityName} that rewards the curious visitor.`
  if (placeType === 'landmark') return `A landmark${neighbourhood ? ' at ' + neighbourhood : ''} in ${cityName} that anchors the neighbourhood.`
  if (placeType === 'beach') return `A stretch of coast in ${cityName} with the right balance of space, water, and atmosphere.`
  if (placeType === 'activity') return `An experience in ${cityName} worth carving out time for.`

  return googleDesc ?? `A distinctive address in ${cityName}.`
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

// ─── Main generate function ───────────────────────────────────────────────

export interface GenerateResult {
  id: string
  slug: string
  name: string
  status: string
}

export async function generatePlaceFromGoogle(
  googlePlaceId: string,
  citySlug: string,
): Promise<GenerateResult> {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_MAPS_API_KEY not configured')

  // 1. Fetch Google Place details
  const google = await fetchGooglePlaceDetails(googlePlaceId)
  if (!google) throw new Error('Could not fetch Google Place details')

  const name = google.displayName?.text ?? 'Unnamed Place'
  const types = google.types ?? []
  const placeType = mapPlaceType(types)
  const cuisines = extractCuisines(types)
  const priceTier = mapPriceLevel(google.priceLevel)
  const slug = toSlug(name) + '-' + citySlug
  const categorySlug = TYPE_TO_CATEGORY[placeType] ?? 'gastronomy'
  const subcategorySlug = TYPE_TO_SUBCATEGORY[placeType] ?? 'restaurantes'

  // 2. Generate editorial note (EN)
  const noteEN = generateEditorialNote(
    name, placeType, citySlug, google.formattedAddress ?? '',
    cuisines, priceTier, google.rating ?? null, google.editorialSummary?.text ?? null,
  )
  const tipEN = generateInsiderTip(placeType)

  // 3. Create the place
  const place = await createPlace({
    name: name.toUpperCase(),
    slug,
    citySlug,
    categorySlug,
    subcategorySlug,
    status: 'published',
    featured: false,
    addressLine: google.formattedAddress ?? undefined,
    websiteUrl: google.websiteUri ?? undefined,
    phone: google.internationalPhoneNumber ?? undefined,
    bookingEnabled: false,
    bookingMode: 'none',
    reservationRelevant: google.reservable ?? false,
  })

  // 4. Update with Google enrichment data
  const sets = [
    'google_place_id = $2', 'google_rating = $3', 'google_rating_count = $4',
    'google_maps_url = $5', 'enrichment_status = $6', 'enrichment_confidence = $7',
    'enriched_at = now()', 'place_type = $8',
  ]
  const params: unknown[] = [
    place.id, google.id, google.rating ?? null, google.userRatingCount ?? null,
    google.googleMapsUri ?? null, 'enriched', 'high', placeType,
  ]
  if (priceTier) { sets.push(`price_tier = $${params.length + 1}`); params.push(priceTier) }
  if (cuisines.length) { sets.push(`cuisine_types = $${params.length + 1}`); params.push(cuisines) }
  if (google.location) {
    sets.push(`latitude = $${params.length + 1}`); params.push(google.location.latitude)
    sets.push(`longitude = $${params.length + 1}`); params.push(google.location.longitude)
  }
  sets.push('updated_at = now()')

  await db.query(`UPDATE places SET ${sets.join(', ')} WHERE id = $1`, params)

  // 5. Insert opening hours
  if (google.regularOpeningHours?.periods?.length) {
    for (const p of google.regularOpeningHours.periods) {
      const opens = `${String(p.open.hour).padStart(2, '0')}:${String(p.open.minute).padStart(2, '0')}`
      const closes = p.close
        ? `${String(p.close.hour).padStart(2, '0')}:${String(p.close.minute).padStart(2, '0')}`
        : '23:59'
      await db.query(
        `INSERT INTO opening_hours (place_id, day_of_week, opens_at, closes_at, is_closed, slot_order)
         VALUES ($1, $2, $3, $4, false, 0) ON CONFLICT DO NOTHING`,
        [place.id, p.open.day, opens, closes],
      )
    }
  }

  // 6. Run auto-classify (generates classification, windows, tags, moments)
  await autoClassifyPlace(place.id)

  // 7. Save EN editorial note
  await db.query(`
    UPDATE place_translations SET
      goldenbook_note = $2, insider_tip = $3, updated_at = now()
    WHERE place_id = $1 AND locale = 'en'
  `, [place.id, noteEN, tipEN])

  // 8. Translate to PT and ES via DeepL
  try {
    const [notePT, tipPT, noteES, tipES] = await Promise.all([
      translateText(noteEN, 'pt', 'en'),
      translateText(tipEN, 'pt', 'en'),
      translateText(noteEN, 'es', 'en'),
      translateText(tipEN, 'es', 'en'),
    ])

    await Promise.all([
      db.query(`UPDATE place_translations SET goldenbook_note = $2, insider_tip = $3, updated_at = now() WHERE place_id = $1 AND locale = 'pt'`,
        [place.id, notePT, tipPT]),
      db.query(`UPDATE place_translations SET goldenbook_note = $2, insider_tip = $3, updated_at = now() WHERE place_id = $1 AND locale = 'es'`,
        [place.id, noteES, tipES]),
    ])
  } catch (err) {
    console.error('[generate-place] Translation failed, EN-only:', err)
  }

  return { id: place.id, slug: place.slug, name: place.name, status: place.status }
}
