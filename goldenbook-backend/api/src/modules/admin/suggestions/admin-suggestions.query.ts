import { db } from '../../../db/postgres'
import { suggestReservationForPlace, type SuggestionInput, type ReservationSuggestion } from '../../booking/booking.suggestions'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SuggestionResult {
  placeId: string
  placeName: string
  placeSlug: string
  suggestion: ReservationSuggestion
}

// ─── Fetch places with categories ────────────────────────────────────────────

async function fetchPlacesForSuggestion(
  filter?: { placeId?: string; onlyMissing?: boolean; onlySource?: string },
): Promise<Array<{
  id: string; name: string; slug: string;
  website_url: string | null; phone: string | null; booking_url: string | null;
  booking_enabled: boolean; booking_mode: string; place_type: string | null;
  category_slugs: string[]; subcategory_slugs: string[];
}>> {
  let whereClause = 'WHERE 1=1'
  const params: unknown[] = []

  if (filter?.placeId) {
    params.push(filter.placeId)
    whereClause += ` AND p.id = $${params.length}`
  }
  if (filter?.onlyMissing) {
    whereClause += ` AND p.suggestion_generated_at IS NULL`
  }
  if (filter?.onlySource) {
    params.push(filter.onlySource)
    whereClause += ` AND p.suggestion_source = $${params.length}`
  }

  const { rows } = await db.query<{
    id: string; name: string; slug: string;
    website_url: string | null; phone: string | null; booking_url: string | null;
    booking_enabled: boolean; booking_mode: string; place_type: string | null;
    cat_slugs: string | null; subcat_slugs: string | null;
  }>(`
    SELECT
      p.id, p.name, p.slug, p.website_url, p.phone, p.booking_url,
      p.booking_enabled, p.booking_mode::text AS booking_mode, p.place_type,
      (SELECT string_agg(DISTINCT c.slug, ',') FROM place_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.place_id = p.id) AS cat_slugs,
      (SELECT string_agg(DISTINCT s.slug, ',') FROM place_categories pc JOIN subcategories s ON s.id = pc.subcategory_id WHERE pc.place_id = p.id AND pc.subcategory_id IS NOT NULL) AS subcat_slugs
    FROM places p ${whereClause}
    ORDER BY p.name ASC
  `, params)

  return rows.map(r => ({
    ...r,
    category_slugs: r.cat_slugs ? r.cat_slugs.split(',') : [],
    subcategory_slugs: r.subcat_slugs ? r.subcat_slugs.split(',') : [],
  }))
}

// ─── Generate & persist suggestions ─────────────────────────────────────────

export async function generateSuggestions(
  filter?: { placeId?: string; onlyMissing?: boolean; onlySource?: string },
): Promise<SuggestionResult[]> {
  const places = await fetchPlacesForSuggestion(filter)
  const results: SuggestionResult[] = []

  for (const place of places) {
    const input: SuggestionInput = {
      id: place.id,
      name: place.name,
      category_slugs: place.category_slugs,
      subcategory_slugs: place.subcategory_slugs,
      place_type: place.place_type,
      website_url: place.website_url,
      phone: place.phone,
      booking_url: place.booking_url,
      booking_enabled: place.booking_enabled,
      booking_mode: place.booking_mode,
    }

    const suggestion = suggestReservationForPlace(input)

    await db.query(`
      UPDATE places SET
        suggestion_relevant     = $2,
        suggestion_mode         = $3,
        suggestion_label        = $4,
        suggestion_url          = $5,
        suggestion_confidence   = $6,
        suggestion_reason       = $7,
        suggestion_source       = $8,
        suggestion_generated_at = now(),
        suggestion_dismissed    = false,
        suggestion_status       = 'pending'::suggestion_status
      WHERE id = $1
    `, [
      place.id,
      suggestion.relevant,
      suggestion.suggestedMode,
      suggestion.suggestedLabel,
      suggestion.suggestedUrl,
      suggestion.confidence,
      `${suggestion.reason}:${suggestion.reasonDetail}`,
      suggestion.source,
    ])

    results.push({ placeId: place.id, placeName: place.name, placeSlug: place.slug, suggestion })
  }

  return results
}

// ─── Apply suggestion to active config ───────────────────────────────────────
// When suggestedMode = 'none', clears booking_url and booking_label to avoid residues.

export async function applySuggestion(placeId: string): Promise<void> {
  await db.query(`
    UPDATE places SET
      reservation_relevant         = COALESCE(suggestion_relevant, reservation_relevant),
      booking_enabled              = COALESCE(suggestion_relevant, booking_enabled),
      booking_mode                 = COALESCE(suggestion_mode, booking_mode::text)::booking_mode,
      booking_label                = CASE WHEN suggestion_mode = 'none' THEN NULL ELSE COALESCE(suggestion_label, booking_label) END,
      booking_url                  = CASE WHEN suggestion_mode = 'none' THEN NULL ELSE COALESCE(suggestion_url, booking_url) END,
      reservation_confidence       = suggestion_confidence,
      reservation_source           = 'ai_suggested'::reservation_source,
      reservation_last_reviewed_at = now(),
      suggestion_status            = 'applied'::suggestion_status,
      suggestion_dismissed         = false,
      updated_at                   = now()
    WHERE id = $1
      AND suggestion_generated_at IS NOT NULL
  `, [placeId])
}

// ─── Dismiss suggestion ──────────────────────────────────────────────────────

export async function dismissSuggestion(placeId: string): Promise<void> {
  await db.query(`
    UPDATE places SET
      suggestion_dismissed = true,
      suggestion_status    = 'dismissed'::suggestion_status,
      updated_at           = now()
    WHERE id = $1
  `, [placeId])
}

// ─── Bulk apply suggestions ─────────────────────────────────────────────────

export async function bulkApplySuggestions(
  filter: { placeIds?: string[]; minConfidence?: number },
): Promise<number> {
  let whereClause = `WHERE suggestion_generated_at IS NOT NULL AND suggestion_dismissed = false`
  const params: unknown[] = []

  if (filter.placeIds && filter.placeIds.length > 0) {
    params.push(filter.placeIds)
    whereClause += ` AND id = ANY($${params.length})`
  }
  if (filter.minConfidence != null) {
    params.push(filter.minConfidence)
    whereClause += ` AND suggestion_confidence >= $${params.length}`
  }

  const { rowCount } = await db.query(`
    UPDATE places SET
      reservation_relevant         = COALESCE(suggestion_relevant, reservation_relevant),
      booking_enabled              = COALESCE(suggestion_relevant, booking_enabled),
      booking_mode                 = COALESCE(suggestion_mode, booking_mode::text)::booking_mode,
      booking_label                = CASE WHEN suggestion_mode = 'none' THEN NULL ELSE COALESCE(suggestion_label, booking_label) END,
      booking_url                  = CASE WHEN suggestion_mode = 'none' THEN NULL ELSE COALESCE(suggestion_url, booking_url) END,
      reservation_confidence       = suggestion_confidence,
      reservation_source           = 'ai_suggested'::reservation_source,
      reservation_last_reviewed_at = now(),
      suggestion_status            = 'applied'::suggestion_status,
      suggestion_dismissed         = false,
      updated_at                   = now()
    ${whereClause}
  `, params)

  return rowCount ?? 0
}

// ─── Bulk dismiss ────────────────────────────────────────────────────────────

export async function bulkDismissSuggestions(placeIds: string[]): Promise<number> {
  const { rowCount } = await db.query(`
    UPDATE places SET suggestion_dismissed = true, suggestion_status = 'dismissed'::suggestion_status, updated_at = now()
    WHERE id = ANY($1) AND suggestion_generated_at IS NOT NULL
  `, [placeIds])
  return rowCount ?? 0
}

// ─── Clear suggestions ──────────────────────────────────────────────────────

export async function bulkClearSuggestions(placeIds: string[]): Promise<number> {
  const { rowCount } = await db.query(`
    UPDATE places SET
      suggestion_relevant = NULL, suggestion_mode = NULL, suggestion_label = NULL,
      suggestion_url = NULL, suggestion_confidence = NULL, suggestion_reason = NULL,
      suggestion_source = NULL, suggestion_generated_at = NULL,
      suggestion_dismissed = false, suggestion_status = NULL,
      updated_at = now()
    WHERE id = ANY($1)
  `, [placeIds])
  return rowCount ?? 0
}
