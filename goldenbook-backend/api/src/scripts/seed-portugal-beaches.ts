#!/usr/bin/env tsx
// ─── Seed: Portugal Iconic Beaches ────────────────────────────────────────
//
// Adds hand-curated scenic beaches to the database, enriching each with
// Google Places data (place_id, address, coordinates, photos) and upserting
// hand-written EN/ES/PT translations for short description, long description,
// editorial Goldenbook note, and insider tip.
//
// Beaches (idempotent — existing rows are matched by google_place_id or slug
// and refreshed in place):
//   Lisboa  : Praia da Ursa, Praia do Guincho
//   Porto   : Praia do Senhor da Pedra, Praia da Luz
//   Madeira : Praia do Seixal, Praia de Porto Santo
//   Algarve : Praia da Marinha, Praia do Camilo, Praia do Carvalho
//
// Behaviour:
//   - If a place already exists (matched by google_place_id OR slug), the
//     translations / context tags / time windows are still upserted, but the
//     place row itself is not duplicated. Photo ingestion is skipped for
//     existing places to avoid duplicates in the gallery.
//   - Hand-written PT/ES translations always overwrite the auto-translated
//     versions produced by `createPlace`.
//
// Usage:
//   npx tsx api/src/scripts/seed-portugal-beaches.ts
//   npx tsx api/src/scripts/seed-portugal-beaches.ts --dry-run
//   npx tsx api/src/scripts/seed-portugal-beaches.ts --skip-photos
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

// ─── Beach definitions ────────────────────────────────────────────────────

interface LocaleCopy {
  short: string
  long: string
  goldenbookNote: string
  insiderTip: string
}

interface BeachDefinition {
  /** Canonical Portuguese name — used as the place name in DB (overrides Google's anglicized form) */
  canonicalName: string
  searchQuery: string
  /** Hand-curated city slug — matches destinations.slug */
  citySlug: string
  /** Hand-curated display city for logging */
  displayCity: string
  /** Mapped to allowed now_context_tags slugs */
  contextTags: string[]
  /** Time windows that the insider tip naturally suggests */
  timeWindows: ('morning' | 'midday' | 'afternoon' | 'evening' | 'night')[]
  copy: { en: LocaleCopy; es: LocaleCopy; pt: LocaleCopy }
}

const BEACHES: BeachDefinition[] = [
  // ── Lisboa ───────────────────────────────────────────────────────────
  {
    canonicalName: 'Praia da Ursa',
    searchQuery: 'Praia da Ursa Sintra Portugal',
    citySlug: 'lisboa',
    displayCity: 'Sintra',
    contextTags: ['viewpoint', 'sunset', 'local-secret'],
    timeWindows: ['morning', 'evening'],
    copy: {
      en: {
        short: 'A wild beach beneath dramatic cliffs near Cabo da Roca.',
        long: 'Hidden below towering cliffs near Cabo da Roca, Praia da Ursa is one of Portugal\'s most dramatic coastal landscapes. Reaching the beach requires a steep walk, but the reward is a wild and cinematic stretch of sand surrounded by sculpted rock formations and Atlantic waves.',
        goldenbookNote: 'One of the most breathtaking beaches on Portugal\'s Atlantic coast.',
        insiderTip: 'Visit early morning or late afternoon — the descent is steep but the views are unforgettable.',
      },
      es: {
        short: 'Una playa salvaje bajo impresionantes acantilados cerca de Cabo da Roca.',
        long: 'Escondida bajo imponentes acantilados cerca del Cabo da Roca, Praia da Ursa es uno de los paisajes costeros más espectaculares de Portugal. El acceso requiere una caminata empinada, pero la recompensa es una playa salvaje rodeada de formaciones rocosas y el Atlántico.',
        goldenbookNote: 'Una de las playas más impresionantes de la costa atlántica portuguesa.',
        insiderTip: 'Visítala temprano o al final de la tarde — el descenso es empinado pero las vistas son espectaculares.',
      },
      pt: {
        short: 'Uma praia selvagem sob falésias impressionantes perto do Cabo da Roca.',
        long: 'Escondida sob falésias imponentes perto do Cabo da Roca, a Praia da Ursa é uma das paisagens costeiras mais dramáticas de Portugal. O acesso exige uma caminhada íngreme, mas a recompensa é uma praia selvagem rodeada por formações rochosas e o Atlântico.',
        goldenbookNote: 'Uma das praias mais impressionantes da costa atlântica portuguesa.',
        insiderTip: 'Visite de manhã cedo ou ao final da tarde — a descida é íngreme mas a paisagem compensa.',
      },
    },
  },

  // ── Porto ────────────────────────────────────────────────────────────
  {
    canonicalName: 'Praia do Senhor da Pedra',
    searchQuery: 'Praia do Senhor da Pedra Vila Nova de Gaia Portugal',
    citySlug: 'porto',
    displayCity: 'Vila Nova de Gaia',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['afternoon', 'evening'],
    copy: {
      en: {
        short: 'A striking beach crowned by a small seaside chapel.',
        long: 'Praia do Senhor da Pedra is famous for its picturesque chapel standing on the rocks at the edge of the Atlantic. Wooden walkways cross the dunes, creating a peaceful setting that feels both cinematic and timeless.',
        goldenbookNote: 'One of the most photogenic beaches near Porto.',
        insiderTip: 'Arrive just before sunset — the chapel silhouetted against the ocean is unforgettable.',
      },
      es: {
        short: 'Una playa icónica coronada por una pequeña capilla junto al mar.',
        long: 'La Praia do Senhor da Pedra es conocida por su pintoresca capilla situada sobre las rocas frente al Atlántico. Pasarelas de madera atraviesan las dunas creando un entorno tranquilo y muy fotogénico.',
        goldenbookNote: 'Una de las playas más fotogénicas cerca de Porto.',
        insiderTip: 'Llega justo antes del atardecer — la silueta de la capilla frente al océano es espectacular.',
      },
      pt: {
        short: 'Uma praia icónica coroada por uma pequena capela junto ao mar.',
        long: 'A Praia do Senhor da Pedra é conhecida pela sua pequena capela construída sobre as rochas junto ao Atlântico. Passadiços de madeira atravessam as dunas e criam um cenário tranquilo e muito fotogénico.',
        goldenbookNote: 'Uma das praias mais fotogénicas perto do Porto.',
        insiderTip: 'Chegue antes do pôr do sol — a silhueta da capela sobre o oceano é inesquecível.',
      },
    },
  },

  // ── Madeira ──────────────────────────────────────────────────────────
  {
    canonicalName: 'Praia do Seixal',
    searchQuery: 'Praia do Seixal Madeira Portugal',
    citySlug: 'madeira',
    displayCity: 'Seixal',
    contextTags: ['viewpoint', 'local-secret'],
    timeWindows: ['morning', 'afternoon'],
    copy: {
      en: {
        short: 'A black sand beach framed by lush volcanic mountains.',
        long: 'Located on Madeira\'s rugged north coast, Praia do Seixal combines black volcanic sand with dramatic green mountains that plunge into the Atlantic. It\'s one of the island\'s most visually striking beaches.',
        goldenbookNote: 'One of Madeira\'s most beautiful natural beaches.',
        insiderTip: 'The surrounding viewpoints offer some of the best photos of the beach and coastline.',
      },
      es: {
        short: 'Una playa de arena negra rodeada por montañas volcánicas.',
        long: 'Situada en la costa norte de Madeira, la Praia do Seixal combina arena volcánica negra con montañas verdes que descienden hasta el Atlántico.',
        goldenbookNote: 'Una de las playas naturales más bonitas de Madeira.',
        insiderTip: 'Los miradores cercanos ofrecen algunas de las mejores vistas de la playa.',
      },
      pt: {
        short: 'Uma praia de areia negra rodeada por montanhas vulcânicas.',
        long: 'Situada na costa norte da Madeira, a Praia do Seixal combina areia vulcânica negra com montanhas verdes que descem até ao Atlântico.',
        goldenbookNote: 'Uma das praias naturais mais bonitas da Madeira.',
        insiderTip: 'Os miradouros próximos oferecem algumas das melhores vistas da praia.',
      },
    },
  },

  // ── Algarve ──────────────────────────────────────────────────────────
  {
    canonicalName: 'Praia da Marinha',
    searchQuery: 'Praia da Marinha Lagoa Algarve Portugal',
    citySlug: 'algarve',
    displayCity: 'Lagoa',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['morning', 'afternoon'],
    copy: {
      en: {
        short: 'One of the most iconic beaches in the Algarve.',
        long: 'Praia da Marinha is famous for its golden cliffs, turquoise water and dramatic rock arches. Often ranked among Europe\'s most beautiful beaches, it perfectly captures the Algarve\'s coastal landscape.',
        goldenbookNote: 'A defining landscape of the Algarve coastline.',
        insiderTip: 'Walk the clifftop trail for spectacular views of the rock formations.',
      },
      es: {
        short: 'Una de las playas más icónicas del Algarve.',
        long: 'La Praia da Marinha es conocida por sus acantilados dorados, aguas turquesa y arcos naturales de roca.',
        goldenbookNote: 'Uno de los paisajes más representativos del Algarve.',
        insiderTip: 'Recorre el sendero sobre los acantilados para disfrutar de las mejores vistas.',
      },
      pt: {
        short: 'Uma das praias mais icónicas do Algarve.',
        long: 'A Praia da Marinha é conhecida pelas suas falésias douradas, água turquesa e arcos naturais de rocha.',
        goldenbookNote: 'Uma das paisagens mais emblemáticas do Algarve.',
        insiderTip: 'Percorra o trilho no topo das falésias para as melhores vistas.',
      },
    },
  },

  // ── Lisboa ───────────────────────────────────────────────────────────
  {
    canonicalName: 'Praia do Guincho',
    searchQuery: 'Praia do Guincho Cascais Portugal',
    citySlug: 'lisboa',
    displayCity: 'Cascais',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['afternoon', 'evening'],
    copy: {
      en: {
        short: 'A dramatic Atlantic beach framed by dunes and mountains.',
        long: 'Praia do Guincho is one of the most dramatic beaches near Lisbon, where powerful Atlantic waves meet vast dunes and the Sintra mountains. Its raw landscape makes it a favourite for sunset walks and scenic drives.',
        goldenbookNote: 'A wild Atlantic landscape just minutes from Cascais.',
        insiderTip: 'Drive here at sunset — the coastal road from Cascais is spectacular.',
      },
      es: {
        short: 'Una playa atlántica salvaje rodeada de dunas y montañas.',
        long: 'La Praia do Guincho es una de las playas más impresionantes cerca de Lisboa, donde las olas del Atlántico se encuentran con dunas y las montañas de Sintra.',
        goldenbookNote: 'Un paisaje atlántico salvaje a pocos minutos de Cascais.',
        insiderTip: 'Conduce hasta aquí al atardecer — la carretera costera desde Cascais es espectacular.',
      },
      pt: {
        short: 'Uma praia atlântica selvagem rodeada por dunas e montanhas.',
        long: 'A Praia do Guincho é uma das praias mais impressionantes perto de Lisboa, onde o Atlântico encontra as dunas e a serra de Sintra.',
        goldenbookNote: 'Uma paisagem atlântica selvagem a poucos minutos de Cascais.',
        insiderTip: 'Venha ao pôr do sol — a estrada costeira desde Cascais é espectacular.',
      },
    },
  },

  // ── Porto ────────────────────────────────────────────────────────────
  {
    canonicalName: 'Praia da Luz',
    searchQuery: 'Praia da Luz Porto Portugal',
    citySlug: 'porto',
    displayCity: 'Porto',
    contextTags: ['viewpoint', 'sunset'],
    timeWindows: ['afternoon', 'evening'],
    copy: {
      en: {
        short: 'A relaxed seaside stretch on Porto\'s Atlantic coast.',
        long: 'Located along Porto\'s Atlantic promenade, Praia da Luz is a favourite spot for ocean walks and sunset views. The wide seafront and open horizon create a relaxed coastal atmosphere just minutes from the city.',
        goldenbookNote: 'One of Porto\'s most pleasant seaside walks.',
        insiderTip: 'Walk the coastal promenade toward Foz do Douro for a scenic sunset route.',
      },
      es: {
        short: 'Una tranquila playa en la costa atlántica de Porto.',
        long: 'Situada en el paseo marítimo de Porto, la Praia da Luz es perfecta para paseos frente al mar y atardeceres sobre el Atlántico.',
        goldenbookNote: 'Uno de los paseos marítimos más agradables de Porto.',
        insiderTip: 'Camina por el paseo marítimo hacia Foz do Douro para un recorrido escénico al atardecer.',
      },
      pt: {
        short: 'Uma praia tranquila na costa atlântica do Porto.',
        long: 'Situada na frente marítima do Porto, a Praia da Luz é ideal para passeios junto ao mar e pores do sol sobre o Atlântico.',
        goldenbookNote: 'Um dos passeios marítimos mais agradáveis do Porto.',
        insiderTip: 'Caminhe pela marginal até à Foz do Douro para um percurso ao pôr do sol.',
      },
    },
  },

  // ── Madeira ──────────────────────────────────────────────────────────
  {
    canonicalName: 'Praia de Porto Santo',
    searchQuery: 'Praia de Porto Santo Madeira Portugal',
    citySlug: 'madeira',
    displayCity: 'Porto Santo',
    contextTags: ['viewpoint'],
    timeWindows: ['morning', 'afternoon'],
    copy: {
      en: {
        short: 'A nine-kilometre golden sand beach in the Madeira archipelago.',
        long: 'Unlike Madeira\'s volcanic coastline, Porto Santo offers a long stretch of golden sand and calm Atlantic waters. Its wide horizon and quiet atmosphere make it one of Portugal\'s most unique island beaches.',
        goldenbookNote: 'One of Portugal\'s most unusual island beaches.',
        insiderTip: 'Early morning walks here feel almost endless.',
      },
      es: {
        short: 'Una playa de arena dorada de nueve kilómetros en el archipiélago de Madeira.',
        long: 'A diferencia de la costa volcánica de Madeira, Porto Santo ofrece una larga playa de arena dorada y aguas tranquilas del Atlántico.',
        goldenbookNote: 'Una de las playas más singulares de Portugal.',
        insiderTip: 'Los paseos al amanecer aquí parecen infinitos.',
      },
      pt: {
        short: 'Uma praia de areia dourada com nove quilómetros no arquipélago da Madeira.',
        long: 'Ao contrário da costa vulcânica da Madeira, Porto Santo oferece uma longa praia de areia dourada e águas tranquilas do Atlântico.',
        goldenbookNote: 'Uma das praias mais singulares de Portugal.',
        insiderTip: 'Os passeios ao nascer do sol aqui parecem infinitos.',
      },
    },
  },

  // ── Algarve ──────────────────────────────────────────────────────────
  {
    canonicalName: 'Praia do Camilo',
    searchQuery: 'Praia do Camilo Lagos Algarve Portugal',
    citySlug: 'algarve',
    displayCity: 'Lagos',
    contextTags: ['viewpoint'],
    timeWindows: ['morning'],
    copy: {
      en: {
        short: 'A small cove framed by golden cliffs.',
        long: 'Praia do Camilo is one of Lagos\' most picturesque beaches. Wooden steps descend between dramatic cliffs to a sheltered cove with clear turquoise water.',
        goldenbookNote: 'One of the Algarve\'s most photogenic coves.',
        insiderTip: 'Arrive early — the beach is small but incredibly beautiful.',
      },
      es: {
        short: 'Una pequeña cala rodeada de acantilados dorados.',
        long: 'La Praia do Camilo es una de las playas más pintorescas de Lagos, accesible por una escalera de madera entre acantilados.',
        goldenbookNote: 'Una de las calas más fotogénicas del Algarve.',
        insiderTip: 'Llega temprano — la playa es pequeña pero espectacular.',
      },
      pt: {
        short: 'Uma pequena enseada rodeada por falésias douradas.',
        long: 'A Praia do Camilo é uma das praias mais pitorescas de Lagos, acessível por uma escadaria de madeira entre falésias.',
        goldenbookNote: 'Uma das enseadas mais fotogénicas do Algarve.',
        insiderTip: 'Chegue cedo — a praia é pequena mas muito bonita.',
      },
    },
  },

  // ── Algarve ──────────────────────────────────────────────────────────
  {
    canonicalName: 'Praia do Carvalho',
    searchQuery: 'Praia do Carvalho Lagoa Algarve Portugal',
    citySlug: 'algarve',
    displayCity: 'Lagoa',
    contextTags: ['viewpoint', 'local-secret'],
    timeWindows: ['morning', 'afternoon'],
    copy: {
      en: {
        short: 'A hidden beach reached through a tunnel in the cliffs.',
        long: 'Praia do Carvalho is one of the Algarve\'s most intriguing beaches, reached through a small tunnel carved into the cliffs. The dramatic setting and turquoise water make it a favourite among photographers.',
        goldenbookNote: 'A hidden gem among Algarve coves.',
        insiderTip: 'Look for the small tunnel entrance above the cliffs.',
      },
      es: {
        short: 'Una playa escondida a la que se accede a través de un túnel en los acantilados.',
        long: 'La Praia do Carvalho es una de las playas más curiosas del Algarve, accesible por un pequeño túnel en la roca.',
        goldenbookNote: 'Una cala escondida entre los acantilados del Algarve.',
        insiderTip: 'Busca la entrada del pequeño túnel en lo alto del acantilado.',
      },
      pt: {
        short: 'Uma praia escondida acessível por um túnel nas falésias.',
        long: 'A Praia do Carvalho é uma das praias mais curiosas do Algarve, acessível por um pequeno túnel escavado na rocha.',
        goldenbookNote: 'Uma pequena joia escondida entre as falésias do Algarve.',
        insiderTip: 'Procure a pequena entrada do túnel no topo da falésia.',
      },
    },
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
  // Prefer match by Google Place ID (the canonical identifier)
  const { rows: byGoogle } = await db.query<{ id: string }>(
    `SELECT id FROM places WHERE google_place_id = $1 LIMIT 1`,
    [googlePlaceId],
  )
  if (byGoogle[0]) return byGoogle[0].id

  // Fall back to slug match
  const { rows: bySlug } = await db.query<{ id: string }>(
    `SELECT id FROM places WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  return bySlug[0]?.id ?? null
}

async function upsertTranslation(
  placeId: string,
  locale: 'en' | 'es' | 'pt',
  name: string,
  copy: LocaleCopy,
): Promise<void> {
  await db.query(
    `
    INSERT INTO place_translations (
      place_id, locale, name, short_description, full_description,
      goldenbook_note, insider_tip
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (place_id, locale) DO UPDATE SET
      name              = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description  = EXCLUDED.full_description,
      goldenbook_note   = EXCLUDED.goldenbook_note,
      insider_tip       = EXCLUDED.insider_tip,
      updated_at        = now()
    `,
    [placeId, locale, name, copy.short, copy.long, copy.goldenbookNote, copy.insiderTip],
  )
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
  await db.query(`DELETE FROM place_now_time_windows WHERE place_id = $1`, [placeId])
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

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Portugal Iconic Beaches Seed')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no DB changes)' : 'LIVE'}`)
  console.log(`  Photos: ${SKIP_PHOTOS ? 'SKIPPED' : 'will ingest from Google'}`)
  console.log(`  Google API key: ${GOOGLE_API_KEY ? '✓ set' : '✗ MISSING'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  if (!GOOGLE_API_KEY) {
    console.error('ERROR: GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY) env var is required.')
    process.exit(1)
  }

  let created = 0
  let updated = 0
  let failed = 0

  for (const beach of BEACHES) {
    console.log(`\n── ${beach.searchQuery} (${beach.citySlug}) ──`)

    // 1. Search Google Places
    console.log('  Searching Google Places...')
    const results = await searchGooglePlaces(beach.searchQuery)
    if (results.length === 0) {
      console.log('  ✗ Not found on Google — skipping')
      failed++
      continue
    }
    const googlePlaceId = results[0].placeId
    console.log(`  ✓ Found: ${googlePlaceId} (${results[0].name})`)

    // 2. Fetch full details
    console.log('  Fetching details...')
    const details = await fetchGooglePlaceDetails(googlePlaceId)
    if (!details) {
      console.log('  ✗ Could not fetch details — skipping')
      failed++
      continue
    }

    // Always use the curated canonical Portuguese name (Google sometimes returns
    // anglicized variants like "Ursa Beach" — we want "Praia da Ursa")
    const name = beach.canonicalName
    const slug = toSlug(name, beach.citySlug)

    console.log(`  Name:    ${name}`)
    console.log(`  Slug:    ${slug}`)
    console.log(`  Address: ${details.formattedAddress ?? '—'}`)
    console.log(`  Coords:  ${details.location?.latitude}, ${details.location?.longitude}`)
    console.log(`  Photos:  ${details.photos?.length ?? 0} available`)

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
      console.log(`  ⊘ Already exists: ${placeId} — refreshing name, translations & tags`)
      // Update the canonical name on the existing place row (e.g. "Marinha Beach" → "Praia da Marinha")
      // Also keep google_place_id / address / coords in sync in case they were missing.
      await db.query(
        `
        UPDATE places SET
          name              = $2,
          google_place_id   = COALESCE(google_place_id, $3),
          google_maps_url   = COALESCE(google_maps_url, $4),
          latitude          = COALESCE(latitude,  $5),
          longitude         = COALESCE(longitude, $6),
          address_line      = COALESCE(address_line, $7),
          updated_at        = now()
        WHERE id = $1
        `,
        [
          placeId,
          name,
          googlePlaceId,
          details.googleMapsUri ?? null,
          details.location?.latitude ?? null,
          details.location?.longitude ?? null,
          details.formattedAddress ?? null,
        ],
      )
      updated++
    } else {
      const input: CreatePlaceInput = {
        name,
        slug,
        shortDescription: beach.copy.en.short,
        fullDescription: beach.copy.en.long,
        goldenbookNote: beach.copy.en.goldenbookNote,
        insiderTip: beach.copy.en.insiderTip,
        citySlug: beach.citySlug,
        placeType: 'beach',
        categorySlug: 'natureza-outdoor',
        subcategorySlug: 'praias',
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

    // 4. Always upsert hand-written translations (overwrites DeepL output)
    try {
      await upsertTranslation(placeId, 'en', name, beach.copy.en)
      await upsertTranslation(placeId, 'es', name, beach.copy.es)
      await upsertTranslation(placeId, 'pt', name, beach.copy.pt)
      console.log('  ✓ Translations: en/es/pt (hand-written)')
    } catch (err) {
      console.error('  ✗ Translation upsert failed:', (err as Error).message)
    }

    // 5. Context tags + time windows
    try {
      const tagsAssigned = await assignContextTags(placeId, beach.contextTags)
      console.log(`  ✓ Context tags: ${tagsAssigned}/${beach.contextTags.length} (${beach.contextTags.join(', ')})`)
      await assignTimeWindows(placeId, beach.timeWindows)
      console.log(`  ✓ Time windows: ${beach.timeWindows.join(', ')}`)
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

    // 7. Photos — only on new places (avoid duplicate ingestion)
    if (isNew && !SKIP_PHOTOS && details.photos?.length) {
      const photoNames = details.photos.slice(0, 5).map((p) => p.name)
      console.log(`  Ingesting ${photoNames.length} photos...`)
      try {
        const { ingested, failed: photoFailed } = await ingestGooglePhotos(placeId, photoNames)
        console.log(`  ✓ Photos: ${ingested} ingested, ${photoFailed} failed`)
      } catch (err) {
        console.log('  ⚠ Photo ingestion failed (non-blocking):', (err as Error).message)
      }
    } else if (!isNew) {
      console.log('  ⊘ Skipping photo ingestion (place already exists)')
    }

    // Rate limit between Google API calls
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
