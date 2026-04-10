#!/usr/bin/env tsx
// ─── Seed: Scenic & Cultural Places ──────────────────────────────────────
//
// Creates 7 new scenic/cultural places + assigns context tags to all 12
// (including 5 that already exist).
//
// Usage:
//   npx tsx api/src/scripts/seed-scenic-places.ts
//   npx tsx api/src/scripts/seed-scenic-places.ts --dry-run

import { db } from '../db/postgres'
import { createPlace } from '../modules/admin/places/admin-places.query'
import { autoClassifyPlace } from '../modules/admin/places/auto-classify'
import {
  searchGooglePlaces,
  ingestGooglePhotos,
} from '../modules/admin/places/generate-place'
import type { CreatePlaceInput } from '../modules/admin/places/admin-places.dto'

const DRY_RUN = process.argv.includes('--dry-run')
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location',
  'internationalPhoneNumber', 'websiteUri', 'googleMapsUri',
  'rating', 'userRatingCount', 'editorialSummary', 'photos',
].join(',')

async function fetchDetails(placeId: string) {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': DETAIL_FIELDS },
    })
    if (!res.ok) return null
    return await res.json() as any
  } catch { return null }
}

function toSlug(name: string, city: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + city
}

// ─── Places to create ─────────────────────────────────────────────────────

interface NewPlace {
  searchQuery: string
  citySlug: string
  placeType: string
  categorySlug: string
  contextTags: string[]
  timeWindows: string[]
  fallbackDesc: string
  translations: {
    en: { short: string }
    es: { short: string }
    pt: { short: string }
  }
}

const NEW_PLACES: NewPlace[] = [
  {
    searchQuery: 'Museu Calouste Gulbenkian Lisboa',
    citySlug: 'lisboa',
    placeType: 'museum',
    categorySlug: 'culture',
    contextTags: ['culture', 'viewpoint'],
    timeWindows: ['morning', 'afternoon'],
    fallbackDesc: 'One of Europe\'s finest private art collections, set within remarkable modernist gardens in the heart of Lisbon.',
    translations: {
      en: { short: 'One of Europe\'s finest private art collections, set within remarkable modernist gardens in the heart of Lisbon.' },
      es: { short: 'Una de las mejores colecciones de arte privadas de Europa, rodeada de unos jardines modernistas extraordinarios en el centro de Lisboa.' },
      pt: { short: 'Uma das melhores coleções de arte privadas da Europa, rodeada por jardins modernistas notáveis no coração de Lisboa.' },
    },
  },
  {
    searchQuery: 'LX Factory Lisboa',
    citySlug: 'lisboa',
    placeType: 'activity',
    categorySlug: 'culture',
    contextTags: ['culture', 'shopping', 'coffee'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    fallbackDesc: 'A creative district in a former industrial complex, where design studios, independent shops and cafés share raw, atmospheric spaces.',
    translations: {
      en: { short: 'A creative district in a former industrial complex, where design studios, independent shops and cafés share raw, atmospheric spaces.' },
      es: { short: 'Un distrito creativo en un antiguo complejo industrial, donde estudios de diseño, tiendas independientes y cafés comparten espacios crudos y atmosféricos.' },
      pt: { short: 'Um bairro criativo num antigo complexo industrial, onde estúdios de design, lojas independentes e cafés partilham espaços crus e com atmosfera.' },
    },
  },
  {
    searchQuery: 'Jardins do Palácio de Cristal Porto',
    citySlug: 'porto',
    placeType: 'landmark',
    categorySlug: 'culture',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    fallbackDesc: 'Sweeping gardens above the Douro with some of Porto\'s most dramatic panoramic views. A place where the city reveals its full scale.',
    translations: {
      en: { short: 'Sweeping gardens above the Douro with some of Porto\'s most dramatic panoramic views. A place where the city reveals its full scale.' },
      es: { short: 'Amplios jardines sobre el Douro con algunas de las vistas panorámicas más espectaculares de Oporto. Un lugar donde la ciudad se revela en toda su escala.' },
      pt: { short: 'Amplos jardins sobre o Douro com algumas das vistas panorâmicas mais espetaculares do Porto. Um lugar onde a cidade se revela em toda a sua escala.' },
    },
  },
  {
    searchQuery: 'Passeio das Virtudes Porto',
    citySlug: 'porto',
    placeType: 'landmark',
    categorySlug: 'culture',
    contextTags: ['viewpoint', 'sunset', 'local-secret'],
    timeWindows: ['afternoon', 'evening'],
    fallbackDesc: 'A local favourite for sunset: a stepped viewpoint overlooking the Douro valley, where Porto\'s golden hour feels most real.',
    translations: {
      en: { short: 'A local favourite for sunset: a stepped viewpoint overlooking the Douro valley, where Porto\'s golden hour feels most real.' },
      es: { short: 'Un favorito local para el atardecer: un mirador escalonado sobre el valle del Douro, donde la hora dorada de Oporto se siente más auténtica.' },
      pt: { short: 'Um favorito local para o pôr do sol: um miradouro escalonado sobre o vale do Douro, onde a hora dourada do Porto se sente mais autêntica.' },
    },
  },
  {
    searchQuery: 'Miradouro Pico dos Barcelos Funchal Madeira',
    citySlug: 'madeira',
    placeType: 'landmark',
    categorySlug: 'culture',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    fallbackDesc: 'A panoramic viewpoint above Funchal offering one of the island\'s widest perspectives: the bay, the city, and the mountains behind.',
    translations: {
      en: { short: 'A panoramic viewpoint above Funchal offering one of the island\'s widest perspectives: the bay, the city, and the mountains behind.' },
      es: { short: 'Un mirador panorámico sobre Funchal que ofrece una de las perspectivas más amplias de la isla: la bahía, la ciudad y las montañas al fondo.' },
      pt: { short: 'Um miradouro panorâmico acima do Funchal que oferece uma das perspetivas mais amplas da ilha: a baía, a cidade e as montanhas ao fundo.' },
    },
  },
  {
    searchQuery: 'Passadiços de Alvor Algarve',
    citySlug: 'algarve',
    placeType: 'activity',
    categorySlug: 'natureza-outdoor',
    contextTags: ['viewpoint', 'local-secret'],
    timeWindows: ['morning', 'afternoon'],
    fallbackDesc: 'A beautiful boardwalk through the Ria de Alvor estuary, where the landscape alternates between salt marshes, dunes and ocean views.',
    translations: {
      en: { short: 'A beautiful boardwalk through the Ria de Alvor estuary, where the landscape alternates between salt marshes, dunes and ocean views.' },
      es: { short: 'Un hermoso paseo de madera por la Ria de Alvor, donde el paisaje alterna entre marismas, dunas y vistas al océano.' },
      pt: { short: 'Um belo passadiço pela Ria de Alvor, onde a paisagem alterna entre sapais, dunas e vistas para o oceano.' },
    },
  },
  {
    searchQuery: 'Cacela Velha Algarve Portugal',
    citySlug: 'algarve',
    placeType: 'landmark',
    categorySlug: 'culture',
    contextTags: ['viewpoint', 'local-secret', 'culture'],
    timeWindows: ['morning', 'afternoon', 'evening'],
    fallbackDesc: 'A whitewashed clifftop village overlooking the Ria Formosa. One of the Algarve\'s most beautiful and quietly photogenic places.',
    translations: {
      en: { short: 'A whitewashed clifftop village overlooking the Ria Formosa. One of the Algarve\'s most beautiful and quietly photogenic places.' },
      es: { short: 'Un pueblo encalado sobre un acantilado con vistas a la Ria Formosa. Uno de los lugares más bonitos y discretamente fotogénicos del Algarve.' },
      pt: { short: 'Uma aldeia caiada de branco sobre a falésia com vista para a Ria Formosa. Um dos lugares mais bonitos e discretamente fotogénicos do Algarve.' },
    },
  },
]

// ─── Existing places that need tags ───────────────────────────────────────

const EXISTING_TAGS: { id: string; name: string; tags: string[]; windows: string[] }[] = [
  { id: '3ca593e7-4d3f-4c8d-aab9-9433becbf722', name: 'Jardim do Torel', tags: ['viewpoint', 'culture'], windows: ['morning', 'afternoon'] },
  { id: '9d8a5da0-2e04-915a-6f9d-eadd09925f0f', name: 'Serralves', tags: ['culture', 'viewpoint'], windows: ['morning', 'afternoon'] },
  { id: '6f7a0216-8337-4e7b-9820-2cd738c92026', name: 'Ponta da Piedade', tags: ['viewpoint', 'sunset'], windows: ['morning', 'afternoon', 'evening'] },
  { id: '06e99a77-3221-3ff1-5bbc-69b7ce1d1aa9', name: 'Teleférico do Jardim Botânico', tags: ['viewpoint', 'culture', 'family'], windows: ['morning', 'afternoon'] },
]

async function assignTags(placeId: string, tags: string[], windows: string[]) {
  for (const slug of tags) {
    await db.query(`
      INSERT INTO place_now_tags (place_id, tag_id)
      SELECT $1, id FROM now_context_tags WHERE slug = $2
      ON CONFLICT DO NOTHING
    `, [placeId, slug])
  }
  await db.query(`DELETE FROM place_now_time_windows WHERE place_id = $1`, [placeId])
  for (const tw of windows) {
    await db.query(`
      INSERT INTO place_now_time_windows (place_id, time_window)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [placeId, tw])
  }
}

async function upsertTranslation(placeId: string, locale: string, shortDesc: string, placeName: string) {
  const { rowCount } = await db.query(`
    UPDATE place_translations SET short_description = COALESCE(NULLIF(short_description, ''), $1), updated_at = now()
    WHERE place_id = $2 AND locale = $3
  `, [shortDesc, placeId, locale])
  if (!rowCount || rowCount === 0) {
    await db.query(`
      INSERT INTO place_translations (place_id, locale, name, short_description)
      VALUES ($1, $2, $3, $4)
    `, [placeId, locale, placeName, shortDesc])
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Scenic & Cultural Places Seed')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  if (!GOOGLE_API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY'); process.exit(1) }

  // ── Create new places ──────────────────────────────────────────────
  console.log('── Creating new places ──\n')

  for (const p of NEW_PLACES) {
    console.log(`${p.searchQuery} (${p.citySlug})`)

    const results = await searchGooglePlaces(p.searchQuery)
    if (!results.length) { console.log('  ✗ Not found on Google — skipping'); continue }

    const googleId = results[0].placeId
    console.log(`  Google: ${googleId}`)

    // Check duplicate
    const { rows: dup } = await db.query('SELECT id FROM places WHERE google_place_id = $1', [googleId])
    if (dup[0]) { console.log(`  ⊘ Already exists: ${dup[0].id}`); /* Still assign tags */ await assignExisting(dup[0].id, p); continue }

    const details = await fetchDetails(googleId)
    if (!details) { console.log('  ✗ Could not fetch details'); continue }

    const name = details.displayName?.text ?? p.searchQuery.split(' ')[0]
    const slug = toSlug(name, p.citySlug)

    const { rows: slugDup } = await db.query('SELECT id FROM places WHERE slug = $1', [slug])
    if (slugDup[0]) { console.log(`  ⊘ Slug exists: ${slug}`); await assignExisting(slugDup[0].id, p); continue }

    if (DRY_RUN) { console.log(`  [DRY] Would create: ${name}`); continue }

    const input: CreatePlaceInput = {
      name, slug,
      shortDescription: details.editorialSummary?.text ?? p.fallbackDesc,
      citySlug: p.citySlug,
      placeType: p.placeType as any,
      categorySlug: p.categorySlug,
      status: 'published',
      featured: false,
      googlePlaceId: googleId,
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

      await assignTags(result.id, p.contextTags, p.timeWindows)
      console.log(`  ✓ Tags: ${p.contextTags.join(', ')}`)

      // Translations (en/es/pt)
      await upsertTranslation(result.id, 'en', p.translations.en.short, name)
      await upsertTranslation(result.id, 'es', p.translations.es.short, name)
      await upsertTranslation(result.id, 'pt', p.translations.pt.short, name)
      console.log(`  ✓ Translations: en/es/pt`)

      try { await autoClassifyPlace(result.id); console.log('  ✓ Auto-classified') }
      catch (e) { console.log('  ⚠ Auto-classify failed:', (e as Error).message) }

      // Photos
      if (details.photos?.length) {
        const photoNames = details.photos.slice(0, 5).map((p: any) => p.name)
        try {
          const { ingested, failed } = await ingestGooglePhotos(result.id, photoNames)
          console.log(`  ✓ Photos: ${ingested} ingested, ${failed} failed`)
        } catch (e) { console.log('  ⚠ Photos failed:', (e as Error).message) }
      }
    } catch (e) {
      console.error(`  ✗ FAILED:`, (e as Error).message)
    }

    await new Promise(r => setTimeout(r, 300))
  }

  // ── Update existing places with tags ───────────────────────────────
  console.log('\n── Updating existing places ──\n')

  for (const p of EXISTING_TAGS) {
    if (DRY_RUN) { console.log(`  [DRY] ${p.name}: would assign ${p.tags.join(', ')}`); continue }
    await assignTags(p.id, p.tags, p.windows)
    console.log(`  ✓ ${p.name}: tags=${p.tags.join(', ')} windows=${p.windows.join(', ')}`)
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  Done')
  console.log('═══════════════════════════════════════════════════════════')
  await db.end()
}

async function assignExisting(id: string, p: NewPlace) {
  if (DRY_RUN) return
  await assignTags(id, p.contextTags, p.timeWindows)
  await upsertTranslation(id, 'en', p.translations.en.short, '')
  await upsertTranslation(id, 'es', p.translations.es.short, '')
  await upsertTranslation(id, 'pt', p.translations.pt.short, '')
  console.log(`  ✓ Tags + translations updated on existing place`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
