#!/usr/bin/env npx tsx
// ─── Generate Booking Candidates ─────────────────────────────────────────────
//
// Usage:
//   npx tsx scripts/generate-candidates.ts               # all published places
//   npx tsx scripts/generate-candidates.ts --place <uuid> # one place
//
// Generates search URLs for Booking, TheFork, Viator, etc. based on place type.
// Does NOT verify — run verify-candidates.ts after this.

import { db } from '../api/src/db/postgres'
import { generateCandidatesForPlace } from '../api/src/modules/booking-candidates/candidates.discovery'
import type { CandidateGenerationInput } from '../api/src/modules/booking-candidates/candidates.types'

async function main() {
  const args = process.argv.slice(2)
  let placeId: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--place' && args[i + 1]) placeId = args[++i]
  }

  let whereClause = `WHERE p.status = 'published'`
  const params: unknown[] = []
  if (placeId) {
    params.push(placeId)
    whereClause += ` AND p.id = $${params.length}`
  }

  const { rows } = await db.query<{
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
    ${whereClause}
    ORDER BY p.name
  `, params)

  console.log(`Processing ${rows.length} places...`)
  let totalGenerated = 0

  for (const place of rows) {
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
    if (candidates.length === 0) {
      console.log(`  - ${place.name}: no candidates (non-reservable)`)
      continue
    }

    let inserted = 0
    for (const c of candidates) {
      const { rowCount } = await db.query(`
        INSERT INTO place_booking_candidates (
          place_id, provider, candidate_url, candidate_type, confidence, source
        ) VALUES (
          $1, $2::candidate_provider, $3, $4::candidate_type, $5, 'generated'::candidate_source
        )
        ON CONFLICT DO NOTHING
      `, [place.id, c.provider, c.candidate_url, c.candidate_type, c.confidence])
      inserted += rowCount ?? 0
    }
    if (inserted > 0) {
      console.log(`  + ${place.name}: ${inserted} candidates`)
      totalGenerated += inserted
    }
  }

  console.log(`\nTotal: ${totalGenerated} candidates generated for ${rows.length} places`)
  process.exit(0)
}

main().catch(err => { console.error('Error:', err); process.exit(1) })
