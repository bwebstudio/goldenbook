#!/usr/bin/env tsx
// ─── Seed: Routes & Golden Picks (full editorial replacement) ─────────────
//
// 1. Deletes ALL existing curated routes + stops
// 2. Deletes ALL existing golden_picks from place_visibility
// 3. Creates 9 missing places as minimal editorial entries
// 4. Creates 9 new curated routes with i18n
// 5. Creates golden picks for all 4 cities
//
// Usage:
//   npx tsx api/src/scripts/seed-routes-golden-picks.ts
//   npx tsx api/src/scripts/seed-routes-golden-picks.ts --dry-run

import { db } from '../db/postgres'

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Helpers ──────────────────────────────────────────────────────────────

function toSlug(name: string, city: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + city
}

async function resolveDestinationId(citySlug: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM destinations WHERE slug = $1 AND is_active = true LIMIT 1`,
    [citySlug],
  )
  if (!rows[0]) throw new Error(`Destination not found: ${citySlug}`)
  return rows[0].id
}

async function resolveCategoryId(slug: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  if (!rows[0]) throw new Error(`Category not found: ${slug}`)
  return rows[0].id
}

async function findPlaceByName(name: string, citySlug?: string): Promise<{ id: string; slug: string; name: string } | null> {
  // Try exact match first, then fuzzy
  const queries = [
    { sql: `SELECT p.id, p.slug, p.name FROM places p JOIN destinations d ON d.id = p.destination_id WHERE p.name ILIKE $1 ${citySlug ? 'AND d.slug = $2' : ''} LIMIT 1`, params: citySlug ? [name, citySlug] : [name] },
    { sql: `SELECT p.id, p.slug, p.name FROM places p JOIN destinations d ON d.id = p.destination_id WHERE p.name ILIKE $1 ${citySlug ? 'AND d.slug = $2' : ''} LIMIT 1`, params: citySlug ? [`%${name}%`, citySlug] : [`%${name}%`] },
  ]
  for (const q of queries) {
    const { rows } = await db.query<{ id: string; slug: string; name: string }>(q.sql, q.params)
    if (rows[0]) return rows[0]
  }
  return null
}

async function findPlaceById(id: string): Promise<{ id: string; slug: string; name: string } | null> {
  const { rows } = await db.query<{ id: string; slug: string; name: string }>(
    `SELECT id, slug, name FROM places WHERE id = $1 LIMIT 1`,
    [id],
  )
  return rows[0] ?? null
}

// ─── Missing places to create ─────────────────────────────────────────────

interface MissingPlace {
  name: string
  citySlug: string
  placeType: string
  categorySlug: string
  subcategorySlug?: string
}

const MISSING_PLACES: MissingPlace[] = [
  // Madeira
  { name: 'Seapleasure', citySlug: 'madeira', placeType: 'activity', categorySlug: 'experiences', subcategorySlug: 'experiencias-unicas' },
  { name: 'Quinta Magnólia', citySlug: 'madeira', placeType: 'landmark', categorySlug: 'culture', subcategorySlug: 'sitios-historicos' },
  { name: 'Winetours', citySlug: 'madeira', placeType: 'activity', categorySlug: 'experiences', subcategorySlug: 'experiencias-unicas' },
  { name: 'Dermalaser', citySlug: 'madeira', placeType: 'activity', categorySlug: 'experiences' },
  { name: 'Forest Food', citySlug: 'madeira', placeType: 'restaurant', categorySlug: 'gastronomy', subcategorySlug: 'restaurantes' },
  // Lisboa
  { name: 'Arneiro', citySlug: 'lisboa', placeType: 'restaurant', categorySlug: 'gastronomy', subcategorySlug: 'restaurantes' },
  // Algarve
  { name: 'CVA – Comissão Vitivinícola do Algarve', citySlug: 'algarve', placeType: 'activity', categorySlug: 'experiences', subcategorySlug: 'experiencias-unicas' },
  // Porto
  { name: 'Loja THE', citySlug: 'porto', placeType: 'shop', categorySlug: 'retail', subcategorySlug: 'lojas-locais' },
  { name: 'Imobiliária KA', citySlug: 'porto', placeType: 'other', categorySlug: 'retail' },
]

async function createMinimalPlace(p: MissingPlace): Promise<string> {
  const slug = toSlug(p.name, p.citySlug)
  const destId = await resolveDestinationId(p.citySlug)
  const catId = await resolveCategoryId(p.categorySlug)

  let subcatId: string | null = null
  if (p.subcategorySlug) {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
      [p.subcategorySlug],
    )
    subcatId = rows[0]?.id ?? null
  }

  // Check if slug exists
  const { rows: existing } = await db.query<{ id: string }>(
    `SELECT id FROM places WHERE slug = $1 LIMIT 1`, [slug],
  )
  if (existing[0]) return existing[0].id

  const { rows: [created] } = await db.query<{ id: string }>(`
    INSERT INTO places (destination_id, slug, name, status, place_type, is_active, featured, published_at)
    VALUES ($1, $2, $3, 'published', $4, true, false, now())
    RETURNING id
  `, [destId, slug, p.name, p.placeType])

  // Category
  await db.query(`
    INSERT INTO place_categories (place_id, category_id, subcategory_id, is_primary)
    VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING
  `, [created.id, catId, subcatId])

  // Minimal EN translation
  await db.query(`
    INSERT INTO place_translations (place_id, locale, name)
    VALUES ($1, 'en', $2) ON CONFLICT (place_id, locale) DO NOTHING
  `, [created.id, p.name])

  return created.id
}

// ─── Known place IDs (from DB lookup) ─────────────────────────────────────

const KNOWN: Record<string, string> = {
  // Madeira
  'monte-palace': '4fd5eb09-9de2-a959-9013-d7bcb1844724',
  'desarma': '47aa7560-2bc8-39b3-1a2c-e7efb123ece5',
  'david-rosas': '47ed17fa-2707-ac1e-5d60-3dd87d74c9fa',
  'henriques-henriques': 'd3a8b0ad-ea2d-1caf-e85b-ae60b439fdb1',
  'fabrica-ribeiro-seco': '4ca2f9df-1c07-2447-28bd-5916ef43a254',
  'casal-da-penha': '4fc0d83b-da0c-3940-8e31-c5d15252b01b',
  // Lisboa
  'fundacao-amalia': 'e3720f28-1703-14f8-9a7a-292f3b1dd992',
  'el-corte-ingles': 'c3dcaff7-4cff-d8ee-1d76-9ff629e7dda0',
  'bico-vinho': '5eef2492-bd02-e1e3-b1ed-274cdac737b4',
  'palacio-biester': 'fb7a65e6-92ac-e21c-1030-b55ee7dd411e',
  'tacho-real': 'fe8f8df1-3b01-4e41-9c57-946de60f5aff',
  'marlene-vieira': '5cb490e4-e5bd-37f7-8e84-c02c2a46c949',
  'fashion-clinic': '8242da11-2654-8460-e3c1-7efe8da02051',
  'confeitaria-nacional': '11cb6922-d4fb-d14a-693e-2e78d68d773b',
  'barbour': '0178bf45-a60d-6a63-c2aa-6c2d409985d4',
  // Algarve
  'sand-city': '493eb67b-9fdc-aaaf-0fba-867ad69d04f7',
  'ecosuncharters': 'aa94d9b3-123a-ab2f-3cbf-4f4070681c89',
  'parrilla-natural': '0d2be58f-fc2f-dc08-5e84-7a51bf3ae427',
  'willies': '8dcd5464-d157-17cb-e82b-832d03203996',
  'well-vale-lobo': '47bc8e22-96a9-0775-0c95-fe6b636801b9',
  'churrasqueira': '441296af-0140-db0a-400a-e84aa80cf504',
  'sensorial-spa': 'c7ae8443-491d-3ff5-dfb5-eeaa2e6df35c',
  // Porto
  'praia-da-luz': '3e670e57-5c86-16e2-8931-667494194df5',
  'palacio-bolsa': 'ddf37c29-2a35-945a-6d55-4d2846f7268d',
  'panamar': '2c21bfd6-ccf4-32b5-cb84-9172dd9b3046',
  'dop': '09bc6d9a-e6e7-ede5-9655-1857b55e6fa7',
  'serralves': '9d8a5da0-2e04-915a-6f9d-eadd09925f0f',
  'pedro-lemos': 'db7f5e39-833c-a014-1932-ee0e34886ea8',
  'marisqueira-matosinhos': '38aeba08-f14a-06df-d06f-adc1f00444c4',
  'fred-perry': '3946e292-da1e-7a61-a960-83d59267b4bd',
  'marcolino': '387ffb06-6676-119a-3747-820e9ee747eb',
}

// ─── Route definitions ────────────────────────────────────────────────────

interface RouteDefinition {
  citySlug: string
  routeType: 'editorial' | 'sponsored'
  status?: string
  statusReason?: string
  title_en: string
  title_es: string
  title_pt: string
  summary_en: string
  summary_es: string
  summary_pt: string
  /** Place keys from KNOWN map, or 'missing:index' for newly created */
  stops: string[]
}

const ROUTES: RouteDefinition[] = [
  // ── Madeira Route 1 ─────────────────────────────────────────────
  {
    citySlug: 'madeira',
    routeType: 'editorial',
    title_en: 'Art, gardens and refined dining in Funchal',
    title_es: 'Arte, jardín y gastronomía en Funchal',
    title_pt: 'Arte, jardins e gastronomia no Funchal',
    summary_en: 'A journey through lush gardens, contemporary design and refined cuisine overlooking the Atlantic.',
    summary_es: 'Un recorrido que combina naturaleza exuberante, diseño contemporáneo y cocina refinada con vistas al Atlántico.',
    summary_pt: 'Um percurso que combina jardins exuberantes, design contemporâneo e cozinha sofisticada com vista para o Atlântico.',
    stops: ['monte-palace', 'desarma', 'david-rosas'],
  },
  // ── Madeira Route 2 ─────────────────────────────────────────────
  {
    citySlug: 'madeira',
    routeType: 'editorial',
    title_en: 'Sea, gardens and Madeira wine',
    title_es: 'Mar, bienestar y vino en Madeira',
    title_pt: 'Mar, jardins e vinho da Madeira',
    summary_en: 'A relaxed experience combining the ocean, historic gardens and the traditions of Madeira wine.',
    summary_es: 'Una experiencia entre el océano, jardines históricos y el mundo del vino de Madeira.',
    summary_pt: 'Uma experiência entre o oceano, jardins históricos e a tradição do vinho da Madeira.',
    stops: ['missing:seapleasure', 'missing:quinta-magnolia', 'missing:winetours'],
  },
  // ── Lisboa Route 1 ──────────────────────────────────────────────
  {
    citySlug: 'lisboa',
    routeType: 'editorial',
    title_en: 'Classic and contemporary Lisbon',
    title_es: 'Lisboa clásica y contemporánea',
    title_pt: 'Lisboa clássica e contemporânea',
    summary_en: 'Culture, gastronomy and shopping in the historic heart of Lisbon.',
    summary_es: 'Cultura, gastronomía y compras en el corazón histórico de Lisboa.',
    summary_pt: 'Cultura, gastronomia e compras no coração histórico de Lisboa.',
    stops: ['fundacao-amalia', 'el-corte-ingles', 'bico-vinho'],
  },
  // ── Lisboa Route 2 ──────────────────────────────────────────────
  {
    citySlug: 'lisboa',
    routeType: 'editorial',
    title_en: 'Sintra and Portuguese tradition',
    title_es: 'Sintra y tradición portuguesa',
    title_pt: 'Sintra e tradição portuguesa',
    summary_en: 'Romantic palaces and traditional cuisine just outside Lisbon.',
    summary_es: 'Palacios románticos y gastronomía tradicional a pocos minutos de Lisboa.',
    summary_pt: 'Palácios românticos e cozinha tradicional portuguesa perto de Lisboa.',
    stops: ['palacio-biester', 'missing:arneiro', 'tacho-real'],
  },
  // ── Algarve Route 1 ─────────────────────────────────────────────
  {
    citySlug: 'algarve',
    routeType: 'editorial',
    title_en: 'Nature and flavours of the Algarve',
    title_es: 'Naturaleza y sabores del Algarve',
    title_pt: 'Natureza e sabores do Algarve',
    summary_en: 'Outdoor art, ocean experiences and traditional Algarve cuisine.',
    summary_es: 'Arte al aire libre, mar y cocina tradicional del sur de Portugal.',
    summary_pt: 'Arte ao ar livre, mar e cozinha tradicional algarvia.',
    stops: ['sand-city', 'ecosuncharters', 'parrilla-natural'],
  },
  // ── Algarve Route 2 (pending) ───────────────────────────────────
  {
    citySlug: 'algarve',
    routeType: 'editorial',
    status: 'pending_editorial',
    statusReason: 'Aguardamos a saída da nova edição editorial.',
    title_en: 'Coming soon',
    title_es: 'Próximamente',
    title_pt: 'Em breve',
    summary_en: 'A new editorial route for the Algarve is being prepared.',
    summary_es: 'Una nueva ruta editorial para el Algarve está en preparación.',
    summary_pt: 'Uma nova rota editorial para o Algarve está a ser preparada.',
    stops: [],
  },
  // ── Porto Route 1 ───────────────────────────────────────────────
  {
    citySlug: 'porto',
    routeType: 'editorial',
    title_en: 'Design and dining by the Atlantic',
    title_es: 'Diseño y gastronomía frente al Atlántico',
    title_pt: 'Design e gastronomia junto ao Atlântico',
    summary_en: 'Contemporary architecture, fashion and Portuguese cuisine.',
    summary_es: 'Un recorrido entre arquitectura contemporánea, moda y cocina portuguesa.',
    summary_pt: 'Arquitetura contemporânea, moda e cozinha portuguesa.',
    stops: ['praia-da-luz', 'missing:loja-the', 'missing:imobiliaria-ka'],
  },
  // ── Porto Route 2 ───────────────────────────────────────────────
  {
    citySlug: 'porto',
    routeType: 'editorial',
    title_en: 'Heritage and elegance in Porto',
    title_es: 'Tradición y elegancia en Porto',
    title_pt: 'Tradição e elegância no Porto',
    summary_en: 'History, curated shopping and fine dining in Porto.',
    summary_es: 'Historia, compras seleccionadas y alta gastronomía en el centro histórico.',
    summary_pt: 'História, compras selecionadas e alta gastronomia no centro histórico.',
    stops: ['palacio-bolsa', 'panamar', 'dop'],
  },
]

// ─── Golden Picks definitions ─────────────────────────────────────────────

interface GoldenPickDef {
  citySlug: string
  /** Key from KNOWN map or 'missing:name' */
  placeKey: string
  priority: number
}

const GOLDEN_PICKS: GoldenPickDef[] = [
  // Madeira
  { citySlug: 'madeira', placeKey: 'missing:dermalaser', priority: 5 },
  { citySlug: 'madeira', placeKey: 'henriques-henriques', priority: 4 },
  { citySlug: 'madeira', placeKey: 'fabrica-ribeiro-seco', priority: 3 },
  { citySlug: 'madeira', placeKey: 'missing:forest-food', priority: 2 },
  { citySlug: 'madeira', placeKey: 'casal-da-penha', priority: 1 },
  // Lisboa
  { citySlug: 'lisboa', placeKey: 'marlene-vieira', priority: 4 },
  { citySlug: 'lisboa', placeKey: 'fashion-clinic', priority: 3 },
  { citySlug: 'lisboa', placeKey: 'confeitaria-nacional', priority: 2 },
  { citySlug: 'lisboa', placeKey: 'barbour', priority: 1 },
  // Algarve
  { citySlug: 'algarve', placeKey: 'willies', priority: 5 },
  { citySlug: 'algarve', placeKey: 'well-vale-lobo', priority: 4 },
  { citySlug: 'algarve', placeKey: 'churrasqueira', priority: 3 },
  { citySlug: 'algarve', placeKey: 'sensorial-spa', priority: 2 },
  { citySlug: 'algarve', placeKey: 'missing:cva-algarve', priority: 1 },
  // Porto
  { citySlug: 'porto', placeKey: 'serralves', priority: 5 },
  { citySlug: 'porto', placeKey: 'pedro-lemos', priority: 4 },
  { citySlug: 'porto', placeKey: 'marisqueira-matosinhos', priority: 3 },
  { citySlug: 'porto', placeKey: 'fred-perry', priority: 2 },
  { citySlug: 'porto', placeKey: 'marcolino', priority: 1 },
]

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Routes & Golden Picks — Full Editorial Replacement')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  // Map to store newly created place IDs
  const createdPlaceIds: Record<string, string> = {}

  // ── STEP 1: Create missing places ────────────────────────────────
  console.log('── Step 1: Creating missing places ──\n')

  const missingNameToKey: Record<string, string> = {
    'Seapleasure':     'seapleasure',
    'Quinta Magnólia': 'quinta-magnolia',
    'Winetours':       'winetours',
    'Dermalaser':      'dermalaser',
    'Forest Food':     'forest-food',
    'Arneiro':         'arneiro',
    'CVA – Comissão Vitivinícola do Algarve': 'cva-algarve',
    'Loja THE':        'loja-the',
    'Imobiliária KA':  'imobiliaria-ka',
  }

  for (const p of MISSING_PLACES) {
    const key = missingNameToKey[p.name]
    if (DRY_RUN) {
      console.log(`  [DRY] Would create: ${p.name} (${p.citySlug})`)
      createdPlaceIds[key] = 'dry-run-placeholder'
      continue
    }
    try {
      const id = await createMinimalPlace(p)
      createdPlaceIds[key] = id
      console.log(`  ✓ ${p.name} → ${id}`)
    } catch (err) {
      console.error(`  ✗ ${p.name}: ${(err as Error).message}`)
    }
  }

  // Build unified place ID resolver
  function resolvePlaceId(key: string): string | null {
    if (key.startsWith('missing:')) {
      const missingKey = key.slice(8) // remove 'missing:'
      return createdPlaceIds[missingKey] ?? null
    }
    return KNOWN[key] ?? null
  }

  // ── STEP 2: Delete existing routes ───────────────────────────────
  console.log('\n── Step 2: Clearing existing routes ──\n')

  if (DRY_RUN) {
    console.log('  [DRY] Would delete all curated_route_stops')
    console.log('  [DRY] Would delete all curated_routes')
  } else {
    const { rowCount: stopsDeleted } = await db.query(`DELETE FROM curated_route_stops`)
    console.log(`  ✓ Deleted ${stopsDeleted} curated route stops`)
    const { rowCount: routesDeleted } = await db.query(`DELETE FROM curated_routes`)
    console.log(`  ✓ Deleted ${routesDeleted} curated routes`)

    // Also clear legacy routes if any exist
    try {
      const { rowCount: legacyStops } = await db.query(`DELETE FROM route_places`)
      const { rowCount: legacyTranslations } = await db.query(`DELETE FROM route_translations`)
      const { rowCount: legacyRoutes } = await db.query(`DELETE FROM routes`)
      if ((legacyRoutes ?? 0) > 0) {
        console.log(`  ✓ Deleted ${legacyRoutes} legacy routes, ${legacyStops} stops, ${legacyTranslations} translations`)
      }
    } catch {
      // Legacy tables may not exist — safe to ignore
    }
  }

  // ── STEP 3: Delete existing golden picks ─────────────────────────
  console.log('\n── Step 3: Clearing existing golden picks ──\n')

  if (DRY_RUN) {
    console.log('  [DRY] Would delete all golden_picks from place_visibility')
  } else {
    const { rowCount } = await db.query(
      `DELETE FROM place_visibility WHERE surface = 'golden_picks'`,
    )
    console.log(`  ✓ Deleted ${rowCount} golden picks`)
  }

  // ── STEP 4: Create new routes ────────────────────────────────────
  console.log('\n── Step 4: Creating new routes ──\n')

  for (const route of ROUTES) {
    const isPending = route.status === 'pending_editorial'
    const expiresAt = isPending
      ? new Date(Date.now() + 365 * 86_400_000).toISOString() // 1 year for pending
      : new Date(Date.now() + 180 * 86_400_000).toISOString() // 6 months for active

    console.log(`  ${route.title_en} (${route.citySlug})${isPending ? ' [PENDING]' : ''}`)

    if (DRY_RUN) {
      console.log(`    [DRY] Would create with ${route.stops.length} stops`)
      continue
    }

    const { rows: [created] } = await db.query<{ id: string }>(`
      INSERT INTO curated_routes (
        city_slug, route_type, title, summary,
        title_translations, summary_translations,
        starts_at, expires_at, is_active
      ) VALUES (
        $1, $2, $3, $4,
        $5::jsonb, $6::jsonb,
        now(), $7::timestamptz, $8
      ) RETURNING id
    `, [
      route.citySlug,
      route.routeType,
      route.title_en,
      route.summary_en,
      JSON.stringify({ pt: route.title_pt, es: route.title_es }),
      JSON.stringify({ pt: route.summary_pt, es: route.summary_es }),
      expiresAt,
      !isPending, // is_active = false for pending
    ])

    console.log(`    ✓ Route created: ${created.id}`)

    // Create stops
    for (let i = 0; i < route.stops.length; i++) {
      const stopKey = route.stops[i]
      const placeId = resolvePlaceId(stopKey)
      if (!placeId) {
        console.log(`    ⚠ Stop ${i + 1}: place not found for key "${stopKey}"`)
        continue
      }
      await db.query(`
        INSERT INTO curated_route_stops (route_id, place_id, stop_order)
        VALUES ($1, $2, $3)
      `, [created.id, placeId, i + 1])
      console.log(`    ✓ Stop ${i + 1}: ${stopKey}`)
    }
  }

  // ── STEP 5: Create golden picks ──────────────────────────────────
  console.log('\n── Step 5: Creating golden picks ──\n')

  let picksCreated = 0
  for (const pick of GOLDEN_PICKS) {
    const placeId = resolvePlaceId(pick.placeKey)
    if (!placeId) {
      console.log(`  ⚠ ${pick.placeKey} (${pick.citySlug}): place not found`)
      continue
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${pick.placeKey} → golden_picks (${pick.citySlug}, priority ${pick.priority})`)
      picksCreated++
      continue
    }

    await db.query(`
      INSERT INTO place_visibility (place_id, surface, visibility_type, priority, is_active, starts_at)
      VALUES ($1, 'golden_picks', 'editorial', $2, true, now())
      ON CONFLICT DO NOTHING
    `, [placeId, pick.priority])

    console.log(`  ✓ ${pick.placeKey} → golden_picks (priority ${pick.priority})`)
    picksCreated++
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(`  Missing places created: ${Object.keys(createdPlaceIds).length}`)
  console.log(`  Routes created: ${ROUTES.length} (1 pending)`)
  console.log(`  Golden picks created: ${picksCreated}`)
  console.log('  Cities: Lisboa, Porto, Madeira, Algarve')
  console.log('═══════════════════════════════════════════════════════════')

  await db.end()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
