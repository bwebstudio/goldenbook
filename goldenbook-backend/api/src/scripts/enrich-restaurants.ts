#!/usr/bin/env tsx
// ─── Google Places Enrichment Pipeline for Goldenbook ───────────────────────
//
// Enriches restaurant data with objective signals from Google Places API (New).
// Editorial data (tags, descriptions, images) is NEVER overwritten.
//
// Usage:
//   npx tsx api/src/scripts/enrich-restaurants.ts                    # full run
//   npx tsx api/src/scripts/enrich-restaurants.ts --dry-run           # preview only
//   npx tsx api/src/scripts/enrich-restaurants.ts --city=porto        # single city
//   npx tsx api/src/scripts/enrich-restaurants.ts --limit=5           # first N
//
// Required env: GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY)

import { db } from '../db/postgres'

// ─── Config ─────────────────────────────────────────────────────────────────

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''
const RATE_LIMIT_MS = 200  // 5 requests/sec max
const MAX_RETRIES = 2

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const CITY_FILTER = args.find(a => a.startsWith('--city='))?.split('=')[1] ?? null
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10) || 0

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlaceRecord {
  id: string
  slug: string
  name: string
  city_slug: string
  city_name: string
  website_url: string | null
  phone: string | null
  address_line: string | null
  latitude: number | null
  longitude: number | null
  price_tier: number | null
  booking_url: string | null
  booking_enabled: boolean
  booking_mode: string
  google_place_id: string | null
}

interface EnrichmentResult {
  placeId: string
  name: string
  city: string
  status: 'matched_high' | 'matched_medium' | 'matched_low' | 'updated' | 'skipped' | 'ambiguous' | 'failed'
  confidence: 'high' | 'medium' | 'low' | null
  changes: string[]
  matchNotes: string
  suggestBetterPhoto: boolean
  needsReview: boolean
  reviewReasons: string[]
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
    weekdayDescriptions?: string[]
  }
  currentOpeningHours?: { weekdayDescriptions?: string[] }
  priceLevel?: string  // PRICE_LEVEL_FREE, PRICE_LEVEL_INEXPENSIVE, etc.
  rating?: number
  userRatingCount?: number
  businessStatus?: string
  primaryType?: string
  types?: string[]
  reservable?: boolean
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>
}

// ─── Google Places API (New) ────────────────────────────────────────────────

const FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location',
  'internationalPhoneNumber', 'websiteUri', 'googleMapsUri',
  'regularOpeningHours', 'priceLevel', 'rating', 'userRatingCount',
  'businessStatus', 'primaryType', 'types', 'reservable', 'photos',
].join(',')

async function searchPlace(query: string): Promise<GooglePlace | null> {
  const url = 'https://places.googleapis.com/v1/places:searchText'
  const body = {
    textQuery: query,
    languageCode: 'pt',
    maxResultCount: 3,
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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

      if (res.status === 429) {
        console.warn(`  [rate-limited] waiting 2s...`)
        await sleep(2000)
        continue
      }

      if (!res.ok) {
        const text = await res.text()
        console.error(`  [google-api] ${res.status}: ${text.substring(0, 200)}`)
        return null
      }

      const data = await res.json() as { places?: GooglePlace[] }
      return data.places?.[0] ?? null
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(1000)
        continue
      }
      console.error(`  [fetch-error] ${err}`)
      return null
    }
  }
  return null
}

// ─── Match confidence ───────────────────────────────────────────────────────

function calculateConfidence(
  place: PlaceRecord,
  google: GooglePlace,
): { confidence: 'high' | 'medium' | 'low'; notes: string } {
  const notes: string[] = []
  let score = 0

  // Name similarity
  const nameA = normalize(place.name)
  const nameB = normalize(google.displayName?.text ?? '')
  if (nameA === nameB) {
    score += 3
    notes.push('exact name match')
  } else if (nameA.includes(nameB) || nameB.includes(nameA)) {
    score += 2
    notes.push('partial name match')
  } else if (nameA.split(' ')[0] === nameB.split(' ')[0]) {
    score += 1
    notes.push('first word match only')
  } else {
    notes.push('name mismatch: ' + google.displayName?.text)
  }

  // Website consistency
  if (place.website_url && google.websiteUri) {
    const domainA = extractDomain(place.website_url)
    const domainB = extractDomain(google.websiteUri)
    if (domainA && domainB && domainA === domainB) {
      score += 2
      notes.push('website match')
    } else if (domainA && domainB) {
      notes.push(`website mismatch: ${domainA} vs ${domainB}`)
    }
  }

  // Region check (address contains city name)
  const addr = (google.formattedAddress ?? '').toLowerCase()
  if (addr.includes(place.city_name.toLowerCase()) || addr.includes(place.city_slug)) {
    score += 1
    notes.push('city in address')
  }

  // Coordinate proximity (if we have coords)
  if (place.latitude && place.longitude && google.location) {
    const dist = haversine(
      place.latitude, place.longitude,
      google.location.latitude, google.location.longitude,
    )
    if (dist < 0.5) {
      score += 1
      notes.push(`${Math.round(dist * 1000)}m away`)
    } else {
      notes.push(`far: ${dist.toFixed(1)}km`)
    }
  }

  const confidence = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low'
  return { confidence, notes: notes.join('; ') }
}

// ─── Normalization helpers ──────────────────────────────────────────────────

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

// ─── Price mapping ──────────────────────────────────────────────────────────

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

// ─── Cuisine normalization ──────────────────────────────────────────────────

const CUISINE_MAP: Record<string, string> = {
  portuguese_restaurant: 'portuguese',
  seafood_restaurant: 'seafood',
  italian_restaurant: 'italian',
  japanese_restaurant: 'japanese',
  indian_restaurant: 'indian',
  french_restaurant: 'french',
  chinese_restaurant: 'chinese',
  mexican_restaurant: 'mexican',
  thai_restaurant: 'thai',
  spanish_restaurant: 'spanish',
  greek_restaurant: 'greek',
  turkish_restaurant: 'turkish',
  brazilian_restaurant: 'brazilian',
  korean_restaurant: 'korean',
  vietnamese_restaurant: 'vietnamese',
  american_restaurant: 'american',
  pizza_restaurant: 'italian',
  steak_house: 'steakhouse',
  sushi_restaurant: 'japanese',
  vegan_restaurant: 'vegan',
  vegetarian_restaurant: 'vegetarian',
  barbecue_restaurant: 'barbecue',
  mediterranean_restaurant: 'mediterranean',
  asian_restaurant: 'asian',
  fusion_restaurant: 'fusion',
  fine_dining_restaurant: 'fine-dining',
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

// ─── Opening hours normalization ────────────────────────────────────────────

interface OpeningHourRow {
  day_of_week: number  // 0=Sunday, 6=Saturday
  opens_at: string | null
  closes_at: string | null
  is_closed: boolean
}

function normalizeOpeningHours(google: GooglePlace): OpeningHourRow[] {
  const periods = google.regularOpeningHours?.periods
  if (!periods?.length) return []

  // Group by day
  const byDay = new Map<number, { opens: string; closes: string }[]>()
  for (let d = 0; d < 7; d++) byDay.set(d, [])

  for (const p of periods) {
    const day = p.open.day  // Google: 0=Sunday
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
      slots.sort((a, b) => a.opens.localeCompare(b.opens))
      for (let i = 0; i < slots.length; i++) {
        rows.push({
          day_of_week: d,
          opens_at: slots[i].opens,
          closes_at: slots[i].closes,
          is_closed: false,
        })
      }
    }
  }
  return rows
}

// ─── Safe overwrite policy ──────────────────────────────────────────────────

function shouldOverwrite(field: string, current: unknown, proposed: unknown, confidence: string): boolean {
  // Never overwrite with null/empty
  if (proposed == null || proposed === '') return false
  // Always fill empty fields
  if (current == null || current === '') return true
  // Only overwrite existing values with high confidence
  if (confidence !== 'high') return false
  // Field-specific rules
  switch (field) {
    case 'address_line': return (current as string).length < 10  // short = probably incomplete
    case 'phone': return !(current as string).startsWith('+')  // keep international format
    case 'website_url': return false  // never overwrite curated website
    case 'booking_url': return false  // never overwrite curated booking
    default: return true
  }
}

// ─── Upsert logic ───────────────────────────────────────────────────────────

async function upsertEnrichment(
  place: PlaceRecord,
  google: GooglePlace,
  confidence: 'high' | 'medium' | 'low',
): Promise<string[]> {
  const changes: string[] = []

  // ── Places table updates ──────────────────────────────────────────────
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  function maybeSet(col: string, val: unknown) {
    const current = (place as unknown as Record<string, unknown>)[col === 'address_line' ? 'address_line' : col]
    if (shouldOverwrite(col, current, val, confidence)) {
      sets.push(`${col} = $${i++}`)
      params.push(val)
      changes.push(`${col}: ${JSON.stringify(current)} → ${JSON.stringify(val)}`)
    }
  }

  // Always update Google metadata
  sets.push(`google_place_id = $${i++}`); params.push(google.id)
  sets.push(`google_rating = $${i++}`); params.push(google.rating ?? null)
  sets.push(`google_rating_count = $${i++}`); params.push(google.userRatingCount ?? null)
  sets.push(`google_maps_url = $${i++}`); params.push(google.googleMapsUri ?? null)
  sets.push(`enrichment_status = $${i++}`); params.push('enriched')
  sets.push(`enrichment_confidence = $${i++}`); params.push(confidence)
  sets.push(`enriched_at = $${i++}`); params.push(new Date().toISOString())

  // Cuisine types
  const cuisines = extractCuisines(google.types ?? [])
  if (cuisines.length > 0) {
    sets.push(`cuisine_types = $${i++}`)
    params.push(cuisines)
    changes.push(`cuisine_types: ${cuisines.join(', ')}`)
  }

  // Objective fields — conservative overwrite
  maybeSet('address_line', google.formattedAddress)
  maybeSet('phone', google.internationalPhoneNumber)

  // Price tier — only if we don't have one
  const priceTier = mapPriceLevel(google.priceLevel)
  if (priceTier && !place.price_tier) {
    sets.push(`price_tier = $${i++}`)
    params.push(priceTier)
    changes.push(`price_tier: null → ${priceTier}`)
  }

  // Coordinates — only fill if missing
  if (!place.latitude && google.location) {
    sets.push(`latitude = $${i++}`)
    params.push(google.location.latitude)
    sets.push(`longitude = $${i++}`)
    params.push(google.location.longitude)
    changes.push(`coordinates: set from Google`)
  }

  // Booking — only if not already configured and columns exist
  if (!place.booking_enabled && google.reservable) {
    try {
      const { rows: resCols } = await db.query<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'places' AND column_name = 'reservation_relevant'
      `)
      if (resCols.length > 0) {
        sets.push(`reservation_relevant = $${i++}`)
        params.push(true)
        sets.push(`reservation_source = $${i++}::reservation_source`)
        params.push('ai_suggested')
        sets.push(`reservation_confidence = $${i++}`)
        params.push(confidence === 'high' ? 0.9 : confidence === 'medium' ? 0.7 : 0.5)
        changes.push(`reservation_relevant: true (Google says reservable)`)
      }
    } catch { /* columns don't exist yet */ }
  }

  sets.push(`updated_at = now()`)
  params.push(place.id)

  await db.query(
    `UPDATE places SET ${sets.join(', ')} WHERE id = $${i}`,
    params,
  )

  // ── Opening hours ─────────────────────────────────────────────────────
  const hours = normalizeOpeningHours(google)
  if (hours.length > 0) {
    // Check if place already has hours
    const { rows: existing } = await db.query<{ cnt: string }>(
      'SELECT COUNT(*)::text AS cnt FROM opening_hours WHERE place_id = $1',
      [place.id],
    )
    if (parseInt(existing[0]?.cnt ?? '0', 10) === 0) {
      // No existing hours — insert from Google
      for (const h of hours) {
        await db.query(
          `INSERT INTO opening_hours (place_id, day_of_week, opens_at, closes_at, is_closed, slot_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [place.id, h.day_of_week, h.opens_at, h.closes_at, h.is_closed, 0],
        )
      }
      changes.push(`opening_hours: added ${hours.filter(h => !h.is_closed).length} open slots`)
    }
  }

  return changes
}

// ─── Main pipeline ──────────────────────────────────────────────────────────

async function main() {
  if (!GOOGLE_API_KEY) {
    console.error('Missing GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY env var')
    process.exit(1)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Goldenbook Restaurant Enrichment Pipeline`)
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log(`  City: ${CITY_FILTER ?? 'all'}`)
  console.log(`  Limit: ${LIMIT || 'none'}`)
  console.log(`${'═'.repeat(60)}\n`)

  // Check which optional columns exist
  const { rows: colCheck } = await db.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'places' AND column_name IN ('booking_enabled', 'booking_mode')
  `)
  const hasCols = new Set(colCheck.map(r => r.column_name))
  const bookingSelect = hasCols.has('booking_enabled')
    ? `p.booking_enabled, p.booking_mode::text AS booking_mode,`
    : `false AS booking_enabled, 'none' AS booking_mode,`

  // Fetch restaurants
  let query = `
    SELECT p.id, p.slug, p.name, d.slug AS city_slug, d.name AS city_name,
      p.website_url, p.phone, p.address_line, p.latitude, p.longitude,
      p.price_tier, p.booking_url,
      ${bookingSelect}
      p.google_place_id
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
    WHERE p.status = 'published' AND p.is_active = true
  `
  const qParams: unknown[] = []
  if (CITY_FILTER) {
    qParams.push(CITY_FILTER)
    query += ` AND d.slug = $${qParams.length}`
  }
  query += ' ORDER BY d.name, p.name'
  if (LIMIT > 0) {
    qParams.push(LIMIT)
    query += ` LIMIT $${qParams.length}`
  }

  const { rows: restaurants } = await db.query<PlaceRecord>(query, qParams)
  console.log(`Found ${restaurants.length} restaurants to process\n`)

  const results: EnrichmentResult[] = []
  const reviewQueue: EnrichmentResult[] = []
  let processed = 0
  let updated = 0
  let skipped = 0
  let failed = 0
  const confidenceCounts = { high: 0, medium: 0, low: 0 }

  for (const place of restaurants) {
    processed++
    const prefix = `[${processed}/${restaurants.length}]`
    console.log(`${prefix} ${place.name} (${place.city_name})`)

    // Build search query
    const searchQuery = `${place.name} ${place.city_name} Portugal`

    const google = await searchPlace(searchQuery)
    await sleep(RATE_LIMIT_MS)

    if (!google) {
      console.log(`  ✗ No Google match found`)
      results.push({
        placeId: place.id, name: place.name, city: place.city_slug,
        status: 'failed', confidence: null, changes: [], matchNotes: 'no results',
        suggestBetterPhoto: false, needsReview: true, reviewReasons: ['no Google match'],
      })
      failed++
      continue
    }

    // Calculate match confidence
    const { confidence, notes } = calculateConfidence(place, google)
    confidenceCounts[confidence]++
    console.log(`  → ${confidence} confidence: ${notes}`)

    const result: EnrichmentResult = {
      placeId: place.id, name: place.name, city: place.city_slug,
      status: `matched_${confidence}` as EnrichmentResult['status'],
      confidence, changes: [], matchNotes: notes,
      suggestBetterPhoto: false, needsReview: false, reviewReasons: [],
    }

    // Photo suggestion (never auto-replace)
    if (google.photos?.length && google.photos[0].widthPx >= 1200) {
      result.suggestBetterPhoto = true
    }

    // Skip low confidence — mark for review
    if (confidence === 'low') {
      result.needsReview = true
      result.reviewReasons.push('low match confidence')
      console.log(`  ⚠ Low confidence — skipping upsert, marked for review`)
      results.push(result)
      skipped++
      continue
    }

    // Collect review reasons
    if (!google.regularOpeningHours?.periods?.length) {
      result.reviewReasons.push('no opening hours from Google')
    }
    if (!google.priceLevel) {
      result.reviewReasons.push('no price level from Google')
    }
    if (!google.reservable) {
      result.reviewReasons.push('reservable not confirmed')
    }
    if (result.reviewReasons.length > 0) {
      result.needsReview = true
    }

    // Upsert
    if (DRY_RUN) {
      console.log(`  [dry-run] Would update: google_place_id, rating, etc.`)
      const cuisines = extractCuisines(google.types ?? [])
      if (cuisines.length) console.log(`  [dry-run] Cuisines: ${cuisines.join(', ')}`)
      const price = mapPriceLevel(google.priceLevel)
      if (price && !place.price_tier) console.log(`  [dry-run] Price tier: ${price}`)
      if (google.regularOpeningHours?.periods?.length) console.log(`  [dry-run] Has opening hours`)
      if (google.reservable) console.log(`  [dry-run] Reservable: true`)
      result.status = 'skipped'
      skipped++
    } else {
      try {
        const changes = await upsertEnrichment(place, google, confidence)
        result.changes = changes
        result.status = changes.length > 0 ? 'updated' : 'skipped'
        if (changes.length > 0) {
          updated++
          changes.forEach(c => console.log(`  ✓ ${c}`))
        } else {
          skipped++
          console.log(`  — no changes needed`)
        }
      } catch (err) {
        console.error(`  ✗ Error: ${err}`)
        result.status = 'failed'
        result.needsReview = true
        result.reviewReasons.push(`upsert error: ${err}`)
        failed++
      }
    }

    results.push(result)
    if (result.needsReview) reviewQueue.push(result)
  }

  // ── Report ────────────────────────────────────────────────────────────

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ENRICHMENT REPORT`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Total processed:    ${processed}`)
  console.log(`  Matched high:       ${confidenceCounts.high}`)
  console.log(`  Matched medium:     ${confidenceCounts.medium}`)
  console.log(`  Matched low:        ${confidenceCounts.low}`)
  console.log(`  Updated:            ${updated}`)
  console.log(`  Skipped/no changes: ${skipped}`)
  console.log(`  Failed:             ${failed}`)
  console.log(`  Needs review:       ${reviewQueue.length}`)
  console.log(`  Photo suggestions:  ${results.filter(r => r.suggestBetterPhoto).length}`)
  console.log(`${'═'.repeat(60)}\n`)

  // ── Write review file ─────────────────────────────────────────────────

  const fs = await import('fs')
  const reviewPath = `./enrichment-review-${new Date().toISOString().split('T')[0]}.json`
  const review = results
    .filter(r => r.needsReview || r.suggestBetterPhoto)
    .map(r => ({
      name: r.name,
      city: r.city,
      status: r.status,
      confidence: r.confidence,
      matchNotes: r.matchNotes,
      reviewReasons: r.reviewReasons,
      suggestBetterPhoto: r.suggestBetterPhoto,
      changes: r.changes,
    }))

  fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2))
  console.log(`Review file: ${reviewPath} (${review.length} items)\n`)

  // Full results log
  const fullPath = `./enrichment-full-${new Date().toISOString().split('T')[0]}.json`
  fs.writeFileSync(fullPath, JSON.stringify(results, null, 2))
  console.log(`Full log: ${fullPath}\n`)

  await db.end()
}

main().catch((err) => {
  console.error('Pipeline failed:', err)
  process.exit(1)
})
