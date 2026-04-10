#!/usr/bin/env tsx
// ─── Seed: Portugal Scenic Viewpoints, Gardens & Walks ────────────────────
//
// Adds curated scenic landmarks to the database — viewpoints, gardens,
// coastal walks, hiking spots — enriching each with Google Places data and
// upserting hand-written EN/ES/PT translations.
//
// Differences from seed-portugal-beaches.ts:
//   - Each entry's copy is partial (the editorial brief skipped fields for
//     some places). The script writes only the fields that were provided.
//   - Existing places are left untouched on fields that already have content
//     ("fill missing" semantics) — never overwrite editorial work.
//   - For new places without an EN short description in the brief, falls back
//     to Google's editorialSummary so the place still has *something*.
//
// Usage:
//   npx tsx api/src/scripts/seed-portugal-scenic.ts
//   npx tsx api/src/scripts/seed-portugal-scenic.ts --dry-run
//   npx tsx api/src/scripts/seed-portugal-scenic.ts --skip-photos
//
// Required env: GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY), DATABASE_URL

import { db } from '../db/postgres'
import { createPlace } from '../modules/admin/places/admin-places.query'
import { autoClassifyPlace } from '../modules/admin/places/auto-classify'
import {
  searchGooglePlaces,
  ingestGooglePhotos,
} from '../modules/admin/places/generate-place'
import type { CreatePlaceInput } from '../modules/admin/places/admin-places.dto'

// ─── CLI args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN     = args.includes('--dry-run')
const SKIP_PHOTOS = args.includes('--skip-photos')

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

// ─── Google Places detail fetch ───────────────────────────────────────────

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location',
  'internationalPhoneNumber', 'websiteUri', 'googleMapsUri',
  'rating', 'userRatingCount', 'editorialSummary', 'photos',
].join(',')

interface GooglePlaceDetail {
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
    return (await res.json()) as GooglePlaceDetail
  } catch (err) {
    console.error('  ✗ Google API fetch failed:', err)
    return null
  }
}

// ─── Place definitions ────────────────────────────────────────────────────

type PlaceTypeSlug =
  | 'restaurant' | 'cafe' | 'bar' | 'shop' | 'hotel'
  | 'beach' | 'museum' | 'activity' | 'landmark' | 'venue' | 'transport' | 'other'

interface PartialLocaleCopy {
  short?: string
  long?: string
  goldenbookNote?: string
  insiderTip?: string
}

interface ScenicDefinition {
  /** Canonical name — used as the place name in DB and as the slug source */
  canonicalName: string
  searchQuery: string
  citySlug: string
  displayCity: string
  placeType: PlaceTypeSlug
  /** natureza-outdoor subcategory: 'miradouros' | 'jardins' | 'parques' | 'cascatas' | 'praias' */
  subcategorySlug?: string
  /** now_context_tags slugs */
  contextTags: string[]
  /** Time windows the editorial tip naturally suggests */
  timeWindows: ('morning' | 'midday' | 'afternoon' | 'evening' | 'night')[]
  copy: { en?: PartialLocaleCopy; es?: PartialLocaleCopy; pt?: PartialLocaleCopy }
}

const SCENIC_PLACES: ScenicDefinition[] = [
  // ════════════════════════════════════════════════════════════════════════
  //  LISBOA
  // ════════════════════════════════════════════════════════════════════════
  {
    canonicalName: 'Miradouro de Santa Catarina',
    searchQuery: 'Miradouro de Santa Catarina Lisboa Portugal',
    citySlug: 'lisboa',
    displayCity: 'Lisboa',
    placeType: 'landmark',
    subcategorySlug: 'miradouros',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['afternoon', 'evening'],
    copy: {
      en: {
        short: 'A relaxed viewpoint overlooking the Tagus River.',
        long: 'Located between Chiado and Bica, this terrace offers sweeping views over the Tagus River and Lisbon\'s rooftops. It\'s one of the city\'s most atmospheric places to pause at sunset.',
        goldenbookNote: 'One of Lisbon\'s most atmospheric sunset viewpoints.',
        insiderTip: 'Arrive just before sunset when the light over the river turns golden.',
      },
      es: {
        short: 'Un mirador relajado con vistas al río Tajo.',
        long: 'Situado entre Chiado y Bica, este mirador ofrece amplias vistas sobre el río Tajo y los tejados de Lisboa.',
        goldenbookNote: 'Uno de los miradores más atmosféricos de Lisboa.',
        insiderTip: 'Llega justo antes del atardecer cuando la luz sobre el río se vuelve dorada.',
      },
      pt: {
        short: 'Um miradouro descontraído com vista para o Tejo.',
        long: 'Situado entre o Chiado e a Bica, este miradouro oferece vistas amplas sobre o Tejo e os telhados de Lisboa.',
        goldenbookNote: 'Um dos miradouros mais atmosféricos de Lisboa.',
        insiderTip: 'Chegue pouco antes do pôr do sol quando a luz sobre o rio fica dourada.',
      },
    },
  },
  {
    canonicalName: 'Jardim da Estrela',
    searchQuery: 'Jardim da Estrela Lisboa Portugal',
    citySlug: 'lisboa',
    displayCity: 'Lisboa',
    placeType: 'landmark',
    subcategorySlug: 'jardins',
    contextTags: ['romantic', 'family'],
    timeWindows: ['morning', 'afternoon'],
    copy: {
      en: {
        short: 'A romantic 19th-century garden in central Lisbon.',
        long: 'Across from the Basílica da Estrela, this elegant garden features winding paths, lakes and shaded terraces that create one of the city\'s most peaceful green escapes.',
        goldenbookNote: 'One of Lisbon\'s most elegant historic gardens.',
        insiderTip: 'Sit by the bandstand for a quiet afternoon break.',
      },
      es: {
        short: 'Un jardín romántico del siglo XIX en el centro de Lisboa.',
        long: 'Frente a la Basílica da Estrela, este jardín ofrece senderos sinuosos, lagos y zonas de sombra.',
        goldenbookNote: 'Uno de los jardines históricos más elegantes de Lisboa.',
        insiderTip: 'Siéntate cerca del quiosco musical para una pausa tranquila.',
      },
      pt: {
        short: 'Um jardim romântico do século XIX no centro de Lisboa.',
        long: 'Em frente à Basílica da Estrela, este jardim tem caminhos sinuosos, lagos e zonas de sombra.',
        goldenbookNote: 'Um dos jardins históricos mais elegantes de Lisboa.',
        insiderTip: 'Sente-se perto do coreto para uma pausa tranquila.',
      },
    },
  },
  {
    canonicalName: 'Miradouro da Senhora do Monte',
    searchQuery: 'Miradouro Senhora do Monte Lisboa Portugal',
    citySlug: 'lisboa',
    displayCity: 'Lisboa',
    placeType: 'landmark',
    subcategorySlug: 'miradouros',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    copy: {
      en: {
        short: 'Lisbon\'s highest panoramic viewpoint.',
        long: 'Above Graça, this panoramic terrace reveals one of Lisbon\'s most complete views, from the castle to the river and the city\'s endless rooftops.',
        goldenbookNote: 'Arguably the most impressive viewpoint in Lisbon.',
        insiderTip: 'Early morning offers the clearest views of the city.',
      },
      es: {
        short: 'El mirador panorámico más alto de Lisboa.',
        long: 'Sobre Graça, este mirador ofrece una de las vistas más completas de Lisboa.',
        goldenbookNote: 'Probablemente el mirador más impresionante de Lisboa.',
        insiderTip: 'A primera hora de la mañana las vistas son más limpias.',
      },
      pt: {
        short: 'O miradouro panorâmico mais alto de Lisboa.',
        long: 'Acima da Graça, este miradouro oferece uma das vistas mais completas de Lisboa.',
        goldenbookNote: 'Provavelmente o miradouro mais impressionante de Lisboa.',
        insiderTip: 'De manhã cedo as vistas são mais nítidas.',
      },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  //  PORTO
  // ════════════════════════════════════════════════════════════════════════
  {
    canonicalName: 'Miradouro das Virtudes',
    searchQuery: 'Miradouro das Virtudes Porto Portugal',
    citySlug: 'porto',
    displayCity: 'Porto',
    placeType: 'landmark',
    subcategorySlug: 'miradouros',
    contextTags: ['viewpoint', 'sunset', 'local-secret'],
    timeWindows: ['afternoon', 'evening'],
    copy: {
      en: {
        short: 'A hidden sunset terrace overlooking the Douro.',
        goldenbookNote: 'One of Porto\'s favourite sunset spots.',
      },
      es: {
        short: 'Un mirador escondido sobre el río Duero.',
        goldenbookNote: 'Uno de los sunset spots favoritos de Porto.',
      },
      pt: {
        short: 'Um miradouro escondido sobre o Douro.',
        goldenbookNote: 'Um dos locais preferidos para ver o pôr do sol no Porto.',
      },
    },
  },
  {
    canonicalName: 'Jardim do Morro',
    searchQuery: 'Jardim do Morro Vila Nova de Gaia Portugal',
    citySlug: 'porto',
    displayCity: 'Vila Nova de Gaia',
    placeType: 'landmark',
    subcategorySlug: 'jardins',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['afternoon', 'evening'],
    copy: {
      en: {
        short: 'A hillside park facing Porto\'s historic skyline.',
        goldenbookNote: 'The classic sunset view over Porto\'s old town.',
      },
      es: {
        short: 'Un parque con vistas al skyline histórico de Porto.',
        goldenbookNote: 'La vista clásica del atardecer sobre el casco histórico.',
      },
      pt: {
        short: 'Um jardim com vista para o skyline histórico do Porto.',
        goldenbookNote: 'A vista clássica do pôr do sol sobre o centro histórico.',
      },
    },
  },
  {
    canonicalName: 'Foz do Douro Promenade',
    searchQuery: 'Foz do Douro Porto Portugal',
    citySlug: 'porto',
    displayCity: 'Foz do Douro',
    placeType: 'landmark',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['afternoon', 'evening'],
    copy: {
      en: { short: 'A coastal promenade where the Douro meets the Atlantic.' },
      es: { short: 'Un paseo marítimo donde el Duero se encuentra con el Atlántico.' },
      pt: { short: 'Um passeio marítimo onde o Douro encontra o Atlântico.' },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  //  MADEIRA
  // ════════════════════════════════════════════════════════════════════════
  {
    canonicalName: 'Miradouro da Ponta do Rosto',
    searchQuery: 'Miradouro Ponta do Rosto Madeira Portugal',
    citySlug: 'madeira',
    displayCity: 'Caniçal',
    placeType: 'landmark',
    subcategorySlug: 'miradouros',
    contextTags: ['viewpoint'],
    timeWindows: ['morning', 'afternoon'],
    copy: {
      en: { goldenbookNote: 'One of Madeira\'s most dramatic coastal viewpoints.' },
    },
  },
  {
    canonicalName: 'Ponta de São Lourenço',
    searchQuery: 'Ponta de São Lourenço Madeira Portugal',
    citySlug: 'madeira',
    displayCity: 'Caniçal',
    placeType: 'activity',
    contextTags: ['viewpoint'],
    timeWindows: ['morning'],
    copy: {},
  },
  {
    canonicalName: 'Miradouro do Guindaste',
    searchQuery: 'Miradouro do Guindaste Santana Madeira Portugal',
    citySlug: 'madeira',
    displayCity: 'Santana',
    placeType: 'landmark',
    subcategorySlug: 'miradouros',
    contextTags: ['viewpoint'],
    timeWindows: ['morning', 'afternoon'],
    copy: {},
  },

  // ════════════════════════════════════════════════════════════════════════
  //  ALGARVE
  // ════════════════════════════════════════════════════════════════════════
  {
    canonicalName: 'Algar Seco',
    searchQuery: 'Algar Seco Carvoeiro Portugal',
    citySlug: 'algarve',
    displayCity: 'Carvoeiro',
    placeType: 'landmark',
    contextTags: ['viewpoint'],
    timeWindows: ['morning', 'afternoon'],
    copy: {},
  },
  {
    // Google has no distinct entity for the boardwalk — it lives along Praia
    // da Falésia, so we use the beach's coordinates/photos but keep the
    // editorial framing in the canonical name.
    canonicalName: 'Passadiços da Praia da Falésia',
    searchQuery: 'Praia da Falésia Albufeira Portugal',
    citySlug: 'algarve',
    displayCity: 'Albufeira',
    placeType: 'activity',
    contextTags: ['viewpoint'],
    timeWindows: ['morning', 'afternoon'],
    copy: {},
  },
  {
    canonicalName: 'Miradouro da Praia da Marinha',
    searchQuery: 'Praia da Marinha viewpoint Algarve Portugal',
    citySlug: 'algarve',
    displayCity: 'Lagoa',
    placeType: 'landmark',
    subcategorySlug: 'miradouros',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    copy: {},
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

async function findExistingPlaceId(googlePlaceId: string, slug: string): Promise<string | null> {
  const { rows: byGoogle } = await db.query<{ id: string }>(
    `SELECT id FROM places WHERE google_place_id = $1 LIMIT 1`,
    [googlePlaceId],
  )
  if (byGoogle[0]) return byGoogle[0].id
  const { rows: bySlug } = await db.query<{ id: string }>(
    `SELECT id FROM places WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  return bySlug[0]?.id ?? null
}

/**
 * Translation upsert. Two modes:
 *
 *   mode = 'fill-missing'  → only writes a field if the existing row has it
 *                            NULL/empty. Used for places that already existed
 *                            in the DB before this script ran, so we never
 *                            overwrite editorial work that's already there.
 *
 *   mode = 'overwrite'     → writes every brief field, replacing whatever's
 *                            there. Used for places we just created, because
 *                            createPlace() already populated ES/PT with DeepL
 *                            auto-translations and we want the hand-written
 *                            brief to take precedence.
 */
async function upsertTranslation(
  placeId: string,
  locale: 'en' | 'es' | 'pt',
  name: string,
  copy: PartialLocaleCopy,
  mode: 'fill-missing' | 'overwrite',
): Promise<void> {
  const short = copy.short ?? null
  const long  = copy.long ?? null
  const note  = copy.goldenbookNote ?? null
  const tip   = copy.insiderTip ?? null

  // Skip entirely when nothing to write
  if (!short && !long && !note && !tip) return

  if (mode === 'overwrite') {
    await db.query(
      `
      INSERT INTO place_translations (
        place_id, locale, name, short_description, full_description,
        goldenbook_note, insider_tip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        name              = EXCLUDED.name,
        short_description = COALESCE(EXCLUDED.short_description, place_translations.short_description),
        full_description  = COALESCE(EXCLUDED.full_description,  place_translations.full_description),
        goldenbook_note   = COALESCE(EXCLUDED.goldenbook_note,   place_translations.goldenbook_note),
        insider_tip       = COALESCE(EXCLUDED.insider_tip,       place_translations.insider_tip),
        updated_at        = now()
      `,
      [placeId, locale, name, short, long, note, tip],
    )
  } else {
    await db.query(
      `
      INSERT INTO place_translations (
        place_id, locale, name, short_description, full_description,
        goldenbook_note, insider_tip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        name              = COALESCE(NULLIF(place_translations.name, ''),              EXCLUDED.name),
        short_description = COALESCE(NULLIF(place_translations.short_description, ''), EXCLUDED.short_description),
        full_description  = COALESCE(NULLIF(place_translations.full_description, ''),  EXCLUDED.full_description),
        goldenbook_note   = COALESCE(NULLIF(place_translations.goldenbook_note, ''),   EXCLUDED.goldenbook_note),
        insider_tip       = COALESCE(NULLIF(place_translations.insider_tip, ''),       EXCLUDED.insider_tip),
        updated_at        = now()
      `,
      [placeId, locale, name, short, long, note, tip],
    )
  }
}

async function assignContextTags(placeId: string, tagSlugs: string[]): Promise<number> {
  let assigned = 0
  for (const slug of tagSlugs) {
    const result = await db.query(
      `
      INSERT INTO place_now_tags (place_id, tag_id)
      SELECT $1, id FROM now_context_tags WHERE slug = $2
      ON CONFLICT DO NOTHING
      `,
      [placeId, slug],
    )
    if (result.rowCount && result.rowCount > 0) assigned++
  }
  return assigned
}

async function assignTimeWindows(placeId: string, windows: string[]): Promise<void> {
  for (const tw of windows) {
    await db.query(
      `
      INSERT INTO place_now_time_windows (place_id, time_window)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [placeId, tw],
    )
  }
}

async function placeHasImages(placeId: string): Promise<boolean> {
  const { rows } = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM place_images WHERE place_id = $1`,
    [placeId],
  )
  return (rows[0]?.c ?? 0) > 0
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Portugal Scenic Viewpoints, Gardens & Walks Seed')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no DB changes)' : 'LIVE'}`)
  console.log(`  Photos: ${SKIP_PHOTOS ? 'SKIPPED' : 'will ingest from Google when missing'}`)
  console.log(`  Google API key: ${GOOGLE_API_KEY ? '✓ set' : '✗ MISSING'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  if (!GOOGLE_API_KEY) {
    console.error('ERROR: GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY) env var is required.')
    process.exit(1)
  }

  let created = 0
  let updated = 0
  let failed = 0

  for (const def of SCENIC_PLACES) {
    console.log(`\n── ${def.canonicalName} (${def.citySlug}) ──`)

    // 1. Search Google Places
    const results = await searchGooglePlaces(def.searchQuery)
    if (results.length === 0) {
      console.log('  ✗ Not found on Google — skipping')
      failed++
      continue
    }
    const googlePlaceId = results[0].placeId
    console.log(`  ✓ Google: ${googlePlaceId} (${results[0].name})`)

    // 2. Fetch full details
    const details = await fetchGooglePlaceDetails(googlePlaceId)
    if (!details) {
      console.log('  ✗ Could not fetch details — skipping')
      failed++
      continue
    }

    const name = def.canonicalName
    const slug = toSlug(name, def.citySlug)
    console.log(`  Slug: ${slug}`)
    console.log(`  Coords: ${details.location?.latitude}, ${details.location?.longitude}`)
    console.log(`  Photos available: ${details.photos?.length ?? 0}`)

    if (DRY_RUN) {
      console.log('  [DRY RUN] Would create or update this place')
      created++
      continue
    }

    // 3. Decide create vs update
    const existingId = await findExistingPlaceId(googlePlaceId, slug)
    let placeId: string
    let isNew = false

    if (existingId) {
      placeId = existingId
      console.log(`  ⊘ Already exists: ${placeId} — filling missing fields`)
      // Backfill missing google/coords/address but never overwrite name
      await db.query(
        `
        UPDATE places SET
          google_place_id = COALESCE(google_place_id, $2),
          google_maps_url = COALESCE(google_maps_url, $3),
          latitude        = COALESCE(latitude,  $4),
          longitude       = COALESCE(longitude, $5),
          address_line    = COALESCE(NULLIF(address_line,''), $6),
          updated_at      = now()
        WHERE id = $1
        `,
        [
          placeId,
          googlePlaceId,
          details.googleMapsUri ?? null,
          details.location?.latitude ?? null,
          details.location?.longitude ?? null,
          details.formattedAddress ?? null,
        ],
      )
      updated++
    } else {
      // Pick the best available EN short description: brief → Google editorial
      const enShort =
        def.copy.en?.short ??
        details.editorialSummary?.text ??
        null

      const input: CreatePlaceInput = {
        name,
        slug,
        shortDescription: enShort ?? undefined,
        fullDescription: def.copy.en?.long ?? undefined,
        goldenbookNote: def.copy.en?.goldenbookNote ?? undefined,
        insiderTip: def.copy.en?.insiderTip ?? undefined,
        citySlug: def.citySlug,
        placeType: def.placeType,
        categorySlug: 'natureza-outdoor',
        subcategorySlug: def.subcategorySlug,
        status: 'published',
        featured: false,
        googlePlaceId,
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
        placeId = result.id
        isNew = true
        created++
        console.log(`  ✓ Created: ${placeId}`)
      } catch (err) {
        console.error('  ✗ CREATE FAILED:', (err as Error).message)
        failed++
        continue
      }
    }

    // 4. Translations:
    //    - For new places: overwrite ES/PT (createPlace populated them with
    //      DeepL output; the hand-written brief should win when present).
    //    - For existing places: fill missing only (preserve any prior
    //      editorial work).
    const mode: 'fill-missing' | 'overwrite' = isNew ? 'overwrite' : 'fill-missing'
    try {
      if (def.copy.en) await upsertTranslation(placeId, 'en', name, def.copy.en, mode)
      if (def.copy.es) await upsertTranslation(placeId, 'es', name, def.copy.es, mode)
      if (def.copy.pt) await upsertTranslation(placeId, 'pt', name, def.copy.pt, mode)
      console.log(`  ✓ Translations: ${mode} (en/es/pt)`)
    } catch (err) {
      console.error('  ✗ Translation upsert failed:', (err as Error).message)
    }

    // 5. Context tags + time windows (additive, never destructive)
    try {
      const tagsAssigned = await assignContextTags(placeId, def.contextTags)
      console.log(`  ✓ Context tags: +${tagsAssigned}/${def.contextTags.length} (${def.contextTags.join(', ')})`)
      await assignTimeWindows(placeId, def.timeWindows)
      console.log(`  ✓ Time windows: +${def.timeWindows.join(', ')}`)
    } catch (err) {
      console.error('  ✗ Tag/window assignment failed:', (err as Error).message)
    }

    // 6. Auto-classify (non-blocking)
    try {
      await autoClassifyPlace(placeId)
      console.log('  ✓ Auto-classified')
    } catch (err) {
      console.log('  ⚠ Auto-classify failed (non-blocking):', (err as Error).message)
    }

    // 7. Photos — ingest only when the place has none yet (avoid duplicates).
    if (!SKIP_PHOTOS && details.photos?.length) {
      const hasImages = isNew ? false : await placeHasImages(placeId)
      if (hasImages) {
        console.log('  ⊘ Skipping photos (place already has a gallery)')
      } else {
        const photoNames = details.photos.slice(0, 5).map((p) => p.name)
        try {
          const { ingested, failed: photoFailed } = await ingestGooglePhotos(placeId, photoNames)
          console.log(`  ✓ Photos: ${ingested} ingested, ${photoFailed} failed`)
        } catch (err) {
          console.log('  ⚠ Photo ingestion failed (non-blocking):', (err as Error).message)
        }
      }
    }

    await new Promise((r) => setTimeout(r, 300))
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(`  Done: ${created} created, ${updated} updated, ${failed} failed`)
  console.log('═══════════════════════════════════════════════════════════')

  await db.end()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error('Fatal error:', err)
  try { await db.end() } catch {}
  process.exit(1)
})
