/**
 * Database queries for the Goldenbook web homepage.
 * Ported from goldenbook-backend/api/src/modules/web/web.service.ts
 *
 * These run server-side only (Next.js Server Components / API Routes).
 */

import { query } from './db'
import { resolveImageUrl } from './storage'
import type {
  WebHomeDTO,
  WebPlaceDTO,
  WebExperienceNowSlotDTO,
  WebRouteDTO,
  WebCategoryDTO,
} from './types'

// ─── Row interfaces ──────────────────────────────────────────────────────────

interface GoldenPickRow {
  id: string
  slug: string
  name: string
  hero_bucket: string | null
  hero_path: string | null
  address_line: string | null
  category_name: string | null
  city_slug: string
}

interface WebNowCandidateRow {
  id: string
  slug: string
  name: string
  image_bucket: string | null
  image_path: string | null
  img_width: number | null
  img_height: number | null
  featured: boolean
  category_slugs: string[]
  short_description: string | null
  category_name: string | null
  category_icon_name: string | null
  city_slug: string
}

interface WebRouteRow {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_bucket: string | null
  hero_path: string | null
  places_count: number
  city_slug: string
}

interface CityHeaderRow {
  slug: string
  name: string
  country: string
  hero_bucket: string | null
  hero_path: string | null
}

interface DestinationRow {
  slug: string
  name: string
  hero_bucket: string | null
  hero_path: string | null
}

interface CategoryRow {
  id: string
  slug: string
  name: string
  icon_name: string | null
}

// ─── Shared hero image LATERAL fragment ──────────────────────────────────────

const HERO_IMAGE_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT ma.bucket, ma.path, ma.width AS img_width, ma.height AS img_height
    FROM   place_images pi
    JOIN   media_assets ma ON ma.id = pi.asset_id
    WHERE  pi.place_id = p.id
      AND  pi.image_role IN ('editorial', 'hero', 'cover')
    ORDER  BY
      CASE pi.image_role WHEN 'editorial' THEN 0 WHEN 'hero' THEN 1 ELSE 2 END ASC,
      CASE WHEN ma.width IS NOT NULL AND ma.height IS NOT NULL
                AND ma.width >= ma.height THEN 0 ELSE 1 END ASC,
      COALESCE(ma.width, 0) DESC,
      pi.is_primary DESC,
      pi.sort_order ASC
    LIMIT  1
  ) hero_img ON true
`

const HERO_IMAGE_LATERAL_SIMPLE = `
  LEFT JOIN LATERAL (
    SELECT ma.bucket, ma.path
    FROM   place_images pi
    JOIN   media_assets ma ON ma.id = pi.asset_id
    WHERE  pi.place_id = p.id
      AND  pi.image_role IN ('editorial', 'hero', 'cover')
    ORDER  BY
      CASE pi.image_role WHEN 'editorial' THEN 0 WHEN 'hero' THEN 1 ELSE 2 END ASC,
      CASE WHEN ma.width IS NOT NULL AND ma.height IS NOT NULL
                AND ma.width >= ma.height THEN 0 ELSE 1 END ASC,
      COALESCE(ma.width, 0) DESC,
      pi.is_primary DESC,
      pi.sort_order ASC
    LIMIT  1
  ) hero_img ON true
`

const FIRST_CATEGORY_LATERAL = (localeParam: string) => `
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(ct.name, ct_fb.name, c2.slug) AS cat_name,
      c2.icon_name AS cat_icon_name
    FROM   place_categories pc2
    JOIN   categories c2 ON c2.id = pc2.category_id AND c2.is_active = true
    LEFT JOIN category_translations ct
           ON ct.category_id = c2.id AND ct.locale = ${localeParam}
    LEFT JOIN category_translations ct_fb
           ON ct_fb.category_id = c2.id AND ct_fb.locale = 'en'
    WHERE  pc2.place_id = p.id
    ORDER  BY c2.sort_order ASC
    LIMIT  1
  ) first_cat ON true
`

// ─── City header ─────────────────────────────────────────────────────────────

async function getCityHeader(
  citySlug: string,
  locale: string,
): Promise<CityHeaderRow | null> {
  const rows = await query<CityHeaderRow>(
    `
    SELECT
      d.slug,
      COALESCE(NULLIF(dt.name,''), NULLIF(dt_lang.name,''), NULLIF(dt_fb.name,''), d.name) AS name,
      COALESCE(co.name, d.slug) AS country,
      ma.bucket AS hero_bucket,
      ma.path   AS hero_path
    FROM destinations d
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $2
    LEFT JOIN destination_translations dt_lang
           ON dt_lang.destination_id = d.id AND dt_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    LEFT JOIN countries co ON co.id = d.country_id
    LEFT JOIN media_assets ma ON ma.id = d.hero_image_asset_id
    WHERE d.slug = $1
      AND d.is_active = true
    LIMIT 1
    `,
    [citySlug, locale],
  )
  return rows[0] ?? null
}

// ─── Golden picks ────────────────────────────────────────────────────────────

async function getWebGoldenPicks(
  citySlug: string,
  locale: string,
  limit = 5,
): Promise<GoldenPickRow[]> {
  const rows = await query<GoldenPickRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(pt.name, pt_fb.name, p.name) AS name,
      hero_img.bucket AS hero_bucket,
      hero_img.path   AS hero_path,
      p.address_line,
      first_cat.cat_name AS category_name,
      d.slug AS city_slug
    FROM editorial_collections ec
    JOIN destinations d
           ON d.id = ec.destination_id AND d.slug = $1
    JOIN editorial_collection_items eci
           ON eci.collection_id = ec.id
    JOIN places p
           ON p.id = eci.place_id AND p.status = 'published'
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    ${HERO_IMAGE_LATERAL_SIMPLE}
    LEFT JOIN LATERAL (
      SELECT COALESCE(ct.name, ct_fb.name, c.slug) AS cat_name
      FROM   place_categories pc2
      JOIN   categories c ON c.id = pc2.category_id AND c.is_active = true
      LEFT JOIN category_translations ct
             ON ct.category_id = c.id AND ct.locale = $2
      LEFT JOIN category_translations ct_fb
             ON ct_fb.category_id = c.id AND ct_fb.locale = 'en'
      WHERE  pc2.place_id = p.id
      ORDER  BY c.sort_order ASC
      LIMIT  1
    ) first_cat ON true
    WHERE ec.collection_type = 'editors_picks'
      AND ec.is_active = true
      AND hero_img.bucket IS NOT NULL
    ORDER BY eci.sort_order ASC
    LIMIT $3
    `,
    [citySlug, locale, limit],
  )

  if (rows.length > 0) return rows

  // Fallback: one pick per category
  const fb = await query<GoldenPickRow>(
    `
    SELECT DISTINCT ON (first_cat.cat_sort)
      p.id,
      p.slug,
      COALESCE(pt.name, pt_fb.name, p.name) AS name,
      hero_img.bucket AS hero_bucket,
      hero_img.path   AS hero_path,
      p.address_line,
      first_cat.cat_name AS category_name,
      d.slug AS city_slug
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    ${HERO_IMAGE_LATERAL_SIMPLE}
    LEFT JOIN LATERAL (
      SELECT COALESCE(ct.name, ct_fb.name, c.slug) AS cat_name, c.sort_order AS cat_sort
      FROM   place_categories pc2
      JOIN   categories c ON c.id = pc2.category_id AND c.is_active = true
      LEFT JOIN category_translations ct
             ON ct.category_id = c.id AND ct.locale = $2
      LEFT JOIN category_translations ct_fb
             ON ct_fb.category_id = c.id AND ct_fb.locale = 'en'
      WHERE  pc2.place_id = p.id
      ORDER  BY c.sort_order ASC
      LIMIT  1
    ) first_cat ON true
    WHERE p.status = 'published'
      AND hero_img.bucket IS NOT NULL
    ORDER BY first_cat.cat_sort ASC, p.featured DESC, p.slug ASC
    LIMIT $3
    `,
    [citySlug, locale, limit],
  )

  return fb
}

// ─── Now candidates ──────────────────────────────────────────────────────────

async function getWebNowCandidates(
  citySlug: string,
  locale: string,
  limit = 24,
): Promise<WebNowCandidateRow[]> {
  const rows = await query<WebNowCandidateRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(pt.name, pt_fb.name, p.name) AS name,
      hero_img.bucket  AS image_bucket,
      hero_img.path    AS image_path,
      hero_img.img_width,
      hero_img.img_height,
      p.featured,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.slug), NULL) AS category_slugs,
      COALESCE(pt.short_description, pt_fb.short_description) AS short_description,
      first_cat.cat_name     AS category_name,
      first_cat.cat_icon_name AS category_icon_name,
      d.slug AS city_slug
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    ${HERO_IMAGE_LATERAL}
    ${FIRST_CATEGORY_LATERAL('$2')}
    LEFT JOIN place_categories pc ON pc.place_id = p.id
    LEFT JOIN categories c        ON c.id = pc.category_id AND c.is_active = true
    WHERE p.status = 'published'
      AND hero_img.bucket IS NOT NULL
      AND LOWER(COALESCE(pt.name, pt_fb.name, p.name)) NOT IN (
        'porto santa maria',
        '5 oceanos',
        'mar do inferno restaurante'
      )
    GROUP BY
      p.id, p.slug, p.name, p.featured, hero_img.bucket, hero_img.path,
      hero_img.img_width, hero_img.img_height,
      pt.name, pt_fb.name, pt.short_description, pt_fb.short_description,
      first_cat.cat_name, first_cat.cat_icon_name, d.slug
    ORDER BY p.featured DESC, p.created_at ASC
    LIMIT $3
    `,
    [citySlug, locale, limit],
  )
  return rows
}

// ─── Curated now-slots ───────────────────────────────────────────────────────

const SLOT_ORDER_MAP: Record<number, 'morning' | 'afternoon' | 'evening' | 'night'> = {
  0: 'morning',
  1: 'afternoon',
  2: 'evening',
  3: 'night',
}

async function getWebNowCuratedSlots(
  citySlug: string,
  locale: string,
): Promise<Partial<Record<'morning' | 'afternoon' | 'evening' | 'night', WebNowCandidateRow>>> {
  const rows = await query<WebNowCandidateRow & { slot_order: number }>(
    `
    SELECT
      eci.sort_order AS slot_order,
      p.id,
      p.slug,
      COALESCE(pt.name, pt_fb.name, p.name) AS name,
      hero_img.bucket  AS image_bucket,
      hero_img.path    AS image_path,
      hero_img.img_width,
      hero_img.img_height,
      p.featured,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.slug), NULL) AS category_slugs,
      COALESCE(pt.short_description, pt_fb.short_description) AS short_description,
      first_cat.cat_name     AS category_name,
      first_cat.cat_icon_name AS category_icon_name,
      d.slug AS city_slug
    FROM editorial_collections ec
    JOIN destinations d
           ON d.id = ec.destination_id AND d.slug = $1
    JOIN editorial_collection_items eci
           ON eci.collection_id = ec.id
    JOIN places p
           ON p.id = eci.place_id AND p.status = 'published'
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
    ${HERO_IMAGE_LATERAL}
    ${FIRST_CATEGORY_LATERAL('$2')}
    LEFT JOIN place_categories pc ON pc.place_id = p.id
    LEFT JOIN categories c        ON c.id = pc.category_id AND c.is_active = true
    WHERE ec.slug = $3
      AND ec.collection_type = 'custom'
      AND ec.is_active = true
      AND eci.sort_order BETWEEN 0 AND 3
      AND LOWER(COALESCE(pt.name, pt_fb.name, p.name)) NOT IN (
        'porto santa maria',
        '5 oceanos',
        'mar do inferno restaurante',
        'fundacao amalia rodrigues',
        'fundação amália rodrigues'
      )
    GROUP BY
      eci.sort_order, p.id, p.slug, p.name, p.featured,
      hero_img.bucket, hero_img.path, hero_img.img_width, hero_img.img_height,
      pt.name, pt_fb.name, pt.short_description, pt_fb.short_description,
      first_cat.cat_name, first_cat.cat_icon_name, d.slug
    ORDER BY eci.sort_order ASC
    `,
    [citySlug, locale, `${citySlug}-now-slots`],
  )

  const result: Partial<Record<'morning' | 'afternoon' | 'evening' | 'night', WebNowCandidateRow>> = {}
  for (const row of rows) {
    const slot = SLOT_ORDER_MAP[row.slot_order]
    if (slot) result[slot] = row
  }
  return result
}

// ─── Routes with city ────────────────────────────────────────────────────────

async function getGoldenRoutesWithCity(
  citySlug: string,
  locale: string,
  limit = 4,
): Promise<WebRouteRow[]> {
  return query<WebRouteRow>(
    `
    SELECT
      r.id,
      r.slug,
      COALESCE(rt.title, rt_fb.title, r.title)       AS title,
      COALESCE(rt.summary, rt_fb.summary, r.summary) AS summary,
      ma.bucket                                       AS hero_bucket,
      ma.path                                         AS hero_path,
      COUNT(rp.place_id)::int                         AS places_count,
      d.slug                                          AS city_slug
    FROM routes r
    JOIN destinations d ON d.id = r.destination_id AND d.slug = $1
    LEFT JOIN route_translations rt
           ON rt.route_id = r.id AND rt.locale = $2
    LEFT JOIN route_translations rt_fb
           ON rt_fb.route_id = r.id AND rt_fb.locale = 'en'
    LEFT JOIN media_assets ma ON ma.id = r.cover_asset_id
    LEFT JOIN route_places rp ON rp.route_id = r.id
    WHERE r.status = 'published'
    GROUP BY
      r.id, r.slug, r.title, r.summary, r.featured, r.published_at,
      rt.title, rt_fb.title, rt.summary, rt_fb.summary,
      ma.bucket, ma.path, d.slug
    ORDER BY r.featured DESC, r.published_at DESC NULLS LAST
    LIMIT $3
    `,
    [citySlug, locale, limit],
  )
}

// ─── Categories ──────────────────────────────────────────────────────────────

async function getDiscoverCategories(
  citySlug: string,
  locale: string,
): Promise<CategoryRow[]> {
  return query<CategoryRow>(
    `
    SELECT DISTINCT ON (c.sort_order, c.id)
      c.id,
      c.slug,
      COALESCE(NULLIF(ct.name,''), NULLIF(ct_lang.name,''), NULLIF(ct_fb.name,''), c.slug) AS name,
      c.icon_name
    FROM categories c
    JOIN place_categories pc ON pc.category_id = c.id
    JOIN places p            ON p.id = pc.place_id AND p.status = 'published'
    JOIN destinations d      ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN category_translations ct
           ON ct.category_id = c.id AND ct.locale = $2
    LEFT JOIN category_translations ct_lang
           ON ct_lang.category_id = c.id AND ct_lang.locale = split_part($2, '-', 1) AND $2 LIKE '%-%'
    LEFT JOIN category_translations ct_fb
           ON ct_fb.category_id = c.id AND ct_fb.locale = 'en'
    WHERE c.is_active = true
    ORDER BY c.sort_order ASC, c.id ASC
    `,
    [citySlug, locale],
  )
}

// ─── Destinations ────────────────────────────────────────────────────────────

async function getDestinations(locale: string): Promise<DestinationRow[]> {
  return query<DestinationRow>(
    `
    SELECT
      d.slug,
      COALESCE(dt.name, dt_fb.name, d.name) AS name,
      ma.bucket AS hero_bucket,
      ma.path   AS hero_path
    FROM destinations d
    LEFT JOIN destination_translations dt
           ON dt.destination_id = d.id AND dt.locale = $1
    LEFT JOIN destination_translations dt_fb
           ON dt_fb.destination_id = d.id AND dt_fb.locale = 'en'
    LEFT JOIN media_assets ma
           ON ma.id = d.hero_image_asset_id
    WHERE d.is_active = true
    ORDER BY d.sort_order ASC, d.created_at ASC
    `,
    [locale],
  )
}

// ─── DTO transformers ────────────────────────────────────────────────────────

function toWebPlace(row: GoldenPickRow): WebPlaceDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category_name,
    city: row.city_slug,
    address: row.address_line,
    imageUrl: resolveImageUrl({ bucket: row.hero_bucket, path: row.hero_path }),
  }
}

function toWebExperienceSlot(row: WebNowCandidateRow): WebExperienceNowSlotDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category_name,
    iconName: row.category_icon_name,
    city: row.city_slug,
    description: row.short_description,
    imageUrl: resolveImageUrl({ bucket: row.image_bucket, path: row.image_path }),
  }
}

function toWebRoute(r: WebRouteRow): WebRouteDTO {
  return {
    id: r.id,
    slug: r.slug,
    name: r.title,
    city: r.city_slug,
    summary: r.summary,
    stops: r.places_count,
    imageUrl: resolveImageUrl({ bucket: r.hero_bucket, path: r.hero_path }),
  }
}

// ─── Time segment scoring (fallback for missing curated slots) ───────────────

type TimeSegment = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

function getTimeSegment(hour: number): TimeSegment {
  if (hour >= 6 && hour <= 10) return 'morning'
  if (hour >= 11 && hour <= 14) return 'midday'
  if (hour >= 15 && hour <= 18) return 'afternoon'
  if (hour >= 19 && hour <= 21) return 'evening'
  return 'night'
}

const WEB_SEGMENT_CATEGORIES: Record<string, string[]> = {
  morning:   ['sports', 'activities', 'beaches', 'culture'],
  midday:    ['gastronomy', 'culture', 'activities', 'events'],
  afternoon: ['shops', 'gastronomy', 'culture', 'events'],
  evening:   ['gastronomy', 'events', 'activities', 'culture'],
  night:     ['gastronomy', 'events', 'activities'],
}

function scoreWebNowCandidate(row: WebNowCandidateRow, segment: string): number {
  const keywords = WEB_SEGMENT_CATEGORIES[segment] ?? []
  const matchCount = row.category_slugs.filter((slug) =>
    keywords.some((kw) => slug.toLowerCase().includes(kw)),
  ).length
  let score = matchCount * 20

  if (row.featured) score += 15
  if (row.image_bucket) score += 10

  if (row.img_width != null && row.img_height != null) {
    const maxDim = Math.max(row.img_width, row.img_height)
    if (maxDim >= 1920) score += 25
    else if (maxDim >= 1200) score += 15
    else if (maxDim >= 800) score += 8
    if (row.img_width >= row.img_height) score += 10
  } else {
    score -= 15
  }

  return score
}

function pickWebNowRecommendation(
  candidates: WebNowCandidateRow[],
  segment: string,
  excludeIds: Set<string>,
): WebNowCandidateRow | null {
  const pool = candidates.filter((c) => !excludeIds.has(c.id))
  if (pool.length === 0) return null
  return [...pool].sort(
    (a, b) => scoreWebNowCandidate(b, segment) - scoreWebNowCandidate(a, segment),
  )[0]
}

// ─── Main homepage aggregator ────────────────────────────────────────────────

export async function getWebHomeData(
  citySlug: string,
  locale: string,
): Promise<WebHomeDTO> {
  const [cityHeader, goldenPickRows, routeRows, nowCurated, nowCandidates, categoryRows, allCities] =
    await Promise.all([
      getCityHeader(citySlug, locale),
      getWebGoldenPicks(citySlug, locale, 3),
      getGoldenRoutesWithCity(citySlug, locale, 4),
      getWebNowCuratedSlots(citySlug, locale),
      getWebNowCandidates(citySlug, locale, 24),
      getDiscoverCategories(citySlug, locale),
      getDestinations(locale),
    ])

  const usedIds = new Set<string>([
    ...goldenPickRows.map((r) => r.id),
    ...Object.values(nowCurated)
      .filter((r): r is WebNowCandidateRow => r != null)
      .map((r) => r.id),
  ])

  function pickSlotFallback(hour: number): WebNowCandidateRow | null {
    const pick = pickWebNowRecommendation(nowCandidates, getTimeSegment(hour), usedIds)
    if (pick) usedIds.add(pick.id)
    return pick
  }

  const slots = {
    morning:   nowCurated.morning   ?? pickSlotFallback(8),
    afternoon: nowCurated.afternoon ?? pickSlotFallback(14),
    evening:   nowCurated.evening   ?? pickSlotFallback(19),
    night:     nowCurated.night     ?? pickSlotFallback(23),
  }

  return {
    hero: {
      citySlug: cityHeader?.slug ?? citySlug,
      cityName: cityHeader?.name ?? citySlug,
      imageUrl: resolveImageUrl({
        bucket: cityHeader?.hero_bucket ?? null,
        path: cityHeader?.hero_path ?? null,
      }),
    },
    goldenPicks: goldenPickRows.map(toWebPlace),
    experienceNow: {
      morning:   slots.morning   ? toWebExperienceSlot(slots.morning)   : null,
      afternoon: slots.afternoon ? toWebExperienceSlot(slots.afternoon) : null,
      evening:   slots.evening   ? toWebExperienceSlot(slots.evening)   : null,
      night:     slots.night     ? toWebExperienceSlot(slots.night)     : null,
    },
    routes: routeRows.map(toWebRoute),
    cities: allCities.map((c) => ({
      slug: c.slug,
      name: c.name,
      country: '',
      imageUrl: resolveImageUrl({ bucket: c.hero_bucket, path: c.hero_path }),
    })),
    categories: categoryRows.map((c): WebCategoryDTO => ({
      key: c.slug,
      name: c.name,
      iconName: c.icon_name,
    })),
  }
}
