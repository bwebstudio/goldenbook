#!/usr/bin/env tsx
// ─── Enrich: New editorial places with Google data + photos ───────────────
//
// Finds places created by seed-routes-golden-picks that have no Google data,
// searches for them, enriches with details, and ingests photos.
//
// Usage:
//   npx tsx api/src/scripts/enrich-new-places.ts
//   npx tsx api/src/scripts/enrich-new-places.ts --dry-run

import { db } from '../db/postgres'
import {
  searchGooglePlaces,
  ingestGooglePhotos,
} from '../modules/admin/places/generate-place'

const DRY_RUN = process.argv.includes('--dry-run')
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location',
  'internationalPhoneNumber', 'websiteUri', 'googleMapsUri',
  'rating', 'userRatingCount', 'editorialSummary', 'photos',
].join(',')

interface GoogleDetail {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  rating?: number
  userRatingCount?: number
  editorialSummary?: { text: string }
  photos?: Array<{ name: string }>
}

async function fetchDetails(placeId: string): Promise<GoogleDetail | null> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': DETAIL_FIELDS },
    })
    if (!res.ok) return null
    return await res.json() as GoogleDetail
  } catch { return null }
}

// Places to enrich with their Google search queries (city-specific for accuracy)
const PLACES_TO_ENRICH = [
  { id: 'c92e4a2b-f98a-4079-baf1-340c41d88c71', query: 'Arneiro restaurante Sintra Portugal', fallbackDesc: 'A restaurant in Sintra rooted in Portuguese culinary tradition.' },
  { id: '1f4346e6-2a5e-4d91-a260-019ee57e7a1b', query: 'Loja THE Porto Portugal', fallbackDesc: 'A curated fashion and design store in Porto.' },
  { id: 'e4911180-b224-4857-a7a9-1548a1db92ba', query: 'Imobiliária KA Porto Portugal', fallbackDesc: 'A premium real estate consultancy in Porto.' },
  { id: '15e2337a-2645-4cb1-85eb-f2349b82313b', query: 'Seapleasure Madeira boat tours', fallbackDesc: 'Ocean experiences and boat tours along Madeira\'s coast.' },
  { id: 'eeefc818-5919-415a-ae82-8bdde277c11f', query: 'Quinta Magnólia Funchal Madeira', fallbackDesc: 'A historic garden and cultural space in the heart of Funchal.' },
  { id: 'e5c9a113-723f-407d-83a5-d163f4532f6d', query: 'Wine tours Madeira Funchal', fallbackDesc: 'Guided experiences through the world of Madeira wine.' },
  { id: '31508126-2452-41d8-904f-9dfa478e5a4b', query: 'Dermalaser Funchal Madeira', fallbackDesc: 'A wellness and aesthetic clinic in Funchal.' },
  { id: '34bde57e-8b9e-481b-b375-0c61b70a53db', query: 'Forest Food Madeira restaurante', fallbackDesc: 'A restaurant in Madeira celebrating local ingredients and nature.' },
  { id: '0b633731-1710-4ba5-ae59-dc0e65d08a4f', query: 'Comissão Vitivinícola do Algarve', fallbackDesc: 'The Algarve Wine Commission — dedicated to promoting the region\'s viticultural heritage.' },
]

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Enrich New Places — Google Data + Photos')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  if (!GOOGLE_API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY'); process.exit(1) }

  let enriched = 0

  for (const place of PLACES_TO_ENRICH) {
    // Verify place exists and needs enrichment
    const { rows } = await db.query<{ name: string; google_place_id: string | null }>(
      `SELECT name, google_place_id FROM places WHERE id = $1`, [place.id],
    )
    if (!rows[0]) { console.log(`✗ ${place.id} not found — skipping`); continue }
    if (rows[0].google_place_id) { console.log(`⊘ ${rows[0].name} already enriched — skipping`); continue }

    console.log(`\n── ${rows[0].name} ──`)
    console.log(`  Searching: "${place.query}"`)

    const results = await searchGooglePlaces(place.query)
    if (!results.length) {
      console.log('  ✗ No Google results — applying fallback description only')
      if (!DRY_RUN) {
        await db.query(`UPDATE places SET short_description = $1 WHERE id = $2 AND short_description IS NULL`, [place.fallbackDesc, place.id])
        await db.query(`
          INSERT INTO place_translations (place_id, locale, short_description)
          VALUES ($1, 'en', $2)
          ON CONFLICT (place_id, locale) DO UPDATE SET short_description = COALESCE(NULLIF(place_translations.short_description, ''), $2)
        `, [place.id, place.fallbackDesc])
      }
      enriched++
      continue
    }

    const googleId = results[0].placeId
    console.log(`  ✓ Found: ${googleId} (${results[0].name})`)

    const details = await fetchDetails(googleId)
    if (!details) { console.log('  ✗ Could not fetch details'); continue }

    const desc = details.editorialSummary?.text ?? place.fallbackDesc

    if (DRY_RUN) {
      console.log(`  [DRY] Would update with Google data + ${details.photos?.length ?? 0} photos`)
      enriched++
      continue
    }

    // Update place with Google data
    await db.query(`
      UPDATE places SET
        google_place_id = $1,
        google_maps_url = $2,
        google_rating = $3,
        google_rating_count = $4,
        latitude = $5,
        longitude = $6,
        address_line = $7,
        website_url = COALESCE(NULLIF(website_url, ''), $8),
        phone = COALESCE(NULLIF(phone, ''), $9),
        short_description = COALESCE(NULLIF(short_description, ''), $10)
      WHERE id = $11
    `, [
      googleId,
      details.googleMapsUri ?? null,
      details.rating ?? null,
      details.userRatingCount ?? null,
      details.location?.latitude ?? null,
      details.location?.longitude ?? null,
      details.formattedAddress ?? null,
      details.websiteUri ?? null,
      details.internationalPhoneNumber ?? null,
      desc,
      place.id,
    ])
    console.log(`  ✓ Google data updated`)

    // Update EN translation
    await db.query(`
      UPDATE place_translations SET
        short_description = COALESCE(NULLIF(short_description, ''), $1),
        updated_at = now()
      WHERE place_id = $2 AND locale = 'en'
    `, [desc, place.id])

    // Ingest photos
    if (details.photos?.length) {
      const photoNames = details.photos.slice(0, 5).map(p => p.name)
      console.log(`  Ingesting ${photoNames.length} photos...`)
      try {
        const { ingested, failed } = await ingestGooglePhotos(place.id, photoNames)
        console.log(`  ✓ Photos: ${ingested} ingested, ${failed} failed`)
      } catch (err) {
        console.log(`  ⚠ Photo ingestion failed: ${(err as Error).message}`)
      }
    }

    enriched++
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`  Done: ${enriched}/${PLACES_TO_ENRICH.length} enriched`)
  console.log('═══════════════════════════════════════════════════════════')
  await db.end()
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
