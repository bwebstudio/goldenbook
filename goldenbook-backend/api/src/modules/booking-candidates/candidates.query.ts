import { db } from '../../db/postgres'
import type { BookingCandidate, CandidateGenerationInput } from './candidates.types'
import { generateCandidatesForPlace } from './candidates.discovery'

// ─── Get candidates for a place ──────────────────────────────────────────────

export async function getCandidatesForPlace(placeId: string): Promise<BookingCandidate[]> {
  const { rows } = await db.query<BookingCandidate>(`
    SELECT
      id, place_id, provider::text, candidate_url, candidate_type::text,
      is_valid, validation_status::text, validation_details,
      confidence, source::text, discovered_at, last_checked_at,
      notes, is_active, priority
    FROM place_booking_candidates
    WHERE place_id = $1
    ORDER BY is_active DESC, priority DESC, confidence DESC
  `, [placeId])
  return rows
}

// ─── Get active candidate for a place ────────────────────────────────────────

export async function getActiveCandidateForPlace(placeId: string): Promise<BookingCandidate | null> {
  const { rows } = await db.query<BookingCandidate>(`
    SELECT
      id, place_id, provider::text, candidate_url, candidate_type::text,
      is_valid, validation_status::text, validation_details,
      confidence, source::text, discovered_at, last_checked_at,
      notes, is_active, priority
    FROM place_booking_candidates
    WHERE place_id = $1 AND is_active = true
    LIMIT 1
  `, [placeId])
  return rows[0] ?? null
}

// ─── Get best valid candidate (fallback when none is active) ─────────────────

export async function getBestValidCandidateForPlace(placeId: string): Promise<BookingCandidate | null> {
  const { rows } = await db.query<BookingCandidate>(`
    SELECT
      id, place_id, provider::text, candidate_url, candidate_type::text,
      is_valid, validation_status::text, validation_details,
      confidence, source::text, discovered_at, last_checked_at,
      notes, is_active, priority
    FROM place_booking_candidates
    WHERE place_id = $1
      AND validation_status = 'valid'
      AND provider != 'website'
    ORDER BY priority DESC, confidence DESC
    LIMIT 1
  `, [placeId])
  return rows[0] ?? null
}

// ─── Generate candidates for a place ─────────────────────────────────────────

export async function generateCandidatesForPlaceId(placeId: string): Promise<number> {
  // Fetch place data needed for generation
  const { rows: placeRows } = await db.query<{
    id: string; name: string; slug: string;
    website_url: string | null; city_name: string; city_slug: string;
    cat_slugs: string | null; subcat_slugs: string | null;
  }>(`
    SELECT p.id, p.name, p.slug, p.website_url,
      d.name AS city_name, d.slug AS city_slug,
      (SELECT string_agg(DISTINCT c.slug, ',') FROM place_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.place_id = p.id) AS cat_slugs,
      (SELECT string_agg(DISTINCT s.slug, ',') FROM place_categories pc JOIN subcategories s ON s.id = pc.subcategory_id WHERE pc.place_id = p.id AND pc.subcategory_id IS NOT NULL) AS subcat_slugs
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
    WHERE p.id = $1
  `, [placeId])

  if (!placeRows[0]) return 0
  const place = placeRows[0]

  const input: CandidateGenerationInput = {
    id: place.id,
    name: place.name,
    slug: place.slug,
    city_name: place.city_name,
    city_slug: place.city_slug,
    website_url: place.website_url,
    category_slugs: place.cat_slugs ? place.cat_slugs.split(',') : [],
    subcategory_slugs: place.subcat_slugs ? place.subcat_slugs.split(',') : [],
  }

  const candidates = generateCandidatesForPlace(input)
  if (candidates.length === 0) return 0

  // Insert candidates (skip duplicates by URL)
  let inserted = 0
  for (const c of candidates) {
    const { rowCount } = await db.query(`
      INSERT INTO place_booking_candidates (
        place_id, provider, candidate_url, candidate_type, confidence, source
      ) VALUES (
        $1, $2::candidate_provider, $3, $4::candidate_type, $5, 'generated'::candidate_source
      )
      ON CONFLICT DO NOTHING
    `, [placeId, c.provider, c.candidate_url, c.candidate_type, c.confidence])
    inserted += rowCount ?? 0
  }
  return inserted
}

// ─── Generate for all reservable places ──────────────────────────────────────

export async function generateCandidatesForAllPlaces(): Promise<{ total: number; generated: number }> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM places WHERE status = 'published'`)
  let generated = 0
  for (const row of rows) {
    generated += await generateCandidatesForPlaceId(row.id)
  }
  return { total: rows.length, generated }
}

// ─── Set active candidate ────────────────────────────────────────────────────

export async function setActiveCandidate(placeId: string, candidateId: string): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    // Deactivate all for this place
    await client.query(`UPDATE place_booking_candidates SET is_active = false, updated_at = now() WHERE place_id = $1`, [placeId])
    // Activate the chosen one
    await client.query(`UPDATE place_booking_candidates SET is_active = true, updated_at = now() WHERE id = $1 AND place_id = $2`, [candidateId, placeId])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Deactivate candidate ────────────────────────────────────────────────────

export async function deactivateCandidate(candidateId: string): Promise<void> {
  await db.query(`UPDATE place_booking_candidates SET is_active = false, updated_at = now() WHERE id = $1`, [candidateId])
}

// ─── Update validation result ────────────────────────────────────────────────

export async function updateCandidateValidation(
  candidateId: string,
  status: string,
  isValid: boolean | null,
  details: string | null,
): Promise<void> {
  await db.query(`
    UPDATE place_booking_candidates SET
      validation_status = $2::candidate_validation_status,
      is_valid = $3,
      validation_details = $4,
      last_checked_at = now(),
      source = CASE WHEN source = 'generated' THEN 'verified_script'::candidate_source ELSE source END,
      confidence = CASE
        WHEN $2 = 'valid' THEN GREATEST(confidence, 0.70)
        WHEN $2 = 'invalid' THEN 0.0
        WHEN $2 = 'unreachable' THEN LEAST(confidence, 0.20)
        ELSE confidence
      END,
      updated_at = now()
    WHERE id = $1
  `, [candidateId, status, isValid, details])
}

// ─── Auto-activate best valid candidate ──────────────────────────────────────

export async function autoActivateBestCandidate(placeId: string): Promise<string | null> {
  const best = await getBestValidCandidateForPlace(placeId)
  if (!best) return null
  await setActiveCandidate(placeId, best.id)
  return best.id
}

// ─── Add candidate manually ──────────────────────────────────────────────────

export async function addManualCandidate(
  placeId: string,
  provider: string,
  url: string,
  setActive: boolean,
): Promise<BookingCandidate> {
  // Detect provider from URL if provider is 'website'
  const detectedProvider = detectProviderFromUrl(url) ?? provider

  const { rows } = await db.query<BookingCandidate>(`
    INSERT INTO place_booking_candidates (
      place_id, provider, candidate_url, candidate_type, confidence,
      source, validation_status, is_valid, is_active
    ) VALUES (
      $1, $2::candidate_provider, $3, 'exact_listing'::candidate_type, 0.90,
      'manual'::candidate_source, 'valid'::candidate_validation_status, true, $4
    )
    RETURNING id, place_id, provider::text, candidate_url, candidate_type::text,
      is_valid, validation_status::text, validation_details,
      confidence, source::text, discovered_at, last_checked_at,
      notes, is_active, priority
  `, [placeId, detectedProvider, url, setActive])

  // If setting active, deactivate others
  if (setActive && rows[0]) {
    await db.query(
      `UPDATE place_booking_candidates SET is_active = false, updated_at = now() WHERE place_id = $1 AND id != $2`,
      [placeId, rows[0].id],
    )
  }

  return rows[0]
}

// ─── Update candidate URL ────────────────────────────────────────────────────

export async function updateCandidateUrl(candidateId: string, url: string): Promise<void> {
  const provider = detectProviderFromUrl(url)
  const providerUpdate = provider ? `, provider = '${provider}'::candidate_provider` : ''
  await db.query(`
    UPDATE place_booking_candidates SET
      candidate_url = $2,
      candidate_type = 'exact_listing'::candidate_type,
      source = 'manual'::candidate_source,
      validation_status = 'valid'::candidate_validation_status,
      is_valid = true,
      confidence = 0.90,
      updated_at = now()
      ${providerUpdate}
    WHERE id = $1
  `, [candidateId, url])
}

// ─── Delete candidate ────────────────────────────────────────────────────────

export async function deleteCandidate(candidateId: string): Promise<void> {
  await db.query(`DELETE FROM place_booking_candidates WHERE id = $1`, [candidateId])
}

// ─── Detect provider from URL ────────────────────────────────────────────────

function detectProviderFromUrl(url: string): string | null {
  if (url.includes('booking.com')) return 'booking'
  if (url.includes('thefork.')) return 'thefork'
  if (url.includes('viator.com')) return 'viator'
  if (url.includes('getyourguide.com')) return 'getyourguide'
  return null
}
