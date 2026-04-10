#!/usr/bin/env tsx
// ─── Seed: Beautiful Spots ────────────────────────────────────────────────
//
// Creates 12 curated "beautiful spots" places (3 per city) using Google Places
// API for real data enrichment, then assigns the right context tags so the
// Concierge "Beautiful spots" pill surfaces them correctly.
//
// Usage:
//   npx tsx api/src/scripts/seed-beautiful-spots.ts                 # full run
//   npx tsx api/src/scripts/seed-beautiful-spots.ts --dry-run       # preview only
//   npx tsx api/src/scripts/seed-beautiful-spots.ts --skip-photos   # skip image ingestion
//
// Required env: GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY, DATABASE_URL

import { db } from '../db/postgres'
import { createPlace } from '../modules/admin/places/admin-places.query'
import { autoClassifyPlace } from '../modules/admin/places/auto-classify'
import {
  searchGooglePlaces,
  ingestGooglePhotos,
} from '../modules/admin/places/generate-place'
import type { CreatePlaceInput } from '../modules/admin/places/admin-places.dto'

// ─── CLI args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN      = args.includes('--dry-run')
const SKIP_PHOTOS  = args.includes('--skip-photos')

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

// ─── Google Places detail fetch (reuse same API as generate-place) ────────

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location',
  'internationalPhoneNumber', 'websiteUri', 'googleMapsUri',
  'regularOpeningHours', 'priceLevel', 'rating', 'userRatingCount',
  'primaryType', 'types', 'editorialSummary', 'photos',
].join(',')

interface GooglePlaceDetail {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  priceLevel?: string
  rating?: number
  userRatingCount?: number
  primaryType?: string
  types?: string[]
  editorialSummary?: { text: string }
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>
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
    if (!res.ok) {
      console.error(`  ✗ Google API error: ${res.status} ${res.statusText}`)
      return null
    }
    return await res.json() as GooglePlaceDetail
  } catch (err) {
    console.error(`  ✗ Google API fetch failed:`, err)
    return null
  }
}

// ─── Place definitions ────────────────────────────────────────────────────
//
// Each entry has enough info to search Google and create the place.
// The contextTags are editorial overrides for the Concierge scoring engine.

interface SpotDefinition {
  /** Search query for Google Places (used to find the place_id) */
  searchQuery: string
  /** City slug in the destinations table */
  citySlug: string
  /** Goldenbook place_type */
  placeType: 'landmark' | 'venue' | 'shop' | 'restaurant' | 'activity' | 'beach'
  /** Category slug for the places table */
  categorySlug: string
  /** Subcategory slug (optional) */
  subcategorySlug?: string
  /** Context tags to assign (for Concierge & NOW scoring) */
  contextTags: string[]
  /** Time windows when this place is relevant */
  timeWindows: string[]
  /** Short editorial description (EN) — used if Google doesn't provide one */
  fallbackDescription: string
}

const BEAUTIFUL_SPOTS: SpotDefinition[] = [
  // ── Lisboa ─────────────────────────────────────────────────────────────
  {
    searchQuery: 'Miradouro de Santa Catarina Lisboa',
    citySlug: 'lisboa',
    placeType: 'landmark',
    categorySlug: 'culture',
    subcategorySlug: 'sitios-historicos',
    contextTags: ['viewpoint', 'sunset', 'local-secret'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    fallbackDescription: 'One of Lisbon\'s most atmospheric viewpoints, with sweeping views over the Tagus and a distinctly local ambiance.',
  },
  {
    searchQuery: 'Jardim do Torel Lisboa',
    citySlug: 'lisboa',
    placeType: 'landmark',
    categorySlug: 'culture',
    subcategorySlug: 'sitios-historicos',
    contextTags: ['viewpoint', 'culture'],
    timeWindows: ['morning', 'afternoon'],
    fallbackDescription: 'An elevated garden with one of the most elegant panoramic views over central Lisbon. Quiet, shaded, and worth the climb.',
  },
  {
    searchQuery: 'Palácio Chiado Lisboa',
    citySlug: 'lisboa',
    placeType: 'venue',
    categorySlug: 'culture',
    contextTags: ['culture', 'romantic'],
    timeWindows: ['afternoon', 'evening'],
    fallbackDescription: 'A restored 18th-century palace in the heart of Chiado. The interiors are spectacular — gilded ceilings, azulejo walls, and a sense of old Lisbon at its most refined.',
  },

  // ── Porto ──────────────────────────────────────────────────────────────
  {
    searchQuery: 'Jardim do Morro Vila Nova de Gaia',
    citySlug: 'porto',
    placeType: 'landmark',
    categorySlug: 'culture',
    subcategorySlug: 'sitios-historicos',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    fallbackDescription: 'The iconic viewpoint facing Porto\'s Ribeira and the Dom Luís I bridge. Best at golden hour, when the light catches the tiled façades across the river.',
  },
  {
    searchQuery: 'Livraria Lello Porto',
    citySlug: 'porto',
    placeType: 'shop',
    categorySlug: 'retail',
    subcategorySlug: 'lojas-locais',
    contextTags: ['culture'],
    timeWindows: ['morning', 'afternoon'],
    fallbackDescription: 'One of the most beautiful bookshops in the world. The neo-Gothic interior, with its famous crimson staircase, is reason enough to visit.',
  },
  {
    searchQuery: 'Casa da Música Porto',
    citySlug: 'porto',
    placeType: 'venue',
    categorySlug: 'culture',
    contextTags: ['culture'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    fallbackDescription: 'Rem Koolhaas\'s concert hall is one of Porto\'s most striking pieces of contemporary architecture. The building itself is the experience.',
  },

  // ── Algarve ────────────────────────────────────────────────────────────
  {
    searchQuery: 'Ponta da Piedade Lagos',
    citySlug: 'algarve',
    placeType: 'landmark',
    categorySlug: 'natureza-outdoor',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    fallbackDescription: 'The most spectacular cliffs in the Algarve. Sculpted limestone formations, sea caves, and turquoise water — best experienced in the late afternoon light.',
  },
  {
    searchQuery: 'Praia da Marinha Algarve',
    citySlug: 'algarve',
    placeType: 'beach',
    categorySlug: 'natureza-outdoor',
    subcategorySlug: 'praias',
    contextTags: ['viewpoint'],
    timeWindows: ['morning', 'afternoon'],
    fallbackDescription: 'Regularly listed among Europe\'s most beautiful beaches. The double arch and ochre cliffs frame a stretch of coast that feels almost unreal.',
  },
  {
    searchQuery: 'Benagil Cave Algarve',
    citySlug: 'algarve',
    placeType: 'landmark',
    categorySlug: 'natureza-outdoor',
    contextTags: ['culture', 'local-secret'],
    timeWindows: ['morning', 'afternoon'],
    fallbackDescription: 'One of Portugal\'s most iconic natural formations. The cathedral-like sea cave with its collapsed ceiling is best reached by kayak or boat.',
  },

  // ── Madeira ────────────────────────────────────────────────────────────
  {
    searchQuery: 'Cabo Girão Skywalk Madeira',
    citySlug: 'madeira',
    placeType: 'landmark',
    categorySlug: 'natureza-outdoor',
    contextTags: ['viewpoint'],
    timeWindows: ['morning', 'afternoon'],
    fallbackDescription: 'A glass-floor viewpoint perched on one of Europe\'s highest sea cliffs. The vertigo is real — and so is the view.',
  },
  {
    searchQuery: 'Monte Palace Tropical Garden Funchal',
    citySlug: 'madeira',
    placeType: 'landmark',
    categorySlug: 'culture',
    contextTags: ['culture', 'viewpoint'],
    timeWindows: ['morning', 'afternoon'],
    fallbackDescription: 'A spectacular hillside garden with lakes, exotic plants, azulejo panels, and sweeping views over Funchal. One of Madeira\'s finest cultural visits.',
  },
  {
    searchQuery: 'Fanal Forest Madeira',
    citySlug: 'madeira',
    placeType: 'landmark',
    categorySlug: 'natureza-outdoor',
    contextTags: ['local-secret'],
    timeWindows: ['morning', 'afternoon'],
    fallbackDescription: 'An ancient laurel forest where 500-year-old trees emerge from the mist. One of Madeira\'s most magical and photogenic landscapes.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

function toSlug(name: string, city: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base}-${city}`
}

async function findGooglePlaceId(query: string): Promise<string | null> {
  const results = await searchGooglePlaces(query)
  if (results.length === 0) return null
  return results[0].placeId
}

async function placeExistsBySlug(slug: string): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM places WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  return rows.length > 0
}

async function placeExistsByGoogleId(googlePlaceId: string): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM places WHERE google_place_id = $1 LIMIT 1`,
    [googlePlaceId],
  )
  return rows.length > 0
}

async function assignContextTags(placeId: string, tagSlugs: string[]): Promise<number> {
  let assigned = 0
  for (const slug of tagSlugs) {
    const result = await db.query(`
      INSERT INTO place_now_tags (place_id, tag_id)
      SELECT $1, id FROM now_context_tags WHERE slug = $2
      ON CONFLICT DO NOTHING
    `, [placeId, slug])
    if (result.rowCount && result.rowCount > 0) assigned++
  }
  return assigned
}

async function assignTimeWindows(placeId: string, windows: string[]): Promise<void> {
  // Clear existing
  await db.query(`DELETE FROM place_now_time_windows WHERE place_id = $1`, [placeId])
  for (const tw of windows) {
    await db.query(`
      INSERT INTO place_now_time_windows (place_id, time_window)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [placeId, tw])
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Beautiful Spots Seed Script')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no DB changes)' : 'LIVE'}`)
  console.log(`  Photos: ${SKIP_PHOTOS ? 'SKIPPED' : 'will ingest from Google'}`)
  console.log(`  Google API key: ${GOOGLE_API_KEY ? '✓ set' : '✗ MISSING'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  if (!GOOGLE_API_KEY) {
    console.error('ERROR: GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY env var required.')
    process.exit(1)
  }

  let created = 0
  let skipped = 0
  let failed = 0

  for (const spot of BEAUTIFUL_SPOTS) {
    console.log(`\n── ${spot.searchQuery} (${spot.citySlug}) ──`)

    // 1. Search Google for the place ID
    console.log('  Searching Google Places...')
    const googlePlaceId = await findGooglePlaceId(spot.searchQuery)
    if (!googlePlaceId) {
      console.log('  ✗ Not found on Google — skipping')
      failed++
      continue
    }
    console.log(`  ✓ Found: ${googlePlaceId}`)

    // 2. Check for duplicates
    if (await placeExistsByGoogleId(googlePlaceId)) {
      console.log('  ⊘ Already exists (by Google ID) — skipping')
      skipped++
      continue
    }

    // 3. Fetch full details from Google
    console.log('  Fetching details...')
    const details = await fetchGooglePlaceDetails(googlePlaceId)
    if (!details) {
      console.log('  ✗ Could not fetch details — skipping')
      failed++
      continue
    }

    const name = details.displayName?.text ?? spot.searchQuery.split(' ')[0]
    const slug = toSlug(name, spot.citySlug)

    if (await placeExistsBySlug(slug)) {
      console.log(`  ⊘ Slug "${slug}" already taken — skipping`)
      skipped++
      continue
    }

    console.log(`  Name: ${name}`)
    console.log(`  Slug: ${slug}`)
    console.log(`  Type: ${spot.placeType}`)
    console.log(`  Tags: ${spot.contextTags.join(', ')}`)

    if (DRY_RUN) {
      console.log('  [DRY RUN] Would create this place')
      created++
      continue
    }

    // 4. Create the place
    const input: CreatePlaceInput = {
      name,
      slug,
      shortDescription: details.editorialSummary?.text ?? spot.fallbackDescription,
      citySlug: spot.citySlug,
      placeType: spot.placeType,
      categorySlug: spot.categorySlug,
      subcategorySlug: spot.subcategorySlug,
      status: 'published',
      featured: false,
      googlePlaceId: googlePlaceId,
      googleMapsUrl: details.googleMapsUri,
      googleRating: details.rating,
      googleRatingCount: details.userRatingCount,
      latitude: details.location?.latitude,
      longitude: details.location?.longitude,
      addressLine: details.formattedAddress,
      websiteUrl: details.websiteUri,
      phone: details.internationalPhoneNumber,
      bookingEnabled: false,
      bookingMode: 'none',
      reservationRelevant: false,
    }

    try {
      const result = await createPlace(input)
      console.log(`  ✓ Created: ${result.id}`)

      // 5. Assign editorial context tags (for Concierge scoring)
      const tagsAssigned = await assignContextTags(result.id, spot.contextTags)
      console.log(`  ✓ Context tags: ${tagsAssigned}/${spot.contextTags.length}`)

      // 6. Assign time windows
      await assignTimeWindows(result.id, spot.timeWindows)
      console.log(`  ✓ Time windows: ${spot.timeWindows.join(', ')}`)

      // 7. Run auto-classification (generates context_tags_auto, etc.)
      try {
        await autoClassifyPlace(result.id)
        console.log('  ✓ Auto-classified')
      } catch (err) {
        console.log('  ⚠ Auto-classify failed (non-blocking):', (err as Error).message)
      }

      // 8. Ingest photos from Google
      if (!SKIP_PHOTOS && details.photos?.length) {
        const photoNames = details.photos.slice(0, 5).map(p => p.name)
        console.log(`  Ingesting ${photoNames.length} photos...`)
        try {
          const { ingested, failed: photoFailed } = await ingestGooglePhotos(result.id, photoNames)
          console.log(`  ✓ Photos: ${ingested} ingested, ${photoFailed} failed`)
        } catch (err) {
          console.log('  ⚠ Photo ingestion failed (non-blocking):', (err as Error).message)
        }
      }

      created++
    } catch (err) {
      console.error(`  ✗ CREATE FAILED:`, (err as Error).message)
      failed++
    }

    // Rate limit: small delay between Google API calls
    await new Promise(r => setTimeout(r, 300))
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(`  Done: ${created} created, ${skipped} skipped, ${failed} failed`)
  console.log('═══════════════════════════════════════════════════════════')

  await db.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
