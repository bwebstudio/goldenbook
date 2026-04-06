// ─── Auto-classify a single place ─────────────────────────────────────────
// Called after create/update to generate classification_auto,
// context_windows_auto, context_tags_auto, moment_tags_auto.
// Lightweight version of the batch context-engine script.

import { db } from '../../../db/postgres'

// ─── Classification map ─────────────────────────────────────────────────

const PLACE_TYPE_CLASSIFICATION: Record<string, { category: string; subcategory: string }> = {
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
}

// ─── Default windows by type ────────────────────────────────────────────

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
}

// ─── Context windows from opening hours ─────────────────────────────────

const WINDOWS = [
  { name: 'manhã',     start: 6,  end: 11 },
  { name: 'almoço',    start: 11, end: 15 },
  { name: 'tarde',     start: 15, end: 18 },
  { name: 'noite',     start: 18, end: 22 },
  { name: 'madrugada', start: 22, end: 6 },
]

function hoursToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function windowsFromHours(hours: { opens_at: string | null; closes_at: string | null; is_closed: boolean }[]): string[] {
  const open = hours.filter(h => !h.is_closed && h.opens_at && h.closes_at)
  if (open.length === 0) return []
  const result = new Set<string>()
  for (const slot of open) {
    const o = hoursToMin(slot.opens_at!)
    const c = hoursToMin(slot.closes_at!)
    for (const w of WINDOWS) {
      const ws = w.start * 60, we = w.end * 60
      if (w.name === 'madrugada') {
        if (c > ws || o < we || c < o) result.add(w.name)
      } else {
        if (o < we && c > ws) result.add(w.name)
        if (c < o && o < we) result.add(w.name)
      }
    }
  }
  const order = ['manhã', 'almoço', 'tarde', 'noite', 'madrugada']
  return [...result].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

// ─── Context tags ───────────────────────────────────────────────────────

const CANONICAL_TAGS = new Set([
  'brunch', 'celebration', 'cocktails', 'coffee', 'culture', 'dinner',
  'family', 'fine-dining', 'late-night', 'live-music', 'local-secret',
  'lunch', 'quick-stop', 'rainy-day', 'romantic', 'rooftop', 'shopping',
  'sunday', 'sunset', 'terrace', 'viewpoint', 'wellness', 'wine',
])

const BASE_TAGS: Record<string, string[]> = {
  restaurant: [], cafe: ['coffee'], bar: ['cocktails'],
  hotel: ['wellness'], shop: ['shopping'], museum: ['culture', 'rainy-day'],
  landmark: ['culture', 'viewpoint', 'family'], beach: ['sunset', 'family'],
}

const EXCLUDED: Record<string, string[]> = {
  museum: ['lunch', 'dinner', 'fine-dining', 'cocktails', 'wine', 'brunch', 'coffee'],
  landmark: ['lunch', 'dinner', 'fine-dining', 'cocktails', 'wine', 'brunch', 'coffee'],
  shop: ['lunch', 'dinner', 'fine-dining', 'cocktails', 'wine', 'brunch', 'late-night'],
  beach: ['fine-dining', 'cocktails', 'rainy-day', 'rooftop', 'late-night'],
  transport: ['lunch', 'dinner', 'fine-dining', 'cocktails', 'wine', 'brunch', 'coffee', 'romantic', 'celebration', 'terrace', 'rooftop', 'viewpoint', 'sunset', 'late-night', 'live-music', 'local-secret', 'wellness', 'family'],
}

function generateContextTags(type: string, priceTier: number | null, cuisines: string[] | null, windows: string[], googleRating: number | null, name: string): string[] {
  const tags = new Set(BASE_TAGS[type] ?? [])
  const isFD = ['restaurant', 'cafe', 'bar'].includes(type)

  if (priceTier && isFD) {
    if (priceTier === 4) { tags.add('romantic'); tags.add('celebration'); tags.add('fine-dining') }
    else if (priceTier === 3) { tags.add('romantic'); tags.add('wine') }
    else if (priceTier === 1) tags.add('quick-stop')
  }
  if (priceTier && type === 'hotel' && priceTier >= 3) { tags.add('romantic'); tags.add('celebration') }

  if (isFD && cuisines?.includes('fine-dining')) { tags.add('fine-dining'); tags.add('romantic'); tags.add('celebration') }
  if (isFD && cuisines?.includes('brunch')) tags.add('brunch')

  if (isFD) {
    if (windows.includes('almoço')) tags.add('lunch')
    if (windows.includes('noite') || windows.includes('madrugada')) tags.add('dinner')
    if (windows.includes('manhã') && type === 'cafe') tags.add('brunch')
  }
  if (windows.includes('madrugada') && ['bar', 'venue'].includes(type)) tags.add('late-night')
  if (type === 'bar') tags.add('wine')
  if (googleRating != null && googleRating >= 4.5) tags.add('local-secret')

  const searchText = name.toLowerCase()
  if (['terrace', 'terraço', 'esplanada'].some(k => searchText.includes(k))) tags.add('terrace')
  if (['rooftop', 'roof'].some(k => searchText.includes(k))) tags.add('rooftop')
  if (['viewpoint', 'miradouro', 'vista'].some(k => searchText.includes(k))) tags.add('viewpoint')

  const excl = new Set(EXCLUDED[type] ?? [])
  for (const t of excl) tags.delete(t)
  return [...tags].filter(t => CANONICAL_TAGS.has(t)).sort()
}

// ─── Moment tags ────────────────────────────────────────────────────────

function generateMomentTags(type: string, category: string, subcategory: string, windows: string[], contextTags: string[], priceTier: number | null, cuisines: string[] | null, googleRating: number | null): string[] {
  const tags = new Set<string>()
  const has = (w: string) => windows.includes(w)

  if (has('manhã')) {
    if (['cafe', 'restaurant'].includes(type)) { tags.add('breakfast'); tags.add('coffee') }
    if (type === 'cafe') tags.add('brunch')
    if (['museum', 'landmark', 'activity'].includes(type)) tags.add('morning-visit')
  }
  if (has('almoço')) {
    if (['restaurant', 'cafe'].includes(type)) tags.add('lunch')
    if (type === 'restaurant' && priceTier && priceTier >= 3) tags.add('business-lunch')
  }
  if (has('tarde')) {
    if (type === 'cafe') { tags.add('afternoon-coffee'); tags.add('coffee') }
    if (['beach', 'landmark'].includes(type)) tags.add('sunset')
    if (['museum', 'landmark'].includes(type)) tags.add('afternoon-visit')
    if (type === 'shop') tags.add('afternoon-shopping')
  }
  if (has('noite')) {
    if (type === 'restaurant') tags.add('dinner')
    if (type === 'restaurant' && priceTier && priceTier >= 3) tags.add('romantic-dinner')
    if (type === 'bar') { tags.add('drinks'); tags.add('evening-out') }
    if (['landmark', 'beach'].includes(type)) tags.add('sunset')
  }
  if (has('madrugada')) {
    if (['bar', 'venue'].includes(type)) { tags.add('late-night'); tags.add('nightlife') }
    if (type === 'restaurant') tags.add('late-dinner')
  }

  if (category === 'culture') { tags.add('culture'); tags.add('rainy-day'); tags.add('family') }
  if (subcategory === 'museus' || subcategory === 'galerias') tags.add('indoor')
  if (category === 'natureza-outdoor') { tags.add('outdoor') }
  if (subcategory === 'praias') { tags.add('beach-day'); tags.add('family') }
  if (subcategory === 'miradouros') { tags.add('viewpoint'); tags.add('sunset') }
  if (category === 'retail') tags.add('shopping')
  if (subcategory === 'mercados') tags.add('local-experience')
  if (category === 'alojamento') tags.add('stay')
  if (subcategory === 'bem-estar') { tags.add('wellness'); tags.add('relax') }
  if (subcategory === 'vida-noturna') { tags.add('nightlife'); tags.add('drinks') }

  if (priceTier === 4) {
    tags.add('special-occasion')
    if (['restaurant', 'hotel'].includes(type)) { tags.add('romantic'); tags.add('celebration') }
  }
  if (priceTier === 1) { tags.add('budget-friendly') }
  if (cuisines?.includes('fine-dining')) { tags.add('fine-dining'); tags.add('romantic-dinner') }
  if (cuisines?.includes('seafood')) tags.add('seafood')
  if (cuisines?.includes('portuguese')) tags.add('local-cuisine')
  if (contextTags.includes('terrace')) tags.add('terrace')
  if (contextTags.includes('rooftop')) tags.add('rooftop')
  if (contextTags.includes('viewpoint')) tags.add('viewpoint')
  if (googleRating != null && googleRating >= 4.5) tags.add('hidden-gem')

  return [...tags].sort()
}

// ─── Main function ──────────────────────────────────────────────────────

export async function autoClassifyPlace(placeId: string): Promise<void> {
  try {
    const { rows } = await db.query<{
      place_type: string; price_tier: number | null; cuisine_types: string[] | null; google_rating: number | null; name: string
    }>(`SELECT place_type, price_tier, cuisine_types, google_rating::float, name FROM places WHERE id = $1`, [placeId])
    if (!rows[0]) return
    const { place_type, price_tier, cuisine_types, google_rating, name } = rows[0]

    // Classification
    const cls = PLACE_TYPE_CLASSIFICATION[place_type]
    const classification = cls ? { type: place_type, ...cls } : null

    // Windows from opening hours (or defaults)
    const { rows: hours } = await db.query<{ opens_at: string | null; closes_at: string | null; is_closed: boolean }>(
      `SELECT opens_at::text, closes_at::text, is_closed FROM opening_hours WHERE place_id = $1`, [placeId])
    let windows = windowsFromHours(hours)
    if (windows.length === 0) windows = DEFAULT_WINDOWS[place_type] ?? []

    // Tags
    const contextTags = generateContextTags(place_type, price_tier, cuisine_types, windows, google_rating, name)
    const momentTags = generateMomentTags(
      place_type, classification?.category ?? '', classification?.subcategory ?? '',
      windows, contextTags, price_tier, cuisine_types, google_rating)

    await db.query(`
      UPDATE places SET
        classification_auto = $2,
        context_windows_auto = $3,
        context_tags_auto = $4,
        moment_tags_auto = $5,
        updated_at = now()
      WHERE id = $1
    `, [
      placeId,
      classification ? JSON.stringify(classification) : null,
      windows.length > 0 ? JSON.stringify(windows) : null,
      contextTags.length > 0 ? JSON.stringify(contextTags) : null,
      momentTags.length > 0 ? JSON.stringify(momentTags) : null,
    ])
  } catch (err) {
    // Non-blocking — don't fail the save
    console.error('[auto-classify] Failed for place', placeId, err)
  }
}
