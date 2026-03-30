#!/usr/bin/env npx tsx
// ─── Verify Booking Candidates ───────────────────────────────────────────────
//
// Usage:
//   npx tsx scripts/verify-candidates.ts                  # all pending
//   npx tsx scripts/verify-candidates.ts --all            # re-verify all
//   npx tsx scripts/verify-candidates.ts --place <uuid>   # one place
//   npx tsx scripts/verify-candidates.ts --activate       # auto-activate best valid
//

import { db } from '../api/src/db/postgres'

interface CandidateRow {
  id: string
  place_id: string
  provider: string
  candidate_url: string
  candidate_type: string
  validation_status: string
  place_name: string
}

// Known providers that block bots but work in real browsers
const BOT_BLOCKING_DOMAINS = ['thefork.pt', 'thefork.com', 'lafourchette.com']

function isBotBlockingDomain(url: string): boolean {
  return BOT_BLOCKING_DOMAINS.some(d => url.includes(d))
}

async function verifyUrl(url: string): Promise<{ status: string; isValid: boolean | null; details: string }> {
  // TheFork and similar block bots — treat their search URLs as valid if they're well-formed
  if (isBotBlockingDomain(url)) {
    try {
      const u = new URL(url)
      if (u.protocol === 'https:' && u.searchParams.has('q')) {
        return { status: 'valid', isValid: true, details: 'Provider search URL (bot-protected, assumed valid)' }
      }
    } catch {}
    return { status: 'ambiguous', isValid: null, details: 'Could not parse provider URL' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    clearTimeout(timeout)

    // Booking.com returns 202 for search, that's valid
    if (res.ok || res.status === 202) {
      return { status: 'valid', isValid: true, details: `HTTP ${res.status}` }
    }

    // 405 = Method Not Allowed for HEAD — try GET
    if (res.status === 405) {
      const getRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      })
      return {
        status: getRes.ok || getRes.status === 202 ? 'valid' : 'ambiguous',
        isValid: getRes.ok || getRes.status === 202,
        details: `GET ${getRes.status}`,
      }
    }

    // 403 from search providers — likely bot protection, treat as valid for search URLs
    if (res.status === 403) {
      return { status: 'valid', isValid: true, details: `HTTP 403 (bot-protected, assumed valid for search)` }
    }

    if (res.status === 404) {
      return { status: 'invalid', isValid: false, details: '404 Not Found' }
    }

    return { status: 'ambiguous', isValid: null, details: `HTTP ${res.status}` }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { status: 'unreachable', isValid: false, details: 'Timeout (10s)' }
    }
    return { status: 'unreachable', isValid: false, details: err.message?.slice(0, 200) ?? 'Unknown error' }
  }
}

async function main() {
  const args = process.argv.slice(2)
  let placeId: string | undefined
  let verifyAll = false
  let autoActivate = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--all') verifyAll = true
    if (args[i] === '--activate') autoActivate = true
    if (args[i] === '--place' && args[i + 1]) placeId = args[++i]
  }

  let whereClause = ''
  const params: unknown[] = []
  if (placeId) {
    params.push(placeId)
    whereClause = `AND c.place_id = $${params.length}`
  }
  if (!verifyAll) {
    whereClause += ` AND c.validation_status = 'pending'`
  }

  const { rows: candidates } = await db.query<CandidateRow>(`
    SELECT c.id, c.place_id, c.provider::text, c.candidate_url, c.candidate_type::text,
           c.validation_status::text, p.name AS place_name
    FROM place_booking_candidates c
    JOIN places p ON p.id = c.place_id
    WHERE 1=1 ${whereClause}
    ORDER BY p.name, c.provider
  `, params)

  console.log(`Verifying ${candidates.length} candidates...`)
  console.log('')

  let valid = 0, invalid = 0, unreachable = 0, ambiguous = 0

  for (const c of candidates) {
    process.stdout.write(`  ${c.place_name} [${c.provider}] `)
    const result = await verifyUrl(c.candidate_url)

    await db.query(`
      UPDATE place_booking_candidates SET
        validation_status = $2::candidate_validation_status,
        is_valid = $3,
        validation_details = $4,
        last_checked_at = now(),
        source = CASE WHEN source = 'generated' THEN 'verified_script'::candidate_source ELSE source END,
        confidence = CASE
          WHEN $2 = 'valid' AND provider != 'website' THEN GREATEST(confidence, 0.70)
          WHEN $2 = 'valid' AND provider = 'website' THEN GREATEST(confidence, 0.50)
          WHEN $2 = 'invalid' THEN 0.0
          WHEN $2 = 'unreachable' THEN LEAST(confidence, 0.20)
          ELSE confidence
        END,
        updated_at = now()
      WHERE id = $1
    `, [c.id, result.status, result.isValid, result.details])

    if (result.status === 'valid') { valid++; console.log('OK — ' + result.details) }
    else if (result.status === 'invalid') { invalid++; console.log('FAIL — ' + result.details) }
    else if (result.status === 'unreachable') { unreachable++; console.log('UNREACHABLE — ' + result.details) }
    else { ambiguous++; console.log('AMBIGUOUS — ' + result.details) }
  }

  console.log('')
  console.log(`Results: ${valid} valid, ${invalid} invalid, ${unreachable} unreachable, ${ambiguous} ambiguous`)

  if (autoActivate) {
    console.log('')
    console.log('Auto-activating best valid candidates...')

    // Find places that have valid non-website candidates but no active candidate
    const placeFilter = placeId ? `AND c.place_id = '${placeId}'` : ''
    const { rows: placesToActivate } = await db.query<{ place_id: string; name: string }>(`
      SELECT DISTINCT c.place_id, p.name
      FROM place_booking_candidates c
      JOIN places p ON p.id = c.place_id
      WHERE c.validation_status = 'valid'
        AND c.provider != 'website'
        AND c.place_id NOT IN (SELECT place_id FROM place_booking_candidates WHERE is_active = true)
        ${placeFilter}
    `)

    let activated = 0
    for (const p of placesToActivate) {
      const { rows: best } = await db.query<{ id: string; provider: string; candidate_url: string }>(`
        SELECT id, provider::text, candidate_url FROM place_booking_candidates
        WHERE place_id = $1 AND validation_status = 'valid' AND provider != 'website'
        ORDER BY confidence DESC, priority DESC
        LIMIT 1
      `, [p.place_id])

      if (best[0]) {
        await db.query(`UPDATE place_booking_candidates SET is_active = false WHERE place_id = $1`, [p.place_id])
        await db.query(`UPDATE place_booking_candidates SET is_active = true WHERE id = $1`, [best[0].id])
        console.log(`  ${p.name} → ${best[0].provider}: ${best[0].candidate_url.slice(0, 70)}`)
        activated++
      }
    }
    console.log(`\nActivated: ${activated} places`)
  }

  process.exit(0)
}

main().catch(err => { console.error('Error:', err); process.exit(1) })
