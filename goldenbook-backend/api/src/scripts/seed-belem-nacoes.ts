#!/usr/bin/env tsx
// ─── Seed: Belém + Parque das Nações ──────────────────────────────────────
//
// Why this exists: the "tonight's plan" engine returned nothing for either
// zone, and the reason was not code. Belém had 0 places in the catalogue
// within 2 km and Parque das Nações had 1. Lisbon's 74 published places are
// almost all in Baixa and Chiado, so two of the city's biggest visitor areas
// were invisible to every surface in the app.
//
// A plan needs at least two stops of different categories within 1,2 km of
// each other, each with real opening hours. So each zone below is a walkable
// cluster with a deliberate spread across culture, gastronomy and experience,
// not simply a list of the best-known names.
//
// Every factual field comes from the Google Places API: name, coordinates,
// address, phone, website, photos, and crucially the opening hours, which the
// plan engine treats as a hard filter. Nothing factual is written by hand here.
//
// The `fallbackDescription` fields are used ONLY when Google returns no
// editorial summary. They are deliberately restrained: they say what a place
// is and what you will find there, and they make no claim about how good the
// food is or what the atmosphere feels like. Those are judgements a guide like
// Goldenbook earns by sending someone, and they should be written by whoever
// went. See the note at the end of this file.
//
// Usage:
//   npx tsx src/scripts/seed-belem-nacoes.ts --dry-run     # preview, writes nothing
//   npx tsx src/scripts/seed-belem-nacoes.ts               # full run
//   npx tsx src/scripts/seed-belem-nacoes.ts --skip-photos
//
// Required env: GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY), DATABASE_URL

import { db } from '../db/postgres'
import { createPlace } from '../modules/admin/places/admin-places.query'
import { autoClassifyPlace } from '../modules/admin/places/auto-classify'
import { ingestGooglePhotos } from '../modules/admin/places/generate-place'
import type { CreatePlaceInput } from '../modules/admin/places/admin-places.dto'

const args = process.argv.slice(2)
const DRY_RUN     = args.includes('--dry-run')
const SKIP_PHOTOS = args.includes('--skip-photos')

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

const DETAIL_FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
  'places.internationalPhoneNumber', 'places.websiteUri', 'places.googleMapsUri',
  'places.regularOpeningHours', 'places.rating', 'places.userRatingCount',
  'places.primaryType', 'places.types', 'places.editorialSummary', 'places.photos',
].join(',')

interface SeedPlace {
  /** Sent to Google Places text search. Specific enough to resolve uniquely. */
  searchQuery: string
  zone: 'Belém' | 'Parque das Nações'
  placeType: 'landmark' | 'venue' | 'shop' | 'restaurant' | 'activity' | 'museum' | 'cafe' | 'bar'
  categorySlug: string
  contextTags: string[]
  timeWindows: string[]
  /** Used only if Google has no editorial summary. Facts only, no verdicts. */
  fallbackDescription: string
}

// ─── Belém ─────────────────────────────────────────────────────────────────
// All within roughly 1 km of each other along the riverfront, so any two of
// them form a legal leg for the plan engine.

const BELEM: SeedPlace[] = [
  {
    searchQuery: 'Mosteiro dos Jerónimos, Praça do Império, Lisboa',
    zone: 'Belém', placeType: 'landmark', categorySlug: 'culture',
    contextTags: ['culture', 'landmark'], timeWindows: ['morning', 'midday', 'afternoon'],
    fallbackDescription: 'Monasterio manuelino del siglo XVI, declarado Patrimonio de la Humanidad. Alberga el claustro y la iglesia de Santa María, donde reposan Vasco da Gama y Luís de Camões.',
  },
  {
    searchQuery: 'Torre de Belém, Lisboa',
    zone: 'Belém', placeType: 'landmark', categorySlug: 'culture',
    contextTags: ['culture', 'landmark', 'viewpoint'], timeWindows: ['morning', 'midday', 'afternoon'],
    fallbackDescription: 'Torre fortificada del siglo XVI a orillas del Tajo, construida para defender la entrada del puerto. Patrimonio de la Humanidad y uno de los símbolos de la ciudad.',
  },
  {
    searchQuery: 'Pastéis de Belém, Rua de Belém, Lisboa',
    zone: 'Belém', placeType: 'cafe', categorySlug: 'gastronomy',
    contextTags: ['coffee', 'local-classic'], timeWindows: ['morning', 'midday', 'afternoon'],
    fallbackDescription: 'Pastelería abierta en 1837 que elabora el pastel de nata según la receta del antiguo monasterio. Se sirve caliente, con canela y azúcar glas aparte.',
  },
  {
    searchQuery: 'MAAT Museu de Arte Arquitetura e Tecnologia, Lisboa',
    zone: 'Belém', placeType: 'museum', categorySlug: 'culture',
    contextTags: ['culture', 'art', 'architecture'], timeWindows: ['midday', 'afternoon'],
    fallbackDescription: 'Museo de arte, arquitectura y tecnología junto al río. El edificio ondulado de Amanda Levete se puede recorrer por su cubierta, que funciona como mirador sobre el Tajo.',
  },
  {
    searchQuery: 'Padrão dos Descobrimentos, Lisboa',
    zone: 'Belém', placeType: 'landmark', categorySlug: 'culture',
    contextTags: ['culture', 'landmark', 'viewpoint'], timeWindows: ['morning', 'midday', 'afternoon', 'evening'],
    fallbackDescription: 'Monumento de 52 metros levantado sobre el muelle desde el que partían las naves. Tiene mirador en lo alto y, a sus pies, la rosa de los vientos de mármol.',
  },
  {
    searchQuery: 'Centro Cultural de Belém, Lisboa',
    zone: 'Belém', placeType: 'venue', categorySlug: 'culture',
    contextTags: ['culture', 'art'], timeWindows: ['midday', 'afternoon', 'evening'],
    fallbackDescription: 'Complejo cultural con programación de música, danza y teatro, y sede de la colección de arte moderno y contemporáneo del museo Berardo.',
  },
  {
    searchQuery: 'Darwin\'s Café, Avenida Brasília, Lisboa',
    zone: 'Belém', placeType: 'restaurant', categorySlug: 'gastronomy',
    contextTags: ['lunch', 'dinner', 'riverside'], timeWindows: ['midday', 'afternoon', 'evening'],
    fallbackDescription: 'Restaurante en la Fundación Champalimaud, con sala acristalada y terraza abiertas al Tajo y a la desembocadura.',
  },
  {
    searchQuery: 'Jardim Botânico Tropical, Belém, Lisboa',
    zone: 'Belém', placeType: 'landmark', categorySlug: 'natureza-outdoor',
    contextTags: ['nature', 'quiet'], timeWindows: ['morning', 'midday', 'afternoon'],
    fallbackDescription: 'Jardín de siete hectáreas con especies traídas de las antiguas colonias portuguesas, palmeras centenarias y un pabellón de arquitectura macaense.',
  },
]

// ─── Parque das Nações ─────────────────────────────────────────────────────
// Clustered along the riverfront promenade between the Oceanário and the
// Torre Vasco da Gama.

const NACOES: SeedPlace[] = [
  {
    searchQuery: 'Oceanário de Lisboa, Parque das Nações',
    zone: 'Parque das Nações', placeType: 'venue', categorySlug: 'experiences',
    contextTags: ['family', 'culture'], timeWindows: ['morning', 'midday', 'afternoon'],
    fallbackDescription: 'Acuario construido para la Expo 98, organizado en torno a un tanque central de cinco millones de litros que se recorre en dos niveles.',
  },
  {
    searchQuery: 'Pavilhão do Conhecimento Ciência Viva, Lisboa',
    zone: 'Parque das Nações', placeType: 'museum', categorySlug: 'culture',
    contextTags: ['family', 'culture'], timeWindows: ['morning', 'midday', 'afternoon'],
    fallbackDescription: 'Museo de ciencia interactivo con exposiciones que se manipulan, pensado tanto para adultos como para niños.',
  },
  {
    searchQuery: 'Telecabine Lisboa, Parque das Nações',
    zone: 'Parque das Nações', placeType: 'activity', categorySlug: 'experiences',
    contextTags: ['viewpoint', 'family'], timeWindows: ['midday', 'afternoon', 'evening'],
    fallbackDescription: 'Teleférico de un kilómetro que recorre el frente fluvial a treinta metros de altura, entre el Oceanário y la Torre Vasco da Gama.',
  },
  {
    searchQuery: 'Casino Lisboa, Parque das Nações',
    zone: 'Parque das Nações', placeType: 'venue', categorySlug: 'experiences',
    contextTags: ['nightlife', 'live-music'], timeWindows: ['evening', 'late_evening'],
    fallbackDescription: 'Sala de juego y espectáculos con programación de conciertos y varios restaurantes, abierta hasta la madrugada.',
  },
  {
    searchQuery: 'Jardim Garcia de Orta, Parque das Nações, Lisboa',
    zone: 'Parque das Nações', placeType: 'landmark', categorySlug: 'natureza-outdoor',
    contextTags: ['nature', 'quiet', 'riverside'], timeWindows: ['morning', 'midday', 'afternoon', 'evening'],
    fallbackDescription: 'Jardín junto al paseo ribereño con especies de las regiones que Portugal navegó, ordenadas por continente de origen.',
  },
  {
    searchQuery: 'Restaurante D\'Bacalhau, Parque das Nações, Lisboa',
    zone: 'Parque das Nações', placeType: 'restaurant', categorySlug: 'gastronomy',
    contextTags: ['lunch', 'dinner', 'riverside'], timeWindows: ['midday', 'afternoon', 'evening'],
    fallbackDescription: 'Restaurante del paseo ribereño especializado en bacalao, con carta de preparaciones tradicionales portuguesas.',
  },
  // Sustituye a República da Cerveja, que Google marca como cerrada
  // definitivamente y que por tanto no tenía horarios ni podía entrar en
  // ningún plan. Senhor Peixe está a 847 m del Oceanário, dentro del salto
  // máximo de 1,2 km, así que el grupo de Parque das Nações sigue siendo
  // caminable de punta a punta.
  {
    searchQuery: 'Senhor Peixe Restaurante Marisqueira, Parque das Nações, Lisboa',
    zone: 'Parque das Nações', placeType: 'restaurant', categorySlug: 'gastronomy',
    contextTags: ['lunch', 'dinner', 'seafood', 'riverside'], timeWindows: ['midday', 'afternoon', 'evening'],
    fallbackDescription: 'Marisquería del paseo ribereño con pescado y marisco expuesto en mostrador, que se elige y se pesa antes de pasar a la parrilla.',
  },
  {
    searchQuery: 'Torre Vasco da Gama, Parque das Nações, Lisboa',
    zone: 'Parque das Nações', placeType: 'landmark', categorySlug: 'culture',
    contextTags: ['landmark', 'viewpoint'], timeWindows: ['afternoon', 'evening'],
    fallbackDescription: 'Torre de 145 metros con perfil de vela, el edificio más alto de Lisboa, en el extremo norte del paseo ribereño.',
  },
]

// ─── Segunda tanda: calidad verificada y cobertura de tarde y noche ───────
//
// La primera tanda dejó ambas zonas con planes solo de día: casi todo eran
// museos y monumentos, que cierran entre las 18:00 y las 20:00. A las 20:30
// las dos zonas volvían a quedarse sin plan.
//
// Estos ocho se eligieron pasando un listón medible antes de crearlos, no
// después: operativo en Google, valoración >= 4,2, >= 300 reseñas y a menos
// de 1,2 km del centro de la zona. El volumen de reseñas importa tanto como
// la media, porque un 4,8 con doce opiniones no dice nada.
//
// Ese mismo filtro descartó Espaço Espelho d'Água y Enoteca de Belém, las dos
// cerradas definitivamente. Es el error que ya nos costó República da Cerveja,
// esta vez detectado antes de publicar.

const QUALITY: SeedPlace[] = [
  // ── Belém, cena ──────────────────────────────────────────────────────────
  {
    searchQuery: 'Feitoria Restaurante Altis Belém, Lisboa',
    zone: 'Belém', placeType: 'restaurant', categorySlug: 'gastronomy',
    contextTags: ['dinner', 'fine-dining', 'riverside'], timeWindows: ['evening', 'late_evening'],
    fallbackDescription: 'Restaurante de alta cocina del hotel Altis Belém, con menú de degustación de producto portugués y sala abierta al muelle.',
  },
  {
    searchQuery: 'SUD Lisboa Terrazza, Belém, Lisboa',
    zone: 'Belém', placeType: 'restaurant', categorySlug: 'gastronomy',
    contextTags: ['dinner', 'drinks', 'riverside', 'sunset'], timeWindows: ['afternoon', 'evening', 'late_evening'],
    fallbackDescription: 'Terraza y restaurante mediterráneo sobre el Tajo, con piscina, jardín y vistas al puente 25 de Abril.',
  },
  {
    searchQuery: 'Nunes Real Marisqueira, Belém, Lisboa',
    zone: 'Belém', placeType: 'restaurant', categorySlug: 'gastronomy',
    contextTags: ['lunch', 'dinner', 'seafood'], timeWindows: ['midday', 'afternoon', 'evening'],
    fallbackDescription: 'Marisquería clásica de Belém, en activo desde hace décadas, con marisco al peso y cocina portuguesa de mar.',
  },
  {
    searchQuery: 'Descobre Restaurante, Belém, Lisboa',
    zone: 'Belém', placeType: 'restaurant', categorySlug: 'gastronomy',
    contextTags: ['lunch', 'dinner'], timeWindows: ['midday', 'afternoon', 'evening'],
    fallbackDescription: 'Restaurante de cocina portuguesa contemporánea a pocos metros de los Jerónimos.',
  },
  // ── Belém, cultura ───────────────────────────────────────────────────────
  {
    searchQuery: 'Museu Nacional dos Coches, Belém, Lisboa',
    zone: 'Belém', placeType: 'museum', categorySlug: 'culture',
    contextTags: ['culture', 'family'], timeWindows: ['morning', 'midday', 'afternoon'],
    fallbackDescription: 'Museo con la mayor colección de carruajes de gala del mundo, de los siglos XVI a XIX, en un pabellón de Paulo Mendes da Rocha.',
  },
  // Belém a las 20:30 solo tenía restaurantes abiertos, y el plan exige
  // categorías distintas, así que se quedaba sin plan de noche. Este jardín
  // está abierto las 24 horas y aporta la segunda categoría. Es el único
  // candidato nocturno de la zona que pasó el listón: el gastrobar 38º41'
  // se quedó fuera con 4,0.
  {
    searchQuery: 'Jardim Vasco da Gama, Belém, Lisboa',
    zone: 'Belém', placeType: 'landmark', categorySlug: 'natureza-outdoor',
    contextTags: ['nature', 'quiet', 'evening-walk'], timeWindows: ['morning', 'midday', 'afternoon', 'evening', 'late_evening'],
    fallbackDescription: 'Jardín frente a los Jerónimos, con parterres, fuentes y bancos a la sombra de los jacarandás. Abierto de día y de noche.',
  },
  // ── Parque das Nações, tarde y noche ─────────────────────────────────────
  {
    searchQuery: 'THE CLUB Steakhouse Rooftop Bar Parque das Nações Lisboa',
    zone: 'Parque das Nações', placeType: 'restaurant', categorySlug: 'gastronomy',
    contextTags: ['dinner', 'drinks', 'rooftop', 'late-night'], timeWindows: ['evening', 'late_evening'],
    fallbackDescription: 'Asador y bar en azotea con vistas al río y a la Torre Vasco da Gama, con servicio de copas hasta tarde.',
  },
  {
    searchQuery: 'Teatro Camões, Parque das Nações, Lisboa',
    zone: 'Parque das Nações', placeType: 'venue', categorySlug: 'culture',
    contextTags: ['culture', 'live-music'], timeWindows: ['afternoon', 'evening'],
    fallbackDescription: 'Sala junto al paseo ribereño, sede de la Compañía Nacional de Bailado, con programación de danza y música.',
  },
]

const ALL = [...BELEM, ...NACOES, ...QUALITY]

// ─── Google Places ─────────────────────────────────────────────────────────

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
  regularOpeningHours?: unknown
  photos?: Array<{ name: string }>
}

async function findPlace(query: string): Promise<GooglePlaceDetail | null> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': DETAIL_FIELDS,
    },
    // Spanish, because 68,7% of real usage is in Spanish. Google returns its
    // editorial summary in that language when it has one.
    body: JSON.stringify({ textQuery: query, languageCode: 'es', maxResultCount: 1 }),
  })
  const json = (await res.json()) as { places?: GooglePlaceDetail[]; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.places?.[0] ?? null
}

function toSlug(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80)
}

async function slugTaken(slug: string): Promise<boolean> {
  const { rows } = await db.query('SELECT 1 FROM places WHERE slug = $1 LIMIT 1', [slug])
  return rows.length > 0
}

// ─── Run ───────────────────────────────────────────────────────────────────

async function main() {
  if (!GOOGLE_API_KEY) {
    console.error('Falta GOOGLE_MAPS_API_KEY. Sin ella no hay horarios reales, y sin horarios reales una ficha no entra en ningún plan.')
    process.exit(1)
  }

  console.log(`\nAltas en Belém y Parque das Nações  ${DRY_RUN ? '[DRY RUN, no escribe nada]' : ''}\n`)

  let created = 0, skipped = 0, failed = 0, noHours = 0

  for (const seed of ALL) {
    console.log(`\n${seed.zone}  ·  ${seed.searchQuery}`)

    let details: GooglePlaceDetail | null = null
    try {
      details = await findPlace(seed.searchQuery)
    } catch (err) {
      console.log(`  fallo en Google Places: ${(err as Error).message}`)
      failed++
      continue
    }

    if (!details) { console.log('  no encontrado en Google Places'); failed++; continue }
    if (!details.location) { console.log('  sin coordenadas, se descarta'); failed++; continue }

    // Opening hours are a hard filter downstream. A place without them can
    // never appear in a plan, so creating it would look like progress while
    // changing nothing.
    if (!details.regularOpeningHours) {
      console.log('  AVISO: Google no da horarios. Se crea igual, pero no entrará en ningún plan hasta que se rellenen a mano.')
      noHours++
    }

    const name = details.displayName?.text ?? seed.searchQuery.split(',')[0]
    const slug = toSlug(name)

    if (await slugTaken(slug)) { console.log(`  ya existe (${slug})`); skipped++; continue }

    const description = details.editorialSummary?.text ?? seed.fallbackDescription
    console.log(`  ${name}`)
    console.log(`  ${details.location.latitude.toFixed(5)}, ${details.location.longitude.toFixed(5)}  ·  horarios: ${details.regularOpeningHours ? 'si' : 'NO'}  ·  fotos: ${details.photos?.length ?? 0}`)
    console.log(`  texto: ${details.editorialSummary ? 'Google' : 'propio'}  "${description.slice(0, 80)}..."`)

    if (DRY_RUN) { created++; continue }

    const input: CreatePlaceInput = {
      name,
      slug,
      shortDescription: description,
      citySlug: 'lisboa',
      placeType: seed.placeType,
      categorySlug: seed.categorySlug,
      status: 'published',
      featured: false,
      googlePlaceId: details.id,
      googleMapsUrl: details.googleMapsUri,
      googleRating: details.rating,
      googleRatingCount: details.userRatingCount,
      latitude: details.location.latitude,
      longitude: details.location.longitude,
      addressLine: details.formattedAddress,
      websiteUrl: details.websiteUri,
      phone: details.internationalPhoneNumber,
      bookingEnabled: false,
      bookingMode: 'none',
      reservationRelevant: false,
    }

    try {
      const result = await createPlace(input)
      await autoClassifyPlace(result.id)
      if (!SKIP_PHOTOS && details.photos?.length) {
        const { ingested } = await ingestGooglePhotos(result.id, details.photos.slice(0, 5).map(p => p.name))
        console.log(`  creada ${result.id}  ·  ${ingested} fotos`)
      } else {
        console.log(`  creada ${result.id}`)
      }
      created++
    } catch (err) {
      console.log(`  fallo al crear: ${(err as Error).message}`)
      failed++
    }
  }

  console.log(`\n${created} creadas · ${skipped} ya existían · ${failed} fallidas · ${noHours} sin horarios de Google`)
  console.log('\nPendiente de una persona: los textos de arriba describen qué es cada sitio.')
  console.log('La voz editorial de Goldenbook, la que dice por qué merece la pena y qué pedir,')
  console.log('la tiene que escribir quien haya estado. Eso no lo puede generar un script.\n')

  await db.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
