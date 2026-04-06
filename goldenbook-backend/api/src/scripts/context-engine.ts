#!/usr/bin/env tsx
// ─── Context & Classification Engine ────────────────────────────────────────
//
// Generates auto fields from Google Places enrichment + opening_hours:
//   • classification_auto   — type, category, subcategory
//   • context_windows_auto  — time-of-day windows from opening hours
//   • context_tags_auto     — semantic tags from price, cuisine, location, etc.
//
// Usage:
//   npx tsx api/src/scripts/context-engine.ts                 # full run
//   npx tsx api/src/scripts/context-engine.ts --dry-run       # preview only
//   npx tsx api/src/scripts/context-engine.ts --retry-low     # also retry low-confidence matches
//   npx tsx api/src/scripts/context-engine.ts --city=porto    # single city
//
// Required env: GOOGLE_MAPS_API_KEY (only needed for --retry-low)

import { db } from '../db/postgres'

// ─── CLI args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN     = args.includes('--dry-run')
const RETRY_LOW   = args.includes('--retry-low')
const CITY_FILTER = args.find(a => a.startsWith('--city='))?.split('=')[1] ?? null
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

// ─── Types ─────────────────────────────────────────────────────────────────

interface PlaceRow {
  id: string
  name: string
  slug: string
  place_type: string
  city_slug: string
  city_name: string
  price_tier: number | null
  cuisine_types: string[] | null
  google_place_id: string | null
  google_rating: number | null
  enrichment_status: string | null
  enrichment_confidence: string | null
  address_line: string | null
  website_url: string | null
  latitude: number | null
  longitude: number | null
  classification_auto: unknown | null
  context_windows_auto: unknown | null
  context_tags_auto: unknown | null
  moment_tags_auto: unknown | null
}

interface OpeningHourRow {
  day_of_week: number
  opens_at: string | null
  closes_at: string | null
  is_closed: boolean
}

interface GooglePlace {
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
  }
  priceLevel?: string
  rating?: number
  userRatingCount?: number
  primaryType?: string
  types?: string[]
}

// ─── 1. RETRY LOW-CONFIDENCE MATCHES ──────────────────────────────────────

const FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location',
  'internationalPhoneNumber', 'websiteUri', 'googleMapsUri',
  'regularOpeningHours', 'priceLevel', 'rating', 'userRatingCount',
  'primaryType', 'types',
].join(',')

async function searchPlace(query: string): Promise<GooglePlace | null> {
  const url = 'https://places.googleapis.com/v1/places:searchText'
  const body = { textQuery: query, languageCode: 'pt', maxResultCount: 3 }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': `places.${FIELDS.split(',').join(',places.')}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const data = await res.json() as { places?: GooglePlace[] }
    return data.places?.[0] ?? null
  } catch {
    return null
  }
}

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch { return null }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function calculateConfidence(
  place: PlaceRow,
  google: GooglePlace,
): { confidence: 'high' | 'medium' | 'low'; notes: string } {
  const notes: string[] = []
  let score = 0

  const nameA = normalize(place.name)
  const nameB = normalize(google.displayName?.text ?? '')
  if (nameA === nameB) { score += 3; notes.push('exact name') }
  else if (nameA.includes(nameB) || nameB.includes(nameA)) { score += 2; notes.push('partial name') }
  else if (nameA.split(' ')[0] === nameB.split(' ')[0]) { score += 1; notes.push('first word') }
  else { notes.push('name mismatch') }

  if (place.website_url && google.websiteUri) {
    const dA = extractDomain(place.website_url)
    const dB = extractDomain(google.websiteUri)
    if (dA && dB && dA === dB) { score += 2; notes.push('website match') }
  }

  const addr = (google.formattedAddress ?? '').toLowerCase()
  if (addr.includes(place.city_name.toLowerCase()) || addr.includes(place.city_slug)) {
    score += 1; notes.push('city in address')
  }

  if (place.latitude && place.longitude && google.location) {
    const dist = haversine(place.latitude, place.longitude, google.location.latitude, google.location.longitude)
    if (dist < 0.5) { score += 1; notes.push(`${Math.round(dist * 1000)}m`) }
  }

  const confidence = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low'
  return { confidence, notes: notes.join('; ') }
}

async function retryLowConfidence(): Promise<{ retried: number; upgraded: number; duplicates: number }> {
  if (!GOOGLE_API_KEY) {
    console.log('⚠ No GOOGLE_MAPS_API_KEY — skipping low-confidence retry')
    return { retried: 0, upgraded: 0, duplicates: 0 }
  }

  // Get low-confidence and failed records
  let query = `
    SELECT p.id, p.name, p.slug, p.place_type, d.slug AS city_slug, d.name AS city_name,
      p.price_tier, p.cuisine_types, p.google_place_id, p.google_rating,
      p.enrichment_status, p.enrichment_confidence, p.address_line,
      p.website_url, p.latitude, p.longitude,
      p.classification_auto, p.context_windows_auto, p.context_tags_auto, p.moment_tags_auto
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
    WHERE p.status = 'published' AND p.is_active = true
      AND (p.enrichment_confidence = 'low' OR p.enrichment_status = 'failed' OR p.enrichment_status IS NULL)
  `
  const params: unknown[] = []
  if (CITY_FILTER) {
    params.push(CITY_FILTER)
    query += ` AND d.slug = $${params.length}`
  }
  query += ' ORDER BY p.name'

  const { rows } = await db.query<PlaceRow>(query, params)
  console.log(`\n🔄 Retrying ${rows.length} low-confidence / failed / unenriched places...\n`)

  let retried = 0, upgraded = 0, duplicates = 0

  for (const place of rows) {
    retried++
    // Build improved query: name + city + website domain
    let searchQuery = `${place.name} ${place.city_name} Portugal`
    if (place.website_url) {
      const domain = extractDomain(place.website_url)
      if (domain) searchQuery = `${place.name} ${domain} ${place.city_name}`
    }

    console.log(`  [${retried}/${rows.length}] ${place.name} (${place.city_slug})`)
    const google = await searchPlace(searchQuery)
    await sleep(250)

    if (!google) {
      console.log(`    ✗ Still no match`)
      continue
    }

    const { confidence, notes } = calculateConfidence(place, google)
    console.log(`    → ${confidence}: ${notes}`)

    if (confidence === 'low') {
      console.log(`    ⚠ Still low — skipping`)
      continue
    }

    // Check for duplicate google_place_id
    const { rows: dupes } = await db.query<{ id: string; name: string }>(
      `SELECT id, name FROM places WHERE google_place_id = $1 AND id != $2`,
      [google.id, place.id],
    )
    if (dupes.length > 0) {
      console.log(`    ⚠ Duplicate google_place_id — already used by: ${dupes[0].name}`)
      if (!DRY_RUN) {
        await db.query(
          `UPDATE places SET enrichment_status = 'duplicate', enrichment_confidence = $2, updated_at = now() WHERE id = $1`,
          [place.id, confidence],
        )
      }
      duplicates++
      continue
    }

    if (!DRY_RUN) {
      // Update with new match
      const priceTier = mapPriceLevel(google.priceLevel)
      const cuisines = extractCuisines(google.types ?? [])

      const sets: string[] = [
        `google_place_id = $2`,
        `google_rating = $3`,
        `google_rating_count = $4`,
        `google_maps_url = $5`,
        `enrichment_status = 'enriched'`,
        `enrichment_confidence = $6`,
        `enriched_at = now()`,
        `updated_at = now()`,
      ]
      const uParams: unknown[] = [
        place.id,
        google.id,
        google.rating ?? null,
        google.userRatingCount ?? null,
        google.googleMapsUri ?? null,
        confidence,
      ]

      if (cuisines.length > 0 && (!place.cuisine_types || place.cuisine_types.length === 0)) {
        sets.push(`cuisine_types = $${uParams.length + 1}`)
        uParams.push(cuisines)
      }
      if (priceTier && !place.price_tier) {
        sets.push(`price_tier = $${uParams.length + 1}`)
        uParams.push(priceTier)
      }

      await db.query(`UPDATE places SET ${sets.join(', ')} WHERE id = $1`, uParams)

      // Upsert opening hours if Google has them and place doesn't
      const hours = normalizeGoogleHours(google)
      if (hours.length > 0) {
        const { rows: existingHours } = await db.query<{ cnt: string }>(
          'SELECT COUNT(*)::text AS cnt FROM opening_hours WHERE place_id = $1', [place.id])
        if (parseInt(existingHours[0]?.cnt ?? '0', 10) === 0) {
          for (const h of hours) {
            await db.query(
              `INSERT INTO opening_hours (place_id, day_of_week, opens_at, closes_at, is_closed, slot_order)
               VALUES ($1, $2, $3, $4, $5, 0) ON CONFLICT DO NOTHING`,
              [place.id, h.day_of_week, h.opens_at, h.closes_at, h.is_closed],
            )
          }
        }
      }
    }
    upgraded++
    console.log(`    ✓ Upgraded to ${confidence}`)
  }

  return { retried, upgraded, duplicates }
}

// ─── 2. AUTO-CLASSIFICATION ───────────────────────────────────────────────
// Maps Google primaryType → Goldenbook definitive taxonomy
// Categories: gastronomy, culture, natureza-outdoor, experiences, alojamento, retail, mobilidade

const PRIMARY_TYPE_MAP: Record<string, { type: string; category: string; subcategory: string }> = {
  // ── Gastronomia ───────────────────────────────────────────────────────
  // Restaurants
  restaurant:                { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  fine_dining_restaurant:    { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  seafood_restaurant:        { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  portuguese_restaurant:     { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  italian_restaurant:        { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  japanese_restaurant:       { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  french_restaurant:         { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  chinese_restaurant:        { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  indian_restaurant:         { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  mexican_restaurant:        { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  spanish_restaurant:        { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  greek_restaurant:          { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  turkish_restaurant:        { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  thai_restaurant:           { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  korean_restaurant:         { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  vietnamese_restaurant:     { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  brazilian_restaurant:      { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  american_restaurant:       { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  mediterranean_restaurant:  { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  asian_restaurant:          { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  steak_house:               { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  pizza_restaurant:          { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  sushi_restaurant:          { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  barbecue_restaurant:       { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  brunch_restaurant:         { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  vegan_restaurant:          { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  vegetarian_restaurant:     { type: 'restaurant', category: 'gastronomy', subcategory: 'restaurantes' },
  // Cafes & Bakeries
  cafe:                      { type: 'cafe',       category: 'gastronomy', subcategory: 'cafes' },
  coffee_shop:               { type: 'cafe',       category: 'gastronomy', subcategory: 'cafes' },
  bakery:                    { type: 'cafe',       category: 'gastronomy', subcategory: 'pastelarias' },
  ice_cream_shop:            { type: 'cafe',       category: 'gastronomy', subcategory: 'cafes' },
  // Bars
  bar:                       { type: 'bar',        category: 'gastronomy', subcategory: 'bares' },
  wine_bar:                  { type: 'bar',        category: 'gastronomy', subcategory: 'wine-bars' },
  cocktail_bar:              { type: 'bar',        category: 'gastronomy', subcategory: 'bares' },
  pub:                       { type: 'bar',        category: 'gastronomy', subcategory: 'bares' },

  // ── Cultura ───────────────────────────────────────────────────────────
  museum:                    { type: 'museum',     category: 'culture',    subcategory: 'museus' },
  art_gallery:               { type: 'museum',     category: 'culture',    subcategory: 'galerias' },
  tourist_attraction:        { type: 'landmark',   category: 'culture',    subcategory: 'monumentos' },
  church:                    { type: 'landmark',   category: 'culture',    subcategory: 'igrejas' },
  historical_landmark:       { type: 'landmark',   category: 'culture',    subcategory: 'sitios-historicos' },
  performing_arts_theater:   { type: 'venue',      category: 'culture',    subcategory: 'teatros' },

  // ── Natureza & Outdoor ────────────────────────────────────────────────
  beach:                     { type: 'beach',      category: 'natureza-outdoor', subcategory: 'praias' },
  national_park:             { type: 'activity',   category: 'natureza-outdoor', subcategory: 'parques' },
  park:                      { type: 'activity',   category: 'natureza-outdoor', subcategory: 'parques' },
  hiking_area:               { type: 'activity',   category: 'natureza-outdoor', subcategory: 'parques' },

  // ── Experiências ──────────────────────────────────────────────────────
  spa:                       { type: 'activity',   category: 'experiences', subcategory: 'bem-estar' },
  gym:                       { type: 'activity',   category: 'experiences', subcategory: 'desporto' },
  golf_course:               { type: 'activity',   category: 'experiences', subcategory: 'desporto' },
  night_club:                { type: 'venue',      category: 'experiences', subcategory: 'vida-noturna' },
  event_venue:               { type: 'venue',      category: 'experiences', subcategory: 'eventos' },
  amusement_park:            { type: 'activity',   category: 'experiences', subcategory: 'experiencias-unicas' },
  marina:                    { type: 'activity',   category: 'experiences', subcategory: 'experiencias-unicas' },

  // ── Alojamento ────────────────────────────────────────────────────────
  hotel:                     { type: 'hotel',      category: 'alojamento', subcategory: 'hoteis' },
  resort_hotel:              { type: 'hotel',      category: 'alojamento', subcategory: 'resorts' },
  bed_and_breakfast:         { type: 'hotel',      category: 'alojamento', subcategory: 'boutique' },
  guest_house:               { type: 'hotel',      category: 'alojamento', subcategory: 'boutique' },

  // ── Retail ────────────────────────────────────────────────────────────
  shopping_mall:             { type: 'shop',       category: 'retail',     subcategory: 'centros-comerciais' },
  clothing_store:            { type: 'shop',       category: 'retail',     subcategory: 'moda' },
  jewelry_store:             { type: 'shop',       category: 'retail',     subcategory: 'joalharia' },
  book_store:                { type: 'shop',       category: 'retail',     subcategory: 'lojas-locais' },
  gift_shop:                 { type: 'shop',       category: 'retail',     subcategory: 'lojas-locais' },
  market:                    { type: 'shop',       category: 'retail',     subcategory: 'mercados' },
  supermarket:               { type: 'shop',       category: 'retail',     subcategory: 'mercados' },
  furniture_store:           { type: 'shop',       category: 'retail',     subcategory: 'decoracao' },
  home_goods_store:          { type: 'shop',       category: 'retail',     subcategory: 'decoracao' },

  // ── Mobilidade ────────────────────────────────────────────────────────
  airport:                   { type: 'transport',  category: 'mobilidade', subcategory: 'aeroporto' },
  car_rental:                { type: 'transport',  category: 'mobilidade', subcategory: 'rent-a-car' },
}

// Fallback: Goldenbook place_type → definitive taxonomy
const PLACE_TYPE_FALLBACK: Record<string, { category: string; subcategory: string }> = {
  restaurant: { category: 'gastronomy',       subcategory: 'restaurantes' },
  bar:        { category: 'gastronomy',       subcategory: 'bares' },
  cafe:       { category: 'gastronomy',       subcategory: 'cafes' },
  hotel:      { category: 'alojamento',       subcategory: 'hoteis' },
  shop:       { category: 'retail',           subcategory: 'lojas-locais' },
  museum:     { category: 'culture',          subcategory: 'museus' },
  landmark:   { category: 'culture',          subcategory: 'sitios-historicos' },
  activity:   { category: 'experiences',      subcategory: 'experiencias-unicas' },
  beach:      { category: 'natureza-outdoor', subcategory: 'praias' },
  venue:      { category: 'experiences',      subcategory: 'eventos' },
  transport:  { category: 'mobilidade',       subcategory: 'aeroporto' },
  other:      { category: 'experiences',      subcategory: 'experiencias-unicas' },
}

function autoClassify(place: PlaceRow, googleTypes: string[]): { type: string; category: string; subcategory: string } | null {
  // Try Google types first
  for (const gt of googleTypes) {
    if (PRIMARY_TYPE_MAP[gt]) return PRIMARY_TYPE_MAP[gt]
  }

  // Fallback to existing place_type
  const fallback = PLACE_TYPE_FALLBACK[place.place_type]
  if (fallback) {
    return { type: place.place_type, ...fallback }
  }

  return null
}

// ─── 3. CONTEXT WINDOWS FROM OPENING HOURS ────────────────────────────────

// Time ranges for each window
const WINDOWS = [
  { name: 'manhã',     start: 6,  end: 11 },
  { name: 'almoço',    start: 11, end: 15 },
  { name: 'tarde',     start: 15, end: 18 },
  { name: 'noite',     start: 18, end: 22 },
  { name: 'madrugada', start: 22, end: 6 },  // wraps around midnight
] as const

function hoursToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

// Default windows by place_type — used when no opening_hours are available
const DEFAULT_WINDOWS: Record<string, string[]> = {
  restaurant: ['almoço', 'noite'],
  cafe:       ['manhã', 'almoço', 'tarde'],
  bar:        ['noite', 'madrugada'],
  hotel:      ['manhã', 'noite'],
  shop:       ['manhã', 'almoço', 'tarde'],
  museum:     ['manhã', 'almoço', 'tarde'],
  landmark:   ['manhã', 'almoço', 'tarde'],
  activity:   ['manhã', 'almoço', 'tarde'],
  beach:      ['manhã', 'almoço', 'tarde'],
  venue:      ['noite', 'madrugada'],
  transport:  [],
  other:      [],
}

function generateContextWindows(hours: OpeningHourRow[], placeType: string): string[] {
  const openSlots = hours.filter(h => !h.is_closed && h.opens_at && h.closes_at)

  // No opening hours → use defaults by place type
  if (openSlots.length === 0) {
    return DEFAULT_WINDOWS[placeType] ?? []
  }

  const windows = new Set<string>()

  for (const slot of openSlots) {
    const opensMin = hoursToMinutes(slot.opens_at!)
    const closesMin = hoursToMinutes(slot.closes_at!)

    for (const w of WINDOWS) {
      const wStartMin = w.start * 60
      const wEndMin = w.end * 60

      if (w.name === 'madrugada') {
        // Wraps around midnight: 22:00-06:00
        if (closesMin > wStartMin || opensMin < wEndMin) {
          windows.add(w.name)
        }
        if (closesMin < opensMin) {
          windows.add(w.name)
        }
      } else {
        if (opensMin < wEndMin && closesMin > wStartMin) {
          windows.add(w.name)
        }
        if (closesMin < opensMin) {
          if (opensMin < wEndMin) {
            windows.add(w.name)
          }
        }
      }
    }
  }

  // Sort in chronological order
  const order = ['manhã', 'almoço', 'tarde', 'noite', 'madrugada']
  return [...windows].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

// ─── 4. CONTEXT TAGS AUTO-GENERATION ──────────────────────────────────────

const CUISINE_MAP: Record<string, string> = {
  portuguese_restaurant: 'portuguese', seafood_restaurant: 'seafood',
  italian_restaurant: 'italian', japanese_restaurant: 'japanese',
  indian_restaurant: 'indian', french_restaurant: 'french',
  chinese_restaurant: 'chinese', mexican_restaurant: 'mexican',
  thai_restaurant: 'thai', spanish_restaurant: 'spanish',
  greek_restaurant: 'greek', turkish_restaurant: 'turkish',
  brazilian_restaurant: 'brazilian', korean_restaurant: 'korean',
  vietnamese_restaurant: 'vietnamese', american_restaurant: 'american',
  pizza_restaurant: 'italian', steak_house: 'steakhouse',
  sushi_restaurant: 'japanese', vegan_restaurant: 'vegan',
  vegetarian_restaurant: 'vegetarian', barbecue_restaurant: 'barbecue',
  mediterranean_restaurant: 'mediterranean', asian_restaurant: 'asian',
  fusion_restaurant: 'fusion', fine_dining_restaurant: 'fine-dining',
  brunch_restaurant: 'brunch',
}

function extractCuisines(types: string[]): string[] {
  const cuisines = new Set<string>()
  for (const t of types) {
    const mapped = CUISINE_MAP[t]
    if (mapped) cuisines.add(mapped)
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

function normalizeGoogleHours(google: GooglePlace): OpeningHourRow[] {
  const periods = google.regularOpeningHours?.periods
  if (!periods?.length) return []

  const byDay = new Map<number, { opens: string; closes: string }[]>()
  for (let d = 0; d < 7; d++) byDay.set(d, [])

  for (const p of periods) {
    const day = p.open.day
    const opens = `${String(p.open.hour).padStart(2, '0')}:${String(p.open.minute).padStart(2, '0')}`
    const closes = p.close
      ? `${String(p.close.hour).padStart(2, '0')}:${String(p.close.minute).padStart(2, '0')}`
      : '23:59'
    byDay.get(day)?.push({ opens, closes })
  }

  const rows: OpeningHourRow[] = []
  for (let d = 0; d < 7; d++) {
    const slots = byDay.get(d)!
    if (slots.length === 0) {
      rows.push({ day_of_week: d, opens_at: null, closes_at: null, is_closed: true })
    } else {
      for (const s of slots) {
        rows.push({ day_of_week: d, opens_at: s.opens, closes_at: s.closes, is_closed: false })
      }
    }
  }
  return rows
}

// Location-based keywords for tag inference
const LOCATION_KEYWORDS: Record<string, string[]> = {
  terrace:  ['terrace', 'terraço', 'esplanada', 'terraza', 'outdoor', 'patio', 'jardim', 'garden'],
  sunset:   ['sunset', 'pôr do sol', 'puesta de sol', 'west-facing', 'ocean view', 'sea view'],
  view:     ['viewpoint', 'miradouro', 'panoramic', 'vista', 'rooftop', 'skyline', 'view'],
  rooftop:  ['rooftop', 'roof', 'top floor', 'último piso', 'terraço'],
  beach:    ['beach', 'praia', 'playa', 'marina', 'seaside', 'beachfront', 'ocean', 'mar'],
}

// ── Base tags by place type ─────────────────────────────────────────────
// These are always applied regardless of other data
const BASE_TAGS_BY_TYPE: Record<string, string[]> = {
  restaurant: [],  // tags come from price/cuisine/windows
  cafe:       ['coffee'],
  bar:        ['cocktails'],
  hotel:      ['wellness'],
  shop:       ['shopping'],
  museum:     ['culture', 'rainy-day'],
  landmark:   ['culture', 'viewpoint'],
  activity:   [],
  beach:      ['sunset', 'family'],
  venue:      [],
  transport:  [],
}

// Tags that should NOT appear for certain place types
const EXCLUDED_TAGS_BY_TYPE: Record<string, string[]> = {
  museum:     ['lunch', 'dinner', 'fine-dining', 'cocktails', 'wine', 'brunch', 'coffee'],
  landmark:   ['lunch', 'dinner', 'fine-dining', 'cocktails', 'wine', 'brunch', 'coffee'],
  shop:       ['lunch', 'dinner', 'fine-dining', 'cocktails', 'wine', 'brunch', 'late-night'],
  beach:      ['fine-dining', 'cocktails', 'rainy-day', 'rooftop', 'late-night'],
  transport:  ['lunch', 'dinner', 'fine-dining', 'cocktails', 'wine', 'brunch', 'coffee',
               'romantic', 'celebration', 'terrace', 'rooftop', 'viewpoint', 'sunset',
               'late-night', 'live-music', 'local-secret', 'wellness', 'family'],
  hotel:      ['quick-stop', 'shopping'],
}

function generateContextTags(
  place: PlaceRow,
  cuisineTypes: string[],
  contextWindows: string[],
): string[] {
  const tags = new Set<string>()

  // ── 1. Base tags by place type ────────────────────────────────────────
  const baseTags = BASE_TAGS_BY_TYPE[place.place_type] ?? []
  for (const t of baseTags) tags.add(t)

  // ── 2. Price tier rules (food/drink places only) ──────────────────────
  const isFoodDrink = ['restaurant', 'cafe', 'bar'].includes(place.place_type)
  if (place.price_tier && isFoodDrink) {
    if (place.price_tier === 4) {
      tags.add('romantic'); tags.add('celebration'); tags.add('fine-dining')
    } else if (place.price_tier === 3) {
      tags.add('romantic'); tags.add('wine')
    } else if (place.price_tier === 2) {
      // casual — no special tags needed
    } else if (place.price_tier === 1) {
      tags.add('quick-stop')
    }
  }
  // Price tier for hotels
  if (place.price_tier && place.place_type === 'hotel') {
    if (place.price_tier >= 3) {
      tags.add('romantic'); tags.add('celebration')
    }
  }

  // ── 3. Cuisine type rules ─────────────────────────────────────────────
  if (isFoodDrink) {
    for (const cuisine of cuisineTypes) {
      if (cuisine === 'fine-dining') {
        tags.add('fine-dining'); tags.add('romantic'); tags.add('celebration')
      }
      if (cuisine === 'brunch') tags.add('brunch')
    }
  }

  // ── 4. Location / keyword hints ───────────────────────────────────────
  const searchText = [
    place.name, place.address_line ?? '', place.slug
  ].join(' ').toLowerCase()

  for (const [tag, keywords] of Object.entries(LOCATION_KEYWORDS)) {
    for (const kw of keywords) {
      if (searchText.includes(kw.toLowerCase())) {
        tags.add(tag === 'view' ? 'viewpoint' : tag)
        break
      }
    }
  }

  // ── 5. Time-window-based tags ─────────────────────────────────────────
  if (isFoodDrink) {
    if (contextWindows.includes('almoço')) tags.add('lunch')
    if (contextWindows.includes('noite') || contextWindows.includes('madrugada')) tags.add('dinner')
    if (contextWindows.includes('manhã') && place.place_type === 'cafe') tags.add('brunch')
  }

  if (contextWindows.includes('madrugada') && ['bar', 'venue'].includes(place.place_type)) {
    tags.add('late-night')
  }

  // ── 6. Place-type-specific enrichments ────────────────────────────────
  switch (place.place_type) {
    case 'bar':
      tags.add('wine')
      // Wine bars get special treatment
      if (cuisineTypes.some(c => c.includes('wine')) || searchText.includes('wine') || searchText.includes('vinho')) {
        tags.add('wine')
      }
      break
    case 'activity':
      // Spa / wellness
      if (searchText.includes('spa') || searchText.includes('wellness') || searchText.includes('bem-estar')) {
        tags.add('wellness')
      }
      // Wine experiences
      if (searchText.includes('wine') || searchText.includes('vinho') || searchText.includes('adega')) {
        tags.add('wine')
      }
      break
    case 'beach':
      // Beach clubs
      if (searchText.includes('club') || searchText.includes('lounge')) {
        tags.add('terrace')
      }
      break
    case 'landmark':
      // Some landmarks are family-friendly
      tags.add('family')
      break
    case 'museum':
      tags.add('family')
      break
  }

  // ── 7. Google rating signals ──────────────────────────────────────────
  if (place.google_rating && place.google_rating >= 4.5) {
    tags.add('local-secret')
  }

  // ── 8. Exclude inappropriate tags for this place type ─────────────────
  const excluded = new Set(EXCLUDED_TAGS_BY_TYPE[place.place_type] ?? [])
  for (const t of excluded) tags.delete(t)

  // ── 9. Filter to Goldenbook canonical tags (23 tags) ──────────────────
  const CANONICAL = new Set([
    'brunch', 'celebration', 'cocktails', 'coffee', 'culture', 'dinner',
    'family', 'fine-dining', 'late-night', 'live-music', 'local-secret',
    'lunch', 'quick-stop', 'rainy-day', 'romantic', 'rooftop', 'shopping',
    'sunday', 'sunset', 'terrace', 'viewpoint', 'wellness', 'wine',
  ])

  return [...tags].filter(t => CANONICAL.has(t)).sort()
}

// ─── 5. MOMENT TAGS ──────────────────────────────────────────────────────
// Time-aware recommendation tags. Answer: "Where now?", "Sunset?", "Romantic dinner?"
// Combines context_windows + classification + price + cuisine into moment-specific signals.

function generateMomentTags(
  place: PlaceRow,
  classification: { type: string; category: string; subcategory: string } | null,
  contextWindows: string[],
  contextTags: string[],
  cuisineTypes: string[],
): string[] {
  const tags = new Set<string>()
  const category = classification?.category ?? ''
  const subcategory = classification?.subcategory ?? ''
  const type = place.place_type

  // ── Window-driven moments ─────────────────────────────────────────────
  const hasWindow = (w: string) => contextWindows.includes(w)

  // Morning moments
  if (hasWindow('manhã')) {
    if (['cafe', 'restaurant'].includes(type)) { tags.add('breakfast'); tags.add('coffee') }
    if (type === 'cafe') tags.add('brunch')
    if (['museum', 'landmark', 'activity'].includes(type)) tags.add('morning-visit')
    if (type === 'beach') tags.add('morning-swim')
  }

  // Lunch moments
  if (hasWindow('almoço')) {
    if (['restaurant', 'cafe'].includes(type)) tags.add('lunch')
    if (type === 'restaurant' && place.price_tier && place.price_tier >= 3) tags.add('business-lunch')
  }

  // Afternoon moments
  if (hasWindow('tarde')) {
    if (type === 'cafe') { tags.add('afternoon-coffee'); tags.add('coffee') }
    if (['beach', 'landmark'].includes(type)) tags.add('sunset')
    if (['museum', 'landmark'].includes(type)) tags.add('afternoon-visit')
    if (type === 'shop') tags.add('afternoon-shopping')
  }

  // Evening moments
  if (hasWindow('noite')) {
    if (type === 'restaurant') { tags.add('dinner') }
    if (type === 'restaurant' && place.price_tier && place.price_tier >= 3) tags.add('romantic-dinner')
    if (type === 'bar') { tags.add('drinks'); tags.add('evening-out') }
    if (['landmark', 'beach'].includes(type)) tags.add('sunset')
  }

  // Late night moments
  if (hasWindow('madrugada')) {
    if (['bar', 'venue'].includes(type)) { tags.add('late-night'); tags.add('nightlife') }
    if (type === 'restaurant') tags.add('late-dinner')
  }

  // ── Category-driven moments ───────────────────────────────────────────

  // Culture
  if (category === 'culture') {
    tags.add('culture')
    tags.add('rainy-day')
    tags.add('family')
    if (subcategory === 'museus' || subcategory === 'galerias') tags.add('indoor')
  }

  // Natureza & Outdoor
  if (category === 'natureza-outdoor') {
    tags.add('outdoor')
    if (subcategory === 'praias') { tags.add('beach-day'); tags.add('family') }
    if (subcategory === 'miradouros') { tags.add('viewpoint'); tags.add('sunset') }
    if (subcategory === 'parques' || subcategory === 'jardins') { tags.add('walk'); tags.add('family') }
  }

  // Experiences
  if (category === 'experiences') {
    if (subcategory === 'bem-estar') { tags.add('wellness'); tags.add('relax') }
    if (subcategory === 'vida-noturna') { tags.add('nightlife'); tags.add('drinks') }
    if (subcategory === 'desporto') tags.add('outdoor')
    if (subcategory === 'tours') tags.add('explore')
  }

  // Retail
  if (category === 'retail') {
    tags.add('shopping')
    if (subcategory === 'mercados') tags.add('local-experience')
  }

  // Alojamento
  if (category === 'alojamento') {
    tags.add('stay')
    if (place.price_tier && place.price_tier >= 3) { tags.add('romantic'); tags.add('celebration') }
  }

  // ── Price-driven moments ──────────────────────────────────────────────
  if (place.price_tier === 4) {
    tags.add('special-occasion')
    if (['restaurant', 'hotel'].includes(type)) { tags.add('romantic'); tags.add('celebration') }
  }
  if (place.price_tier === 1) {
    tags.add('budget-friendly')
    if (type === 'restaurant') tags.add('quick-bite')
  }

  // ── Cuisine-driven moments ────────────────────────────────────────────
  if (cuisineTypes.includes('fine-dining')) { tags.add('fine-dining'); tags.add('romantic-dinner') }
  if (cuisineTypes.includes('seafood')) tags.add('seafood')
  if (cuisineTypes.includes('portuguese')) tags.add('local-cuisine')

  // ── Location-driven moments (from context_tags) ───────────────────────
  if (contextTags.includes('terrace')) tags.add('terrace')
  if (contextTags.includes('rooftop')) tags.add('rooftop')
  if (contextTags.includes('viewpoint')) tags.add('viewpoint')

  // ── Quality signal ────────────────────────────────────────────────────
  if (place.google_rating && place.google_rating >= 4.5) tags.add('hidden-gem')

  return [...tags].sort()
}

// ─── 6. DUPLICATE DETECTION ───────────────────────────────────────────────

async function detectDuplicates(): Promise<{ place_a: string; place_b: string; google_place_id: string }[]> {
  const { rows } = await db.query<{ google_place_id: string; ids: string[]; names: string[] }>(`
    SELECT google_place_id,
      ARRAY_AGG(id ORDER BY name) AS ids,
      ARRAY_AGG(name ORDER BY name) AS names
    FROM places
    WHERE google_place_id IS NOT NULL
    GROUP BY google_place_id
    HAVING COUNT(*) > 1
  `)

  const dupes: { place_a: string; place_b: string; google_place_id: string }[] = []
  for (const row of rows) {
    console.log(`  ⚠ Duplicate google_place_id ${row.google_place_id}: ${row.names.join(' / ')}`)
    // Mark all but first as duplicate
    for (let i = 1; i < row.ids.length; i++) {
      dupes.push({ place_a: row.ids[0], place_b: row.ids[i], google_place_id: row.google_place_id })
      if (!DRY_RUN) {
        await db.query(
          `UPDATE places SET enrichment_status = 'duplicate', updated_at = now() WHERE id = $1`,
          [row.ids[i]],
        )
      }
    }
  }
  return dupes
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Context & Classification Engine`)
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  Retry low: ${RETRY_LOW}`)
  console.log(`  City: ${CITY_FILTER ?? 'all'}`)
  console.log(`${'═'.repeat(60)}\n`)

  // ── Ensure auto columns exist ──────────────────────────────────────────
  const { rows: colCheck } = await db.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'places'
      AND column_name IN ('classification_auto', 'context_windows_auto', 'context_tags_auto', 'moment_tags_auto')
  `)
  const existingCols = new Set(colCheck.map(r => r.column_name))
  if (!existingCols.has('classification_auto')) {
    console.log('Creating column classification_auto...')
    await db.query(`ALTER TABLE places ADD COLUMN IF NOT EXISTS classification_auto JSONB DEFAULT NULL`)
  }
  if (!existingCols.has('context_windows_auto')) {
    console.log('Creating column context_windows_auto...')
    await db.query(`ALTER TABLE places ADD COLUMN IF NOT EXISTS context_windows_auto JSONB DEFAULT NULL`)
  }
  if (!existingCols.has('context_tags_auto')) {
    console.log('Creating column context_tags_auto...')
    await db.query(`ALTER TABLE places ADD COLUMN IF NOT EXISTS context_tags_auto JSONB DEFAULT NULL`)
  }
  if (!existingCols.has('moment_tags_auto')) {
    console.log('Creating column moment_tags_auto...')
    await db.query(`ALTER TABLE places ADD COLUMN IF NOT EXISTS moment_tags_auto JSONB DEFAULT NULL`)
  }

  // ── Step 1: Retry low-confidence (optional) ────────────────────────────
  let retryStats = { retried: 0, upgraded: 0, duplicates: 0 }
  if (RETRY_LOW) {
    retryStats = await retryLowConfidence()
  }

  // ── Step 1b: Detect duplicates ─────────────────────────────────────────
  console.log('\n🔍 Checking for duplicate google_place_id...')
  const dupes = await detectDuplicates()

  // ── Step 2-4: Process all published places ─────────────────────────────
  let query = `
    SELECT p.id, p.name, p.slug, p.place_type, d.slug AS city_slug, d.name AS city_name,
      p.price_tier, p.cuisine_types, p.google_place_id, p.google_rating,
      p.enrichment_status, p.enrichment_confidence, p.address_line,
      p.website_url, p.latitude, p.longitude,
      p.classification_auto, p.context_windows_auto, p.context_tags_auto, p.moment_tags_auto
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
    WHERE p.status = 'published' AND p.is_active = true
  `
  const params: unknown[] = []
  if (CITY_FILTER) {
    params.push(CITY_FILTER)
    query += ` AND d.slug = $${params.length}`
  }
  query += ' ORDER BY d.name, p.name'

  const { rows: places } = await db.query<PlaceRow>(query, params)
  console.log(`\n📊 Processing ${places.length} places...\n`)

  let processed = 0
  let classifiedCount = 0
  let windowsCount = 0
  let windowsFromDefault = 0
  let tagsCount = 0
  let momentCount = 0
  let skippedDuplicates = 0
  const reviewItems: unknown[] = []
  const classificationDist: Record<string, number> = {}
  const tagDist: Record<string, number> = {}
  const momentDist: Record<string, number> = {}

  for (const place of places) {
    processed++
    const prefix = `[${processed}/${places.length}]`

    // Skip duplicates
    if (place.enrichment_status === 'duplicate') {
      skippedDuplicates++
      continue
    }

    // ── Classification ──────────────────────────────────────────────────
    // Use Google types from cuisine_types (they were mapped from Google types)
    // and also check the place_type from the DB
    const googleTypeHints: string[] = []
    if (place.cuisine_types) {
      // Reverse map: cuisine name → google type (for classification lookup)
      for (const [gType, cuisine] of Object.entries(CUISINE_MAP)) {
        if (place.cuisine_types.includes(cuisine)) {
          googleTypeHints.push(gType)
        }
      }
    }

    const classification = autoClassify(place, googleTypeHints)

    // ── Opening hours → context windows ─────────────────────────────────
    const { rows: hours } = await db.query<OpeningHourRow>(
      `SELECT day_of_week, opens_at::text, closes_at::text, is_closed
       FROM opening_hours WHERE place_id = $1 ORDER BY day_of_week, slot_order`,
      [place.id],
    )
    const contextWindows = generateContextWindows(hours, place.place_type)

    // ── Context tags ────────────────────────────────────────────────────
    const contextTags = generateContextTags(place, place.cuisine_types ?? [], contextWindows)

    // ── Moment tags ─────────────────────────────────────────────────────
    const momentTags = generateMomentTags(place, classification, contextWindows, contextTags, place.cuisine_types ?? [])

    // ── Summary ─────────────────────────────────────────────────────────
    const changes: string[] = []
    if (classification) {
      changes.push(`classification: ${classification.type}/${classification.category}/${classification.subcategory}`)
      classifiedCount++
      const key = `${classification.category}/${classification.subcategory}`
      classificationDist[key] = (classificationDist[key] ?? 0) + 1
    }
    if (contextWindows.length > 0) {
      changes.push(`windows: [${contextWindows.join(', ')}]`)
      windowsCount++
      if (hours.length === 0) windowsFromDefault++
    }
    if (contextTags.length > 0) {
      changes.push(`tags: [${contextTags.join(', ')}]`)
      tagsCount++
      for (const t of contextTags) tagDist[t] = (tagDist[t] ?? 0) + 1
    }
    if (momentTags.length > 0) {
      changes.push(`moments: [${momentTags.join(', ')}]`)
      momentCount++
      for (const t of momentTags) momentDist[t] = (momentDist[t] ?? 0) + 1
    }

    if (changes.length > 0) {
      console.log(`${prefix} ${place.name} (${place.city_slug})`)
      changes.forEach(c => console.log(`    ${c}`))
    }

    // Track items that might need review
    if (!classification && !place.google_place_id) {
      reviewItems.push({
        name: place.name,
        city: place.city_slug,
        reason: 'no enrichment data — cannot auto-classify',
        placeType: place.place_type,
      })
    }
    if (hours.length === 0 && contextWindows.length === 0) {
      reviewItems.push({
        name: place.name,
        city: place.city_slug,
        reason: 'no opening hours and no default windows for type',
        placeType: place.place_type,
      })
    } else if (hours.length === 0 && contextWindows.length > 0) {
      // Using defaults — not an error, just informational
    }

    // ── Write to DB ─────────────────────────────────────────────────────
    if (!DRY_RUN) {
      await db.query(
        `UPDATE places SET
           classification_auto = $2,
           context_windows_auto = $3,
           context_tags_auto = $4,
           moment_tags_auto = $5,
           updated_at = now()
         WHERE id = $1`,
        [
          place.id,
          classification ? JSON.stringify(classification) : null,
          contextWindows.length > 0 ? JSON.stringify(contextWindows) : null,
          contextTags.length > 0 ? JSON.stringify(contextTags) : null,
          momentTags.length > 0 ? JSON.stringify(momentTags) : null,
        ],
      )
    }
  }

  // ── Report ────────────────────────────────────────────────────────────

  const report = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : 'live',
    totalProcessed: processed,
    classified: classifiedCount,
    windowsGenerated: windowsCount,
    windowsFromDefault,
    tagsGenerated: tagsCount,
    momentTagsGenerated: momentCount,
    duplicatesDetected: dupes.length,
    skippedDuplicates,
    retryStats,
    classificationDistribution: Object.entries(classificationDist).sort((a, b) => b[1] - a[1]),
    tagDistribution: Object.entries(tagDist).sort((a, b) => b[1] - a[1]),
    momentTagDistribution: Object.entries(momentDist).sort((a, b) => b[1] - a[1]),
    reviewItems,
    duplicates: dupes,
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  CONTEXT ENGINE REPORT`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Total processed:       ${processed}`)
  console.log(`  Classified:            ${classifiedCount}`)
  console.log(`  Windows generated:     ${windowsCount} (${windowsFromDefault} from defaults)`)
  console.log(`  Tags generated:        ${tagsCount}`)
  console.log(`  Moment tags generated: ${momentCount}`)
  console.log(`  Duplicates detected:   ${dupes.length}`)
  console.log(`  Skipped (duplicates):  ${skippedDuplicates}`)
  if (RETRY_LOW) {
    console.log(`  Low-conf retried:      ${retryStats.retried}`)
    console.log(`  Low-conf upgraded:     ${retryStats.upgraded}`)
    console.log(`  Low-conf duplicates:   ${retryStats.duplicates}`)
  }
  console.log(`  Needs review:          ${reviewItems.length}`)
  console.log(`${'═'.repeat(60)}\n`)

  // Write report
  const fs = await import('fs')
  const reportPath = `./context-engine-v2-report.json`
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`Report: ${reportPath}\n`)

  await db.end()
}

main().catch((err) => {
  console.error('Context engine failed:', err)
  process.exit(1)
})
