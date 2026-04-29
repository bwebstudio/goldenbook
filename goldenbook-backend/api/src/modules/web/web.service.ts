import { db } from '../../db/postgres'
import { resolveImageUrl } from '../../shared/storage'
import {
  getCityHeader,
  getDiscoverCategories,
  getGoldenRoutes,
  getNowCandidates,
} from '../discover/discover.query'
import { getDestinations } from '../destinations/destinations.query'
import { getTimeSegment } from '../discover/discover.dto'
import type {
  WebHomeDTO,
  WebPlaceDTO,
  WebExperienceNowSlotDTO,
  WebRouteDTO,
  WebCityDTO,
  WebCategoryDTO,
} from './web.dto'

// ─── Web golden picks query ───────────────────────────────────────────────────
// Extends the standard editors_picks pattern with address and primary
// category name — fields required by the editorial web layout.

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

async function getWebGoldenPicks(
  citySlug: string,
  locale: string,
  limit = 5,
): Promise<GoldenPickRow[]> {
  // Try curated editors_picks collection first
  const { rows } = await db.query<GoldenPickRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(pt.name, pt_fb.name, p.name)                              AS name,
      hero_img.bucket                                                     AS hero_bucket,
      hero_img.path                                                       AS hero_path,
      p.address_line,
      first_cat.cat_name                                                  AS category_name,
      d.slug                                                              AS city_slug
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
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'pt'
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
    LEFT JOIN LATERAL (
      SELECT COALESCE(ct.name, ct_fb.name, c.slug) AS cat_name
      FROM   place_categories pc2
      JOIN   categories c ON c.id = pc2.category_id AND c.is_active = true
      LEFT JOIN category_translations ct
             ON ct.category_id = c.id AND ct.locale = $2
      LEFT JOIN category_translations ct_fb
             ON ct_fb.category_id = c.id AND ct_fb.locale = 'pt'
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

  // Fallback: one pick per category (culture first), all must have images
  // Uses DISTINCT ON category to enforce editorial diversity across the result set.
  const { rows: fb } = await db.query<GoldenPickRow>(
    `
    SELECT DISTINCT ON (first_cat.cat_sort)
      p.id,
      p.slug,
      COALESCE(pt.name, pt_fb.name, p.name)                              AS name,
      hero_img.bucket                                                     AS hero_bucket,
      hero_img.path                                                       AS hero_path,
      p.address_line,
      first_cat.cat_name                                                  AS category_name,
      d.slug                                                              AS city_slug
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'pt'
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
    LEFT JOIN LATERAL (
      SELECT COALESCE(ct.name, ct_fb.name, c.slug) AS cat_name, c.sort_order AS cat_sort
      FROM   place_categories pc2
      JOIN   categories c ON c.id = pc2.category_id AND c.is_active = true
      LEFT JOIN category_translations ct
             ON ct.category_id = c.id AND ct.locale = $2
      LEFT JOIN category_translations ct_fb
             ON ct_fb.category_id = c.id AND ct_fb.locale = 'pt'
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

// ─── Web experience now query ─────────────────────────────────────────────────
// Extends NowCandidateRow with short_description for the editorial copy block.

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

async function getWebNowCandidates(
  citySlug: string,
  locale: string,
  limit = 24,
): Promise<WebNowCandidateRow[]> {
  const { rows } = await db.query<WebNowCandidateRow>(
    `
    SELECT
      p.id,
      p.slug,
      COALESCE(pt.name, pt_fb.name, p.name)                               AS name,
      hero_img.bucket                                                       AS image_bucket,
      hero_img.path                                                         AS image_path,
      hero_img.img_width,
      hero_img.img_height,
      p.featured,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.slug), NULL)                       AS category_slugs,
      COALESCE(pt.short_description, pt_fb.short_description)              AS short_description,
      first_cat.cat_name                                                    AS category_name,
      first_cat.cat_icon_name                                               AS category_icon_name,
      d.slug                                                                AS city_slug
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN place_translations pt
           ON pt.place_id = p.id AND pt.locale = $2
    LEFT JOIN place_translations pt_fb
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'pt'
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path, ma.width AS img_width, ma.height AS img_height
      FROM   place_images pi
      JOIN   media_assets ma ON ma.id = pi.asset_id
      WHERE  pi.place_id = p.id
        AND  pi.image_role IN ('editorial', 'hero', 'cover')
      ORDER  BY
        CASE pi.image_role WHEN 'editorial' THEN 0 WHEN 'hero' THEN 1 ELSE 2 END ASC,
        -- Landscape first
        CASE WHEN ma.width IS NOT NULL AND ma.height IS NOT NULL
                  AND ma.width >= ma.height THEN 0 ELSE 1 END ASC,
        COALESCE(ma.width, 0) DESC,
        pi.is_primary DESC,
        pi.sort_order ASC
      LIMIT  1
    ) hero_img ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(ct.name, ct_fb.name, c2.slug) AS cat_name, c2.icon_name AS cat_icon_name
      FROM   place_categories pc2
      JOIN   categories c2 ON c2.id = pc2.category_id AND c2.is_active = true
      LEFT JOIN category_translations ct
             ON ct.category_id = c2.id AND ct.locale = $2
      LEFT JOIN category_translations ct_fb
             ON ct_fb.category_id = c2.id AND ct_fb.locale = 'pt'
      WHERE  pc2.place_id = p.id
      ORDER  BY c2.sort_order ASC
      LIMIT  1
    ) first_cat ON true
    LEFT JOIN place_categories pc ON pc.place_id = p.id
    LEFT JOIN categories c        ON c.id = pc.category_id AND c.is_active = true
    WHERE p.status = 'published'
      AND hero_img.bucket IS NOT NULL
      -- Exclude specific places with imagery not suitable for the homepage
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

// ─── DTO transformers ─────────────────────────────────────────────────────────

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

function toWebRoute(r: {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_bucket: string | null
  hero_path: string | null
  places_count: number
  city_slug: string
}): WebRouteDTO {
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

// ─── Curated now-slots collection ─────────────────────────────────────────────
// The 'now_slots' editorial collection (collection_type = 'custom',
// slug = '{city}-now-slots') pins exactly which place appears in each time slot.
// sort_order: 0 = morning | 1 = afternoon | 2 = evening | 3 = night
//
// Run scripts/setup-now-slots.sql to auto-populate it from the highest-
// resolution images in the DB. The scoring fallback runs only when the
// collection is absent or a slot has no entry.

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
  const { rows } = await db.query<WebNowCandidateRow & { slot_order: number }>(
    `
    SELECT
      eci.sort_order                                                        AS slot_order,
      p.id,
      p.slug,
      COALESCE(pt.name, pt_fb.name, p.name)                               AS name,
      hero_img.bucket                                                       AS image_bucket,
      hero_img.path                                                         AS image_path,
      hero_img.img_width,
      hero_img.img_height,
      p.featured,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.slug), NULL)                       AS category_slugs,
      COALESCE(pt.short_description, pt_fb.short_description)              AS short_description,
      first_cat.cat_name                                                    AS category_name,
      first_cat.cat_icon_name                                               AS category_icon_name,
      d.slug                                                                AS city_slug
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
           ON pt_fb.place_id = p.id AND pt_fb.locale = 'pt'
    LEFT JOIN LATERAL (
      SELECT ma.bucket, ma.path, ma.width AS img_width, ma.height AS img_height
      FROM   place_images pi
      JOIN   media_assets ma ON ma.id = pi.asset_id
      WHERE  pi.place_id = p.id
        AND  pi.image_role IN ('editorial', 'hero', 'cover')
      ORDER  BY
        CASE pi.image_role WHEN 'editorial' THEN 0 WHEN 'hero' THEN 1 ELSE 2 END ASC,
        -- Landscape first
        CASE WHEN ma.width IS NOT NULL AND ma.height IS NOT NULL
                  AND ma.width >= ma.height THEN 0 ELSE 1 END ASC,
        COALESCE(ma.width, 0) DESC,
        pi.is_primary DESC,
        pi.sort_order ASC
      LIMIT  1
    ) hero_img ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(ct.name, ct_fb.name, c2.slug) AS cat_name, c2.icon_name AS cat_icon_name
      FROM   place_categories pc2
      JOIN   categories c2 ON c2.id = pc2.category_id AND c2.is_active = true
      LEFT JOIN category_translations ct
             ON ct.category_id = c2.id AND ct.locale = $2
      LEFT JOIN category_translations ct_fb
             ON ct_fb.category_id = c2.id AND ct_fb.locale = 'pt'
      WHERE  pc2.place_id = p.id
      ORDER  BY c2.sort_order ASC
      LIMIT  1
    ) first_cat ON true
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

// ─── Web-specific now-recommendation scoring (fallback) ───────────────────────
// Used only when the curated now_slots collection is missing a slot entry.

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

  // Prefer high-res images; landscape gets a bonus
  if (row.img_width != null && row.img_height != null) {
    const maxDim = Math.max(row.img_width, row.img_height)
    if (maxDim >= 1920)      score += 25
    else if (maxDim >= 1200) score += 15
    else if (maxDim >= 800)  score += 8
    // Landscape bonus
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

// ─── Main homepage aggregator ─────────────────────────────────────────────────

export async function getWebHomeData(
  citySlug: string,
  locale: string,
): Promise<WebHomeDTO> {
  // Run all queries in parallel for minimum latency
  const [cityHeader, goldenPickRows, routeRows, nowCurated, nowCandidates, categoryRows, allCities] =
    await Promise.all([
      getCityHeader(citySlug, locale),
      getWebGoldenPicks(citySlug, locale, 3),
      getGoldenRoutesWithCity(citySlug, locale, 4),
      // Curated now-slots collection: deterministic, image-quality guaranteed
      getWebNowCuratedSlots(citySlug, locale),
      // Fallback candidates: scored dynamically if a slot has no curated entry
      getWebNowCandidates(citySlug, locale, 24),
      getDiscoverCategories(citySlug, locale),
      getDestinations(locale),
    ])

  // Build the cross-section exclusion set:
  // — Golden Pick IDs (avoid repeating the same place in two homepage sections)
  // — Curated now-slot IDs (avoid repeating within the "now" section itself)
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
        path:   cityHeader?.hero_path ?? null,
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
      country: (c as { slug: string; name: string; hero_bucket: string | null; hero_path: string | null; country?: string }).country ?? '',
      imageUrl: resolveImageUrl({ bucket: c.hero_bucket, path: c.hero_path }),
    })),
    categories: categoryRows.map((c) => ({
      key: c.slug,
      name: c.name,
      iconName: c.icon_name,
    })),
  }
}

// ─── Extended routes query with city_slug ─────────────────────────────────────
// The shared getGoldenRoutes query doesn't return city_slug — add it here.

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

async function getGoldenRoutesWithCity(
  citySlug: string,
  locale: string,
  limit = 4,
): Promise<WebRouteRow[]> {
  const { rows } = await db.query<WebRouteRow>(
    `
    SELECT
      r.id,
      r.slug,
      COALESCE(rt.title, rt_fb.title, r.title)         AS title,
      COALESCE(rt.summary, rt_fb.summary, r.summary)   AS summary,
      ma.bucket                                         AS hero_bucket,
      ma.path                                           AS hero_path,
      COUNT(rp.place_id)::int                           AS places_count,
      d.slug                                            AS city_slug
    FROM routes r
    JOIN destinations d ON d.id = r.destination_id AND d.slug = $1
    LEFT JOIN route_translations rt
           ON rt.route_id = r.id AND rt.locale = $2
    LEFT JOIN route_translations rt_fb
           ON rt_fb.route_id = r.id AND rt_fb.locale = 'pt'
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
  return rows
}
