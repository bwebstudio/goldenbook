#!/usr/bin/env tsx
// ─── Seed: Lisbon Iconic Cocktail Venues ─────────────────────────────────
//
// Adds 5 cocktail / rooftop / hotel bars to diversify Concierge pills
// (sunset_drinks, cocktail_bars, after_dinner_drinks, romantic_dinner).
//
// Behaviour mirrors seed-portugal-scenic.ts:
//   - Idempotent: existing rows matched by google_place_id or slug, refreshed
//     in place. Editorial copy is overwritten on NEW places (DeepL output ≠
//     hand-written brief), filled-missing on EXISTING rows.
//   - Photos ingested only when the place has no gallery yet.
//   - Context tags additive, time windows replaced from the brief.
//
// Taxonomy mapping:
//   brief                       → real DB schema
//   ─────                       ─────────────
//   dining_drinks / cocktail_bar→ gastronomy / bares  (place_type='bar')
//   dining_drinks / rooftop_bar → gastronomy / bares  (place_type='bar')
//   dining_drinks / hotel_bar   → gastronomy / bares  (place_type='bar')
//
// City mapping:
//   Cascais venues → city_slug='lisboa' (Cascais is part of Greater Lisbon
//   in our locality model — only 4 destinations exist).
//
// Usage:
//   npx tsx api/src/scripts/seed-lisboa-cocktails.ts
//   npx tsx api/src/scripts/seed-lisboa-cocktails.ts --dry-run
//   npx tsx api/src/scripts/seed-lisboa-cocktails.ts --skip-photos

import { db } from '../db/postgres'
import { createPlace } from '../modules/admin/places/admin-places.query'
import { autoClassifyPlace } from '../modules/admin/places/auto-classify'
import {
  searchGooglePlaces,
  ingestGooglePhotos,
} from '../modules/admin/places/generate-place'
import type { CreatePlaceInput } from '../modules/admin/places/admin-places.dto'
import { writeFileSync } from 'fs'
import { join } from 'path'

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

type CanonicalTag =
  | 'cocktails' | 'wine' | 'rooftop' | 'sunset' | 'romantic'
  | 'late-night' | 'terrace' | 'local-secret'

type Window = 'morning' | 'midday' | 'afternoon' | 'evening' | 'late_evening' | 'deep_night'

interface LocaleCopy {
  short: string
  long: string
  goldenbookNote: string
  insiderTip: string
}

interface CocktailVenue {
  /** Slug-friendly canonical name (no diacritics) */
  canonicalName: string
  /** Concierge intent reference: cocktail_bar | rooftop_bar | hotel_bar */
  briefSubcategory: 'cocktail_bar' | 'rooftop_bar' | 'hotel_bar'
  searchQuery: string
  citySlug: 'lisboa' | 'porto' | 'algarve' | 'madeira'
  displayCity: string
  contextTags: CanonicalTag[]
  timeWindows: Window[]
  copy: { en: LocaleCopy; es: LocaleCopy; pt: LocaleCopy }
}

const VENUES: CocktailVenue[] = [
  // ── Red Frog Speakeasy ────────────────────────────────────────────────
  {
    canonicalName: 'Red Frog Speakeasy',
    briefSubcategory: 'cocktail_bar',
    searchQuery: 'Red Frog Speakeasy Lisbon',
    citySlug: 'lisboa',
    displayCity: 'Lisboa',
    contextTags: ['cocktails', 'late-night', 'local-secret'],
    timeWindows: ['evening', 'late_evening', 'deep_night'],
    copy: {
      en: {
        short: 'A hidden speakeasy known for inventive mixology and a discreet doorbell entrance.',
        long: 'Tucked behind an unmarked door on Rua do Salitre, Red Frog is Lisbon\'s most acclaimed speakeasy. The intimate room conceals a serious cocktail programme that has earned a place among the world\'s best bars, built around precise technique and house-infused spirits.',
        goldenbookNote: 'One of Lisbon\'s most accomplished cocktail bars.',
        insiderTip: 'Press the small "Press for Cocktails" doorbell — the entrance is intentionally easy to miss.',
      },
      es: {
        short: 'Un speakeasy escondido reconocido por su coctelería creativa y su entrada discreta.',
        long: 'Detrás de una puerta sin señalizar en la Rua do Salitre se esconde Red Frog, el speakeasy más reconocido de Lisboa. Su sala íntima alberga un programa de coctelería serio que ha entrado en la lista de los mejores bares del mundo, construido sobre técnica precisa y destilados infusionados en casa.',
        goldenbookNote: 'Uno de los bares de coctelería más logrados de Lisboa.',
        insiderTip: 'Pulsa el pequeño timbre con la inscripción "Press for Cocktails" — la entrada está intencionalmente disimulada.',
      },
      pt: {
        short: 'Um speakeasy escondido conhecido pela coquetelaria criativa e pela entrada discreta.',
        long: 'Por trás de uma porta sem indicação na Rua do Salitre esconde-se o Red Frog, o speakeasy mais aclamado de Lisboa. A sala intimista guarda uma carta de cocktails séria que conquistou um lugar entre os melhores bares do mundo, assente em técnica precisa e destilados infundidos na própria casa.',
        goldenbookNote: 'Um dos bares de cocktails mais conseguidos de Lisboa.',
        insiderTip: 'Toque a pequena campainha com a inscrição "Press for Cocktails" — a entrada é propositadamente discreta.',
      },
    },
  },

  // ── Foxtrot ───────────────────────────────────────────────────────────
  {
    canonicalName: 'Foxtrot',
    briefSubcategory: 'cocktail_bar',
    searchQuery: 'Foxtrot Lisbon Bar',
    citySlug: 'lisboa',
    displayCity: 'Lisboa',
    contextTags: ['cocktails', 'wine', 'romantic', 'late-night'],
    timeWindows: ['evening', 'late_evening', 'deep_night'],
    copy: {
      en: {
        short: 'A historic art-deco lounge serving classic cocktails since 1978.',
        long: 'Open since 1978 in a quiet Príncipe Real street, Foxtrot feels untouched by time. Brass, dark wood and stained glass set the stage for an unhurried evening of classic cocktails, where the room itself does much of the talking.',
        goldenbookNote: 'Lisbon\'s most enduring classic cocktail lounge.',
        insiderTip: 'Order a Negroni at the bar and take in the room before sitting down.',
      },
      es: {
        short: 'Un lounge art déco histórico que sirve clásicos de coctelería desde 1978.',
        long: 'Abierto desde 1978 en una calle tranquila de Príncipe Real, Foxtrot parece detenido en el tiempo. El bronce, la madera oscura y los vitrales crean el escenario para una velada pausada de cócteles clásicos, donde la propia sala dice tanto como la carta.',
        goldenbookNote: 'El lounge clásico de coctelería más duradero de Lisboa.',
        insiderTip: 'Pide un Negroni en la barra y observa la sala antes de sentarte.',
      },
      pt: {
        short: 'Um lounge art déco histórico que serve cocktails clássicos desde 1978.',
        long: 'Aberto desde 1978 numa rua tranquila do Príncipe Real, o Foxtrot parece intocado pelo tempo. Latão, madeira escura e vitrais compõem o cenário para uma noite sem pressa de cocktails clássicos, onde a própria sala diz quase tudo.',
        goldenbookNote: 'O lounge clássico de cocktails mais duradouro de Lisboa.',
        insiderTip: 'Peça um Negroni ao balcão e observe a sala antes de se sentar.',
      },
    },
  },

  // ── Sky Bar Tivoli ────────────────────────────────────────────────────
  {
    canonicalName: 'Sky Bar by Seen — Tivoli Avenida Liberdade',
    briefSubcategory: 'rooftop_bar',
    searchQuery: 'Sky Bar Tivoli Avenida Liberdade Lisbon',
    citySlug: 'lisboa',
    displayCity: 'Lisboa',
    contextTags: ['cocktails', 'rooftop', 'sunset', 'romantic', 'terrace'],
    timeWindows: ['afternoon', 'evening', 'late_evening'],
    copy: {
      en: {
        short: 'A rooftop terrace above Avenida da Liberdade made for sunset cocktails.',
        long: 'Perched on top of Tivoli Avenida Liberdade, Sky Bar surveys Lisbon\'s grandest avenue from open-air terraces and a glass-edged pool. It is the city\'s most iconic rooftop for golden-hour drinks, with the skyline shifting from pastel to deep blue as the evening sets in.',
        goldenbookNote: 'Lisbon\'s defining rooftop sunset experience.',
        insiderTip: 'Arrive an hour before sunset to secure a seat along the eastern rail.',
      },
      es: {
        short: 'Una terraza rooftop sobre la Avenida da Liberdade pensada para cócteles al atardecer.',
        long: 'En lo alto del Tivoli Avenida Liberdade, el Sky Bar contempla la avenida más elegante de Lisboa desde sus terrazas al aire libre y la piscina con borde de cristal. Es el rooftop más emblemático de la ciudad para tomar algo durante la hora dorada, mientras el horizonte pasa del pastel al azul profundo.',
        goldenbookNote: 'La experiencia rooftop más representativa de Lisboa al atardecer.',
        insiderTip: 'Llega una hora antes del atardecer para conseguir sitio junto a la baranda este.',
      },
      pt: {
        short: 'Um terraço rooftop sobre a Avenida da Liberdade pensado para cocktails ao pôr do sol.',
        long: 'No topo do Tivoli Avenida Liberdade, o Sky Bar abraça a avenida mais elegante de Lisboa a partir de terraços ao ar livre e de uma piscina com aro de vidro. É o rooftop mais icónico da cidade para um copo à hora dourada, com o horizonte a mudar do tom pastel ao azul profundo à medida que cai a noite.',
        goldenbookNote: 'A experiência rooftop mais emblemática de Lisboa ao pôr do sol.',
        insiderTip: 'Chegue uma hora antes do pôr do sol para garantir lugar junto à grade nascente.',
      },
    },
  },

  // ── Park Bar ──────────────────────────────────────────────────────────
  {
    canonicalName: 'Park Bar',
    briefSubcategory: 'rooftop_bar',
    searchQuery: 'Park Bar Calçada do Combro Lisbon',
    citySlug: 'lisboa',
    displayCity: 'Lisboa',
    contextTags: ['cocktails', 'rooftop', 'sunset', 'local-secret', 'terrace'],
    timeWindows: ['afternoon', 'evening', 'late_evening'],
    copy: {
      en: {
        short: 'A rooftop bar hidden above a car park with panoramic sunset views over the Tagus.',
        long: 'Reached by lift through an unassuming car park near Bica, Park sits on the rooftop above Bairro Alto with one of the widest views of the Tagus in Lisbon. The wooden deck, the leafy plants and the distant church towers make every sunset feel earned.',
        goldenbookNote: 'A local-favourite sunset rooftop with one of the best Tagus views in the city.',
        insiderTip: 'Enter through the car park on Calçada do Combro and take the lift to the top floor.',
      },
      es: {
        short: 'Un rooftop escondido sobre un parking con vistas panorámicas al atardecer sobre el Tajo.',
        long: 'Se llega en ascensor a través de un parking discreto cerca de Bica, y allí, sobre el techo del Bairro Alto, está Park, con una de las vistas más amplias del Tajo en Lisboa. La tarima de madera, las plantas y las torres de iglesia a lo lejos hacen que cada atardecer parezca merecido.',
        goldenbookNote: 'Un rooftop favorito de los locales con una de las mejores vistas al Tajo.',
        insiderTip: 'Entra por el parking de la Calçada do Combro y toma el ascensor hasta la última planta.',
      },
      pt: {
        short: 'Um rooftop escondido por cima de um parque de estacionamento com vista panorâmica sobre o Tejo.',
        long: 'Chega-se de elevador através de um parque de estacionamento discreto junto à Bica e, no topo do Bairro Alto, encontra-se o Park, com uma das vistas mais amplas do Tejo em Lisboa. O deck de madeira, as plantas e as torres de igreja ao longe fazem com que cada pôr do sol pareça merecido.',
        goldenbookNote: 'Um rooftop preferido dos locais, com uma das melhores vistas sobre o Tejo na cidade.',
        insiderTip: 'Entre pelo parque de estacionamento na Calçada do Combro e suba de elevador até ao último piso.',
      },
    },
  },

  // ── Albatroz Hotel Bar (Cascais → city_slug=lisboa) ──────────────────
  {
    canonicalName: 'Albatroz Hotel Bar',
    briefSubcategory: 'hotel_bar',
    searchQuery: 'The Albatroz Hotel Cascais',
    citySlug: 'lisboa',
    displayCity: 'Cascais',
    contextTags: ['cocktails', 'sunset', 'romantic', 'terrace', 'wine'],
    timeWindows: ['afternoon', 'evening'],
    copy: {
      en: {
        short: 'An elegant terrace bar overlooking the Atlantic from a historic Cascais hotel.',
        long: 'Set in a 19th-century palace once owned by the Portuguese royal family, the Albatroz looks straight onto the Atlantic from its terrace bar in the heart of Cascais. It is one of the most refined places on the coast for a drink at golden hour, with the breakers below and the ocean stretching to the horizon.',
        goldenbookNote: 'One of the most romantic seaside bars on the Lisbon coast.',
        insiderTip: 'Reserve a terrace table for the hour just before sunset — the light off the rocks is unmatched.',
      },
      es: {
        short: 'Una terraza elegante con vistas al Atlántico desde un hotel histórico de Cascais.',
        long: 'Instalado en un palacio del siglo XIX que perteneció a la familia real portuguesa, el Albatroz mira de frente al Atlántico desde la terraza de su bar, en pleno Cascais. Es uno de los rincones más refinados de la costa para tomar algo al atardecer, con las olas rompiendo abajo y el océano extendiéndose hasta el horizonte.',
        goldenbookNote: 'Uno de los bares junto al mar más románticos de la costa de Lisboa.',
        insiderTip: 'Reserva mesa en la terraza una hora antes del atardecer — la luz sobre las rocas es inigualable.',
      },
      pt: {
        short: 'Um terraço elegante com vista para o Atlântico a partir de um hotel histórico de Cascais.',
        long: 'Instalado num palácio do século XIX que pertenceu à família real portuguesa, o Albatroz olha de frente para o Atlântico a partir do terraço do seu bar, em pleno Cascais. É um dos lugares mais refinados da costa para um copo ao fim do dia, com a rebentação em baixo e o oceano a perder-se no horizonte.',
        goldenbookNote: 'Um dos bares à beira-mar mais românticos da costa de Lisboa.',
        insiderTip: 'Reserve uma mesa no terraço para a hora antes do pôr do sol — a luz sobre as rochas é inigualável.',
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

async function overwriteTranslation(
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

async function fillMissingTranslation(
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
      name              = COALESCE(NULLIF(place_translations.name, ''),              EXCLUDED.name),
      short_description = COALESCE(NULLIF(place_translations.short_description, ''), EXCLUDED.short_description),
      full_description  = COALESCE(NULLIF(place_translations.full_description, ''),  EXCLUDED.full_description),
      goldenbook_note   = COALESCE(NULLIF(place_translations.goldenbook_note, ''),   EXCLUDED.goldenbook_note),
      insider_tip       = COALESCE(NULLIF(place_translations.insider_tip, ''),       EXCLUDED.insider_tip),
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

async function replaceTimeWindows(placeId: string, windows: string[]): Promise<void> {
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

async function placeHasImages(placeId: string): Promise<boolean> {
  const { rows } = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM place_images WHERE place_id = $1`,
    [placeId],
  )
  return (rows[0]?.c ?? 0) > 0
}

// ─── Main ─────────────────────────────────────────────────────────────────

interface JsonExportEntry {
  name: string
  slug: string
  city_slug: string
  category: string
  subcategory: string
  google_maps_query: string
  context_tags: string[]
  time_windows: string[]
  short_description_en: string
  short_description_es: string
  short_description_pt: string
  long_description_en: string
  long_description_es: string
  long_description_pt: string
  editorial_note_en: string
  editorial_note_es: string
  editorial_note_pt: string
  insider_tip_en: string
  insider_tip_es: string
  insider_tip_pt: string
  /** Filled in after Google enrichment + DB write */
  google_place_id?: string
  formatted_address?: string
  latitude?: number
  longitude?: number
  db_id?: string
  status?: 'created' | 'updated'
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Lisbon Iconic Cocktail Venues Seed')
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
  const exportRows: JsonExportEntry[] = []

  for (const v of VENUES) {
    console.log(`\n── ${v.canonicalName} (${v.citySlug} / ${v.displayCity}) ──`)

    // 1. Search Google Places
    const results = await searchGooglePlaces(v.searchQuery)
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

    const name = v.canonicalName
    const slug = toSlug(name, v.citySlug)
    console.log(`  Slug:    ${slug}`)
    console.log(`  Address: ${details.formattedAddress ?? '—'}`)
    console.log(`  Coords:  ${details.location?.latitude}, ${details.location?.longitude}`)
    console.log(`  Photos:  ${details.photos?.length ?? 0} available`)

    const baseExportEntry: JsonExportEntry = {
      name,
      slug,
      city_slug: v.citySlug,
      category: 'gastronomy',          // see top-of-file taxonomy mapping note
      subcategory: v.briefSubcategory, // brief vocabulary, kept for the JSON contract
      google_maps_query: v.searchQuery,
      context_tags: [...v.contextTags],
      time_windows: [...v.timeWindows],
      short_description_en:  v.copy.en.short,
      short_description_es:  v.copy.es.short,
      short_description_pt:  v.copy.pt.short,
      long_description_en:   v.copy.en.long,
      long_description_es:   v.copy.es.long,
      long_description_pt:   v.copy.pt.long,
      editorial_note_en:     v.copy.en.goldenbookNote,
      editorial_note_es:     v.copy.es.goldenbookNote,
      editorial_note_pt:     v.copy.pt.goldenbookNote,
      insider_tip_en:        v.copy.en.insiderTip,
      insider_tip_es:        v.copy.es.insiderTip,
      insider_tip_pt:        v.copy.pt.insiderTip,
      google_place_id:       googlePlaceId,
      formatted_address:     details.formattedAddress,
      latitude:              details.location?.latitude,
      longitude:             details.location?.longitude,
    }

    if (DRY_RUN) {
      console.log('  [DRY RUN] Would create or update this place')
      exportRows.push(baseExportEntry)
      created++
      continue
    }

    // 3. Decide create vs update
    const existingId = await findExistingPlaceId(googlePlaceId, slug)
    let placeId: string
    let isNew = false

    if (existingId) {
      placeId = existingId
      console.log(`  ⊘ Already exists: ${placeId} — refreshing missing fields, tags, windows`)
      // Backfill missing google fields without overwriting editorial work
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
      const input: CreatePlaceInput = {
        name,
        slug,
        shortDescription: v.copy.en.short,
        fullDescription:  v.copy.en.long,
        goldenbookNote:   v.copy.en.goldenbookNote,
        insiderTip:       v.copy.en.insiderTip,
        citySlug:         v.citySlug,
        placeType:        'bar',
        categorySlug:     'gastronomy',
        subcategorySlug:  'bares',
        status:           'published',
        featured:         false,
        googlePlaceId,
        googleMapsUrl:    details.googleMapsUri,
        googleRating:     details.rating,
        googleRatingCount: details.userRatingCount,
        latitude:         details.location?.latitude,
        longitude:        details.location?.longitude,
        addressLine:      details.formattedAddress,
        websiteUrl:       details.websiteUri,
        phone:            details.internationalPhoneNumber,
        bookingEnabled:   false,
        bookingMode:      'none',
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

    // 4. Translations: NEW places use overwrite (kill DeepL output), EXISTING
    //    use fill-missing to preserve any prior editorial.
    try {
      if (isNew) {
        await overwriteTranslation(placeId, 'en', name, v.copy.en)
        await overwriteTranslation(placeId, 'es', name, v.copy.es)
        await overwriteTranslation(placeId, 'pt', name, v.copy.pt)
      } else {
        await fillMissingTranslation(placeId, 'en', name, v.copy.en)
        await fillMissingTranslation(placeId, 'es', name, v.copy.es)
        await fillMissingTranslation(placeId, 'pt', name, v.copy.pt)
      }
      console.log(`  ✓ Translations: ${isNew ? 'overwrite' : 'fill-missing'} (en/es/pt)`)
    } catch (err) {
      console.error('  ✗ Translation upsert failed:', (err as Error).message)
    }

    // 5. Context tags + time windows
    try {
      const tagsAssigned = await assignContextTags(placeId, v.contextTags)
      console.log(`  ✓ Context tags: +${tagsAssigned}/${v.contextTags.length} (${v.contextTags.join(', ')})`)
      await replaceTimeWindows(placeId, v.timeWindows)
      console.log(`  ✓ Time windows: ${v.timeWindows.join(', ')}`)
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

    // 7. Photos — only when no gallery yet
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

    exportRows.push({
      ...baseExportEntry,
      db_id: placeId,
      status: isNew ? 'created' : 'updated',
    })

    await new Promise((r) => setTimeout(r, 300))
  }

  // ── Write JSON export ──────────────────────────────────────────────
  if (!DRY_RUN) {
    const outPath = join(__dirname, '..', '..', '..', 'docs', 'cocktail-venues-lisbon.json')
    writeFileSync(outPath, JSON.stringify(exportRows, null, 2))
    console.log(`\n✓ JSON export written: ${outPath}`)
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
