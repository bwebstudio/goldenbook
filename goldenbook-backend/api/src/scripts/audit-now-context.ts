#!/usr/bin/env tsx
// ─── NOW + Concierge Stabilization Audit ─────────────────────────────────
//
// Reads `docs/places-export.json`, audits every place against the canonical
// 24-tag context system, infers missing tags from category/subcategory,
// computes deterministic time-of-day eligibility, and produces:
//
//   docs/audit-report.json   — diagnostic + per-place plan + coverage
//   docs/audit-fixes.sql     — idempotent SQL patch (additive tags + replace
//                              time windows). Safe to re-run.
//
// This script does NOT touch the database. It only reads the export and
// writes files. Apply the SQL patch manually after review.
//
// Usage:
//   npx tsx api/src/scripts/audit-now-context.ts

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// ─── Canonical tag system (24 tags) ───────────────────────────────────────

const CANONICAL_TAGS = [
  'brunch', 'celebration', 'cocktails', 'coffee', 'culture', 'dinner',
  'family', 'fine-dining', 'late-night', 'live-music', 'local-secret',
  'lunch', 'nature', 'quick-stop', 'rainy-day', 'romantic', 'rooftop',
  'shopping', 'sunday', 'sunset', 'terrace', 'viewpoint', 'wellness', 'wine',
] as const
type Tag = (typeof CANONICAL_TAGS)[number]
const CANONICAL_SET = new Set<Tag>(CANONICAL_TAGS)

// ─── Time-of-day windows ──────────────────────────────────────────────────

const WINDOWS = ['morning', 'midday', 'afternoon', 'evening', 'late_evening', 'deep_night'] as const
type Window = (typeof WINDOWS)[number]

interface WindowRule {
  /** Tag is allowed in this window */
  allowed: Set<Tag>
  /** Tag, if present, FORBIDS the place from this window */
  excluded: Set<Tag>
}

const WINDOW_RULES: Record<Window, WindowRule> = {
  morning: {
    allowed: new Set(['coffee', 'brunch', 'culture', 'viewpoint', 'nature', 'quick-stop', 'wellness']),
    excluded: new Set(['dinner', 'cocktails', 'late-night']),
  },
  midday: {
    allowed: new Set(['lunch', 'brunch', 'culture', 'shopping', 'viewpoint', 'nature', 'quick-stop']),
    excluded: new Set(['late-night']),
  },
  afternoon: {
    // Restaurants (dinner-only) handled with the special rule below
    allowed: new Set(['culture', 'shopping', 'coffee', 'viewpoint', 'nature', 'terrace', 'sunset', 'wine']),
    excluded: new Set(['late-night']),
  },
  evening: {
    allowed: new Set(['dinner', 'fine-dining', 'cocktails', 'wine', 'rooftop', 'sunset', 'romantic']),
    excluded: new Set(['shopping', 'culture', 'coffee', 'brunch']),
  },
  late_evening: {
    allowed: new Set(['cocktails', 'wine', 'late-night', 'live-music', 'rooftop']),
    excluded: new Set(['brunch', 'coffee', 'shopping', 'culture']),
  },
  deep_night: {
    allowed: new Set(['late-night', 'cocktails', 'wine', 'viewpoint']),
    excluded: new Set(['brunch', 'coffee', 'shopping', 'culture', 'dinner', 'lunch']),
  },
}

// ─── Place model ──────────────────────────────────────────────────────────

interface ExportPlace {
  slug: string
  name: string
  status: string
  city: string
  categories: string[]
  subcategories: string[]
  tags: string[]
}

interface AnalyzedPlace {
  slug: string
  name: string
  city_slug: string
  current_tags: Tag[]
  /** Tags inferred from category/subcategory */
  inferred_tags: Tag[]
  /** Final tag set after merge + cap */
  final_tags: Tag[]
  /** Tag changes vs current */
  added_tags: Tag[]
  /** Tags that fell outside the canonical 24 (will be removed) */
  invalid_tags: string[]
  /** Whether this place is a restaurant (gastronomy/restaurantes etc.) */
  is_restaurant: boolean
  /** Whether this is a gastronomic venue (restaurant or bar or cafe) */
  is_gastronomic: boolean
  /** Computed time windows from final tag set */
  windows: Window[]
  /** Diagnostic issues */
  issues: string[]
  /** Whether this place changed at all (tags or windows) */
  needs_update: boolean
}

// ─── Subcategory → tag inference ──────────────────────────────────────────
//
// Subcategory wins over category because the taxonomy puts e.g. `bares` under
// multiple parent categories (gastronomy, retail, experiences). Returns a
// list of CANDIDATE tags — final selection is capped to 4 by `mergeTags`.

function inferFromSubcategories(subs: string[], cats: string[]): Tag[] {
  const tags: Tag[] = []

  // ── Gastronomy / drink ────────────────────────────────────────────────
  if (subs.includes('restaurantes') || subs.includes('comida-tipica')) {
    // Default restaurants to BOTH lunch and dinner — covers most real-world
    // restaurants and makes them eligible for midday + evening + afternoon.
    tags.push('lunch', 'dinner')
  }
  if (subs.includes('bares') || subs.includes('vida-noturna')) {
    tags.push('cocktails', 'wine')
    if (subs.includes('vida-noturna')) tags.push('late-night')
  }
  if (subs.includes('cafes')) {
    tags.push('coffee', 'brunch')
  }
  if (subs.includes('adegas')) {
    tags.push('wine', 'local-secret')  // wineries are usually off-the-beaten-path
  }

  // ── Nature / outdoor ──────────────────────────────────────────────────
  if (subs.includes('miradouros')) {
    tags.push('viewpoint', 'nature', 'sunset')
  }
  if (subs.includes('praias')) {
    tags.push('nature', 'sunset')
  }
  if (subs.includes('jardins') || subs.includes('parques')) {
    tags.push('nature', 'family')
  }
  if (subs.includes('cascatas')) {
    tags.push('nature', 'viewpoint')
  }

  // ── Culture ───────────────────────────────────────────────────────────
  if (
    subs.includes('museus') ||
    subs.includes('galerias') ||
    subs.includes('monumentos') ||
    subs.includes('sitios-historicos')
  ) {
    tags.push('culture')
    if (subs.includes('museus') || subs.includes('galerias')) {
      tags.push('rainy-day')  // indoor — perfect bad-weather plan
    } else {
      // monuments / historic sites are often outdoor
      tags.push('local-secret')
    }
  }
  if (subs.includes('eventos')) {
    tags.push('culture', 'celebration')
  }

  // ── Retail / shops ────────────────────────────────────────────────────
  if (
    subs.includes('lojas-locais') ||
    subs.includes('lojas-tradicionais') ||
    subs.includes('moda') ||
    subs.includes('joalharia') ||
    subs.includes('relojoaria') ||
    subs.includes('decoracao') ||
    subs.includes('lembracas')
  ) {
    tags.push('shopping', 'quick-stop')  // always two tags — quick-stop is the
                                          // safe second default for any retail
    if (subs.includes('lojas-tradicionais') || subs.includes('lembracas')) {
      tags.push('local-secret')
    }
  }
  if (subs.includes('centros-comerciais')) {
    tags.push('shopping', 'family')
  }

  // ── Accommodation ─────────────────────────────────────────────────────
  if (subs.includes('hoteis')) {
    tags.push('wellness', 'romantic')
  }

  // ── Experiences ───────────────────────────────────────────────────────
  if (subs.includes('experiencias-unicas')) {
    tags.push('local-secret')
  }
  if (subs.includes('desporto')) {
    tags.push('wellness', 'family')
  }

  // ── Category-level fallbacks (if no subcategory matched) ──────────────
  if (tags.length === 0) {
    if (cats.includes('natureza-outdoor')) tags.push('nature', 'viewpoint')
    if (cats.includes('culture')) tags.push('culture')
    if (cats.includes('gastronomy')) tags.push('lunch', 'dinner')
    if (cats.includes('retail')) tags.push('shopping')
    if (cats.includes('alojamento')) tags.push('wellness', 'romantic')
    if (cats.includes('experiences')) tags.push('local-secret')
  }

  return [...new Set(tags)]
}

/**
 * Last-resort tag assignment when subcategory + category inference left a
 * place with no time-eligible tags. Uses name keywords and category fallbacks
 * to ensure every place ends up with at least one tag from the eligibility
 * allowlists, otherwise NOW will never surface it.
 */
function applyNameAndCategoryFallbacks(name: string, cats: string[], existing: Tag[]): Tag[] {
  const lower = name.toLowerCase()
  const additions: Tag[] = []

  // Wellness / spa
  if (/\b(spa|wellness|massage|massagem|sauna|hammam|thermal|term[ae])\b/i.test(lower)) {
    additions.push('wellness')
  }
  // Tours / experiences with name signal
  if (/\b(tour|tours|excursion|experience|food on foot|walking tour)\b/i.test(lower)) {
    additions.push('culture')
  }
  // Beach club / waterfront swimming areas (Funchal "Frente Mar")
  if (/\b(frente mar|beach club|lido|piscinas|swimming|natural pool|barreirinha|doca)\b/i.test(lower)) {
    additions.push('nature')
  }
  // Adventure / sport / radical
  if (/\b(radical|adventure|kayak|surf|diving|hike|hiking|trekking|jeep|safari|line|cruise|ferry|boat|charter|sailing|catamaran)\b/i.test(lower)) {
    additions.push('nature')
  }
  // Wine / vineyards
  if (/\b(wine|vinho|vineyard|adega|cellar|enoteca|quinta)\b/i.test(lower)) {
    additions.push('wine')
  }
  // Farm / countryside
  if (/\b(farm|quinta|country|rural|fazenda)\b/i.test(lower)) {
    additions.push('nature')
  }

  // Filter to brand new tags only
  const merged = [...new Set([...existing, ...additions])]

  // Final guarantee: if STILL no time-eligible tag, force a sensible default
  // based on category so the place is at least surfaceable.
  const hasTimeEligibleTag = merged.some((t) =>
    [
      'coffee', 'brunch', 'lunch', 'dinner', 'fine-dining',
      'cocktails', 'wine', 'late-night', 'live-music', 'romantic', 'rooftop',
      'culture', 'shopping', 'wellness', 'nature', 'viewpoint', 'sunset',
      'terrace', 'quick-stop',
    ].includes(t),
  )
  if (!hasTimeEligibleTag) {
    if (cats.includes('experiences')) merged.push('culture', 'family')
    else if (cats.includes('alojamento')) merged.push('wellness')
    else merged.push('culture')
  }

  return merged
}

// ─── Tag merging + capping ────────────────────────────────────────────────

/**
 * Merge current tags with inferred tags, drop non-canonical ones, and trim
 * to a target size. Existing canonical tags are preserved (they reflect
 * editorial intent); inferred tags fill the gaps.
 */
function mergeTags(currentRaw: string[], inferred: Tag[], maxTags = 4): {
  final: Tag[]
  invalid: string[]
} {
  const invalid: string[] = []
  const validCurrent: Tag[] = []
  for (const t of currentRaw) {
    if (CANONICAL_SET.has(t as Tag)) {
      validCurrent.push(t as Tag)
    } else {
      invalid.push(t)
    }
  }

  // Preserve existing canonical tags first, then add inferred ones up to cap
  const result: Tag[] = []
  for (const t of validCurrent) {
    if (!result.includes(t)) result.push(t)
  }
  for (const t of inferred) {
    if (result.length >= maxTags) break
    if (!result.includes(t)) result.push(t)
  }

  // Hard floor: minimum 2 tags. If still short, add safe generic defaults
  // based on the dominant tag so the place stays NOW-eligible.
  const SAFE_PAIRINGS: Partial<Record<Tag, Tag>> = {
    'shopping':  'quick-stop',
    'culture':   'local-secret',
    'wine':      'local-secret',
    'wellness':  'local-secret',
    'coffee':    'quick-stop',
    'brunch':    'coffee',
    'lunch':     'quick-stop',
    'dinner':    'romantic',
    'viewpoint': 'nature',
    'nature':    'viewpoint',
  }
  if (result.length === 1) {
    const fallback = SAFE_PAIRINGS[result[0]]
    if (fallback && !result.includes(fallback)) result.push(fallback)
  }
  if (result.length === 0) {
    result.push('local-secret', 'culture')
  }

  return { final: result, invalid }
}

// ─── Eligibility computation ──────────────────────────────────────────────

function computeWindows(tags: Tag[], isRestaurant: boolean): Window[] {
  const tagSet = new Set(tags)
  const result: Window[] = []

  for (const win of WINDOWS) {
    const rule = WINDOW_RULES[win]

    // Hard exclude: if any tag in `excluded`, the place is forbidden here
    let forbidden = false
    for (const t of tags) {
      if (rule.excluded.has(t)) { forbidden = true; break }
    }
    if (forbidden) continue

    // Restaurant special-case for AFTERNOON: must have lunch or brunch.
    // A dinner-only restaurant is excluded from afternoon.
    if (win === 'afternoon' && isRestaurant) {
      if (!tagSet.has('lunch') && !tagSet.has('brunch')) continue
    }

    // Allow: at least one tag must be in the allowed set
    let allowed = false
    for (const t of tags) {
      if (rule.allowed.has(t)) { allowed = true; break }
    }
    if (allowed) result.push(win)
  }

  return result
}

// ─── Per-place analysis ───────────────────────────────────────────────────

function analyzePlace(p: ExportPlace, citySlug: string): AnalyzedPlace {
  const subs = p.subcategories
  const cats = p.categories
  let inferred = inferFromSubcategories(subs, cats)
  // Name-based corrections for taxonomy mismatches: data classifies many cafés
  // and bars under `gastronomy/restaurantes`, so the subcategory inference
  // gives them lunch+dinner. We override based on name signal.
  const lower = p.name.toLowerCase()
  const looksLikeCafe = /caf[eé]\b|coffee|espresso|brunch spot|tea ?room/i.test(lower)
  const looksLikeBar = /\bbar\b|cocktail|gin\b|whisk|rum bar|speakeasy|lounge\b|gastro ?bar|vermut/i.test(lower)
  // If the name ALSO contains "restaurant/restaurante/dining", it's a dual-
  // purpose venue: keep the meal tag and just ADD bar/café tags.
  const isDualPurposeRestaurant = /restaurant|restaurante|dining/i.test(lower)

  if (looksLikeCafe && (inferred.includes('lunch') || inferred.includes('dinner'))) {
    if (!isDualPurposeRestaurant) {
      inferred = inferred.filter((t) => t !== 'lunch' && t !== 'dinner')
    }
    if (!inferred.includes('coffee')) inferred.push('coffee')
    if (!inferred.includes('brunch')) inferred.push('brunch')
  } else if (looksLikeBar && (inferred.includes('lunch') || inferred.includes('dinner'))) {
    if (!isDualPurposeRestaurant) {
      inferred = inferred.filter((t) => t !== 'lunch' && t !== 'dinner')
    }
    if (!inferred.includes('cocktails')) inferred.push('cocktails')
    if (!inferred.includes('wine')) inferred.push('wine')
  }
  // Hotels with bar subcategory: ensure the hotel character is preserved.
  // The subcategory chain prioritises bars, so a hotel-bar otherwise loses
  // its `wellness` / `romantic` profile.
  const looksLikeHotel = /\bhotel\b|\bresort\b|\bpalace\b|pousada|guest ?house\b/i.test(lower)
  const isRestaurantNamed = /restaurant|restaurante/i.test(lower)
  if (looksLikeHotel && !isRestaurantNamed) {
    if (!inferred.includes('wellness')) inferred.push('wellness')
    if (!inferred.includes('romantic')) inferred.push('romantic')
  }
  // Apply name + category fallbacks before merging
  inferred = applyNameAndCategoryFallbacks(p.name, cats, inferred)
  const { final, invalid } = mergeTags(p.tags, inferred, 4)

  const isRestaurant = subs.includes('restaurantes') || subs.includes('comida-tipica')
  const isBar = subs.includes('bares') || subs.includes('vida-noturna')
  const isCafe = subs.includes('cafes')
  const isGastronomic = isRestaurant || isBar || isCafe

  const windows = computeWindows(final, isRestaurant)

  // ── Diagnostic issues ────────────────────────────────────────────────
  const issues: string[] = []
  if (p.tags.length === 0) issues.push('NO_TAGS')
  if (p.tags.length === 1) issues.push('ONLY_ONE_TAG')
  if (invalid.length > 0) issues.push(`INVALID_TAGS:${invalid.join(',')}`)
  if (final.length < 2) issues.push('FINAL_LESS_THAN_2')
  if (windows.length === 0) issues.push('NO_TIME_WINDOWS')

  // Restaurant without lunch/dinner/fine-dining/brunch
  if (isRestaurant) {
    const hasMeal = ['lunch', 'dinner', 'fine-dining', 'brunch'].some(t => final.includes(t as Tag))
    if (!hasMeal) issues.push('RESTAURANT_NO_MEAL_TAG')
  }

  // Shop without shopping tag
  if (
    (subs.includes('lojas-locais') ||
      subs.includes('lojas-tradicionais') ||
      subs.includes('moda') ||
      subs.includes('joalharia')) &&
    !final.includes('shopping')
  ) {
    issues.push('SHOP_NO_SHOPPING_TAG')
  }

  // Viewpoint without viewpoint tag
  if (subs.includes('miradouros') && !final.includes('viewpoint')) {
    issues.push('VIEWPOINT_NO_VIEWPOINT_TAG')
  }

  // Tag changes vs current
  const currentValid = new Set<Tag>(p.tags.filter((t) => CANONICAL_SET.has(t as Tag)) as Tag[])
  const added = final.filter((t) => !currentValid.has(t))

  const needsUpdate =
    added.length > 0 ||
    invalid.length > 0 ||
    windows.length > 0 // we always replace windows from the deterministic computation

  return {
    slug: p.slug,
    name: p.name,
    city_slug: citySlug,
    current_tags: p.tags as Tag[],
    inferred_tags: inferred,
    final_tags: final,
    added_tags: added,
    invalid_tags: invalid,
    is_restaurant: isRestaurant,
    is_gastronomic: isGastronomic,
    windows,
    issues,
    needs_update: needsUpdate,
  }
}

// ─── SQL patch generation ─────────────────────────────────────────────────

function escapeSql(s: string): string {
  return s.replace(/'/g, "''")
}

function generateSqlPatch(places: AnalyzedPlace[]): string {
  const lines: string[] = []
  lines.push('-- ════════════════════════════════════════════════════════════')
  lines.push('-- NOW + Concierge Stabilization SQL Patch')
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push(`-- Places analyzed: ${places.length}`)
  lines.push(`-- Places needing update: ${places.filter((p) => p.needs_update).length}`)
  lines.push('--')
  lines.push('-- Idempotent: safe to re-run. Tags are additive, time windows')
  lines.push('-- are deterministically replaced from the final tag set.')
  lines.push('-- ════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push('BEGIN;')
  lines.push('')

  // Step 1: ensure `nature` tag exists
  lines.push('-- ─── Step 1: Ensure canonical 24th tag exists ─────────────────')
  lines.push(`INSERT INTO now_context_tags (slug, name, description)`)
  lines.push(`VALUES ('nature', 'Nature', 'Outdoor / scenic / nature places — viewpoints, gardens, beaches, parks')`)
  lines.push(`ON CONFLICT (slug) DO NOTHING;`)
  lines.push('')

  // Step 2: per-place tag + window updates
  lines.push('-- ─── Step 2: Per-place tag additions + window replacement ────')
  lines.push('-- Tags: ADDITIVE only (we never delete editorial tags). Invalid')
  lines.push('-- tags outside the canonical 24 are removed below.')
  lines.push('-- Windows: REPLACED from the deterministic eligibility matrix.')
  lines.push('')

  let updateCount = 0
  for (const p of places) {
    if (!p.needs_update) continue
    updateCount++

    lines.push(`-- ${p.name}  [${p.city_slug}]`)
    lines.push(`-- current: [${p.current_tags.join(', ') || '∅'}]  →  final: [${p.final_tags.join(', ')}]`)
    if (p.issues.length) lines.push(`-- issues: ${p.issues.join('; ')}`)

    // 2a. Add new tags (idempotent via ON CONFLICT)
    if (p.added_tags.length > 0) {
      const slugList = p.added_tags.map((t) => `'${t}'`).join(', ')
      lines.push(`INSERT INTO place_now_tags (place_id, tag_id)`)
      lines.push(`SELECT p.id, t.id`)
      lines.push(`FROM places p, now_context_tags t`)
      lines.push(`WHERE p.slug = '${escapeSql(p.slug)}'`)
      lines.push(`  AND t.slug = ANY(ARRAY[${slugList}])`)
      lines.push(`ON CONFLICT (place_id, tag_id) DO NOTHING;`)
    }

    // 2b. Remove invalid (non-canonical) tags
    if (p.invalid_tags.length > 0) {
      const badList = p.invalid_tags.map((t) => `'${escapeSql(t)}'`).join(', ')
      lines.push(`DELETE FROM place_now_tags pnt`)
      lines.push(`USING places p, now_context_tags t`)
      lines.push(`WHERE pnt.place_id = p.id`)
      lines.push(`  AND pnt.tag_id   = t.id`)
      lines.push(`  AND p.slug       = '${escapeSql(p.slug)}'`)
      lines.push(`  AND t.slug       = ANY(ARRAY[${badList}]);`)
    }

    // 2c. Replace time windows (deterministic from final tags)
    lines.push(`DELETE FROM place_now_time_windows`)
    lines.push(`WHERE place_id = (SELECT id FROM places WHERE slug = '${escapeSql(p.slug)}');`)
    if (p.windows.length > 0) {
      const winList = p.windows.map((w) => `'${w}'`).join(', ')
      lines.push(`INSERT INTO place_now_time_windows (place_id, time_window)`)
      lines.push(`SELECT id, unnest(ARRAY[${winList}])`)
      lines.push(`FROM places WHERE slug = '${escapeSql(p.slug)}';`)
    }

    lines.push('')
  }

  lines.push('-- ════════════════════════════════════════════════════════════')
  lines.push(`-- Total UPDATEs in this patch: ${updateCount}`)
  lines.push('-- ════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push('COMMIT;')
  return lines.join('\n')
}

// ─── Coverage check per city ──────────────────────────────────────────────

const MIN_COVERAGE: Record<Window, number> = {
  morning: 3,
  midday: 4,
  afternoon: 4,
  evening: 5,
  late_evening: 3,
  deep_night: 1,
}

interface CoverageReport {
  city: string
  totals: Record<Window, number>
  gaps: { window: Window; have: number; need: number }[]
}

function buildCoverage(places: AnalyzedPlace[]): CoverageReport[] {
  const byCity = new Map<string, AnalyzedPlace[]>()
  for (const p of places) {
    if (!byCity.has(p.city_slug)) byCity.set(p.city_slug, [])
    byCity.get(p.city_slug)!.push(p)
  }
  const reports: CoverageReport[] = []
  for (const [city, items] of [...byCity.entries()].sort()) {
    const totals: Record<Window, number> = {
      morning: 0, midday: 0, afternoon: 0, evening: 0, late_evening: 0, deep_night: 0,
    }
    for (const p of items) {
      for (const w of p.windows) totals[w]++
    }
    const gaps: { window: Window; have: number; need: number }[] = []
    for (const w of WINDOWS) {
      if (totals[w] < MIN_COVERAGE[w]) {
        gaps.push({ window: w, have: totals[w], need: MIN_COVERAGE[w] })
      }
    }
    reports.push({ city, totals, gaps })
  }
  return reports
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  const exportPath = join(__dirname, '..', '..', '..', 'docs', 'places-export.json')
  const exported = JSON.parse(readFileSync(exportPath, 'utf8'))

  const all: AnalyzedPlace[] = []
  for (const [citySlug, cityGroup] of Object.entries(exported.by_city) as [string, any][]) {
    for (const p of cityGroup.places as ExportPlace[]) {
      // Skip non-published or non-recommendable place types
      if (p.status !== 'published') continue
      // Skip mobility (airport, rent-a-car) — not relevant for NOW
      if (p.categories.length === 1 && p.categories[0] === 'mobilidade') continue
      all.push(analyzePlace(p, citySlug))
    }
  }

  // ── Diagnostic counts ──────────────────────────────────────────────
  const diag = {
    total_analyzed: all.length,
    no_tags: all.filter((p) => p.current_tags.length === 0).length,
    only_one_tag: all.filter((p) => p.current_tags.length === 1).length,
    invalid_tags: all.filter((p) => p.invalid_tags.length > 0).length,
    restaurant_no_meal: all.filter((p) => p.issues.includes('RESTAURANT_NO_MEAL_TAG')).length,
    shop_no_shopping: all.filter((p) => p.issues.includes('SHOP_NO_SHOPPING_TAG')).length,
    viewpoint_no_viewpoint: all.filter((p) => p.issues.includes('VIEWPOINT_NO_VIEWPOINT_TAG')).length,
    no_time_windows_after_fix: all.filter((p) => p.windows.length === 0).length,
    needs_update: all.filter((p) => p.needs_update).length,
  }

  // ── Coverage ───────────────────────────────────────────────────────
  const coverage = buildCoverage(all)

  // ── Eligibility table (compact) ────────────────────────────────────
  const eligibility = all.map((p) => ({
    slug: p.slug,
    name: p.name,
    city: p.city_slug,
    final_tags: p.final_tags,
    windows: p.windows,
  }))

  // ── Write outputs ──────────────────────────────────────────────────
  const docsDir = join(__dirname, '..', '..', '..', 'docs')
  const reportPath = join(docsDir, 'audit-report.json')
  const sqlPath = join(docsDir, 'audit-fixes.sql')

  const report = {
    generated_at: new Date().toISOString(),
    canonical_tags: CANONICAL_TAGS,
    window_rules: Object.fromEntries(
      WINDOWS.map((w) => [w, {
        allowed: [...WINDOW_RULES[w].allowed],
        excluded: [...WINDOW_RULES[w].excluded],
      }]),
    ),
    diagnostics: diag,
    coverage,
    /** Per-place analysis with current/final tags + computed windows */
    places: all.map((p) => ({
      slug: p.slug,
      name: p.name,
      city: p.city_slug,
      current_tags: p.current_tags,
      inferred_tags: p.inferred_tags,
      final_tags: p.final_tags,
      added_tags: p.added_tags,
      invalid_tags: p.invalid_tags,
      windows: p.windows,
      issues: p.issues,
      needs_update: p.needs_update,
    })),
    eligibility_summary: eligibility,
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  writeFileSync(sqlPath, generateSqlPatch(all))

  // ── Console summary ────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  NOW + Concierge Stabilization Audit')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Total places analyzed: ${diag.total_analyzed}`)
  console.log('')
  console.log('  ── Diagnostics ──')
  console.log(`  Places with NO tags:           ${diag.no_tags}`)
  console.log(`  Places with only 1 tag:        ${diag.only_one_tag}`)
  console.log(`  Places with invalid tags:      ${diag.invalid_tags}`)
  console.log(`  Restaurants missing meal tag:  ${diag.restaurant_no_meal}`)
  console.log(`  Shops missing shopping tag:    ${diag.shop_no_shopping}`)
  console.log(`  Viewpoints missing viewpoint:  ${diag.viewpoint_no_viewpoint}`)
  console.log(`  No time windows after fix:     ${diag.no_time_windows_after_fix}`)
  console.log(`  Places needing UPDATE:         ${diag.needs_update}`)
  console.log('')
  console.log('  ── Per-city coverage (after fix) ──')
  console.log('  city          morn  mid  aft  eve  late  deep')
  for (const c of coverage) {
    const t = c.totals
    const row = `  ${c.city.padEnd(13)} ${String(t.morning).padStart(4)} ${String(t.midday).padStart(4)} ${String(t.afternoon).padStart(4)} ${String(t.evening).padStart(4)} ${String(t.late_evening).padStart(5)} ${String(t.deep_night).padStart(5)}`
    console.log(row)
    if (c.gaps.length) {
      console.log(`    GAPS: ${c.gaps.map((g) => `${g.window}=${g.have}/${g.need}`).join(', ')}`)
    }
  }
  console.log('')
  console.log(`  Wrote: ${reportPath}`)
  console.log(`  Wrote: ${sqlPath}`)
  console.log('═══════════════════════════════════════════════════════════')
}

main()
