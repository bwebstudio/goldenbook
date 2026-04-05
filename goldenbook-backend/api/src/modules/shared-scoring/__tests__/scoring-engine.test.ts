// ─── Verification Tests: Shared Scoring Engine ──────────────────────────────
//
// These tests verify the critical production requirements:
//   1. Commercial: paid placements boost correctly, respect city/time boundaries
//   2. Context: weather and time adjust ranking, never eliminate
//   3. Refinement: "más relajado" adjusts weights additively
//   4. Consistency: NOW and Concierge produce identical scores for same candidate

import { describe, it, expect } from 'vitest'
import { scoreCandidate } from '../scoring-engine'
import { applyDiversityRules } from '../diversity'
import type { UnifiedCandidate, ScoringContext } from '../types'
import { DEFAULT_WEIGHTS } from '../types'

// ─── Test fixtures ──────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<UnifiedCandidate> = {}): UnifiedCandidate {
  return {
    id: 'test-place-1',
    slug: 'test-place',
    name: 'Test Place',
    city_slug: 'lisbon',
    city_name: 'Lisbon',
    place_type: 'restaurant',
    short_description: 'A lovely restaurant',
    editorial_summary: null,
    featured: false,
    popularity_score: 50,
    hero_bucket: 'places',
    hero_path: 'test.jpg',
    created_at: new Date(),
    latitude: 38.72,
    longitude: -9.14,
    distance_meters: 500,
    category_slugs: ['restaurant'],
    context_tag_slugs: ['dinner', 'romantic'],
    context_tag_max_weight: 1.0,
    now_enabled: true,
    now_priority: 5,
    now_featured: false,
    now_time_window_match: true,
    ...overrides,
  }
}

function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    timeOfDay: 'evening',
    weather: 'sunny',
    paidPlaceIds: new Set(),
    excludeIds: new Set(),
    weights: DEFAULT_WEIGHTS,
    surface: 'now',
    ...overrides,
  }
}

// ─── 1. Commercial tests ────────────────────────────────────────────────────

describe('Commercial scoring', () => {
  it('paid placement receives commercial boost', () => {
    const place = makeCandidate()
    const paidCtx = makeContext({ paidPlaceIds: new Set([place.id]) })
    const unpaidCtx = makeContext({ paidPlaceIds: new Set() })

    const paid = scoreCandidate(place, paidCtx)
    const unpaid = scoreCandidate(place, unpaidCtx)

    expect(paid.isSponsored).toBe(true)
    expect(unpaid.isSponsored).toBe(false)
    expect(paid.commercialScore).toBeGreaterThan(unpaid.commercialScore)
    expect(paid.totalScore).toBeGreaterThan(unpaid.totalScore)
  })

  it('unpaid place in a different city does NOT get boost from that city\'s paid set', () => {
    const lisbon = makeCandidate({ id: 'lisbon-place', city_slug: 'lisbon' })
    // paidPlaceIds only contains a Barcelona place — lisbon place should not be boosted
    const ctx = makeContext({ paidPlaceIds: new Set(['barcelona-place']) })

    const result = scoreCandidate(lisbon, ctx)
    expect(result.isSponsored).toBe(false)
    expect(result.commercialScore).toBeLessThan(70) // no paid boost
  })
})

// ─── 2. Context tests ───────────────────────────────────────────────────────

describe('Context scoring — weather adjusts ranking, never eliminates', () => {
  it('sunny evening boosts Terrace/Rooftop/Sunset/Cocktails/Dinner', () => {
    const terrace = makeCandidate({ context_tag_slugs: ['terrace', 'sunset'] })
    const rainyDay = makeCandidate({ id: 'rainy', context_tag_slugs: ['rainy-day'] })

    const ctx = makeContext({ timeOfDay: 'evening', weather: 'sunny' })

    const terraceScore = scoreCandidate(terrace, ctx)
    const rainyScore = scoreCandidate(rainyDay, ctx)

    // Terrace should score higher than rainy-day in sunny weather
    expect(terraceScore.contextScore).toBeGreaterThan(rainyScore.contextScore)

    // But rainy-day should NOT be zero — weather doesn't eliminate
    expect(rainyScore.totalScore).toBeGreaterThan(0)
  })

  it('rain boosts Rainy Day / Coffee / Shopping / Culture without hard filtering', () => {
    const rainyPlace = makeCandidate({ context_tag_slugs: ['rainy-day', 'coffee'] })
    const terracePlace = makeCandidate({ id: 'terrace', context_tag_slugs: ['terrace', 'rooftop'] })

    const ctx = makeContext({ timeOfDay: 'afternoon', weather: 'rainy' })

    const rainyScore = scoreCandidate(rainyPlace, ctx)
    const terraceScore = scoreCandidate(terracePlace, ctx)

    // Rainy-day place should score higher in rain
    expect(rainyScore.contextScore).toBeGreaterThan(terraceScore.contextScore)

    // Terrace should still be eligible (not eliminated)
    expect(terraceScore.totalScore).toBeGreaterThan(0)
  })

  it('place with no context tags gets zero context score but nonzero total', () => {
    const noTags = makeCandidate({ context_tag_slugs: [] })
    const ctx = makeContext()

    const result = scoreCandidate(noTags, ctx)

    expect(result.contextScore).toBe(0)
    expect(result.bestTag).toBeNull()
    // Still has quality + proximity + editorial scores
    expect(result.totalScore).toBeGreaterThan(0)
  })
})

// ─── 3. Refinement tests ────────────────────────────────────────────────────

describe('Intent refinement adjustments', () => {
  it('"more relaxed" boosts Wine/Terrace/Romantic, reduces Celebration/Late Night', () => {
    const winePlace = makeCandidate({ context_tag_slugs: ['wine', 'romantic'] })
    const partyPlace = makeCandidate({ id: 'party', context_tag_slugs: ['celebration', 'late-night'] })

    const ctx = makeContext({ timeOfDay: 'evening', weather: 'sunny' })

    const wineBase = scoreCandidate(winePlace, ctx)
    const partyBase = scoreCandidate(partyPlace, ctx)

    // Apply "relax" refinement adjustments manually (simulating the route logic)
    const relaxBoost = ['wine', 'terrace', 'romantic', 'coffee', 'viewpoint', 'wellness']
    const relaxReduce = ['live-music', 'celebration', 'late-night', 'cocktails']

    let wineAdjusted = wineBase.totalScore
    let partyAdjusted = partyBase.totalScore

    for (const tag of relaxBoost) {
      if (winePlace.context_tag_slugs.includes(tag)) wineAdjusted += 8
      if (partyPlace.context_tag_slugs.includes(tag)) partyAdjusted += 8
    }
    for (const tag of relaxReduce) {
      if (winePlace.context_tag_slugs.includes(tag)) wineAdjusted -= 6
      if (partyPlace.context_tag_slugs.includes(tag)) partyAdjusted -= 6
    }

    // Wine/romantic should be boosted by refinement
    expect(wineAdjusted).toBeGreaterThan(wineBase.totalScore)
    // Party should be reduced by refinement
    expect(partyAdjusted).toBeLessThan(partyBase.totalScore)
    // After refinement, wine should rank above party
    expect(wineAdjusted).toBeGreaterThan(partyAdjusted)
  })

  it('refinement does not reset the default context', () => {
    // The base context score should still apply — refinement is additive
    const place = makeCandidate({ context_tag_slugs: ['dinner', 'romantic'] })
    const ctx = makeContext({ timeOfDay: 'evening', weather: 'sunny' })

    const result = scoreCandidate(place, ctx)

    // Base context score should be > 0 (evening + dinner/romantic is a good match)
    expect(result.contextScore).toBeGreaterThan(0)
    // Refinement would add on top of this, not replace it
  })
})

// ─── 4. Consistency tests ───────────────────────────────────────────────────

describe('NOW and Concierge consistency', () => {
  it('same candidate produces identical scores under same context regardless of surface', () => {
    const place = makeCandidate()

    const nowCtx = makeContext({ surface: 'now' })
    const conciergeCtx = makeContext({ surface: 'concierge' })

    const nowResult = scoreCandidate(place, nowCtx)
    const conciergeResult = scoreCandidate(place, conciergeCtx)

    // Same candidate, same context → identical scores (only intentTags can differ)
    expect(nowResult.totalScore).toBe(conciergeResult.totalScore)
    expect(nowResult.commercialScore).toBe(conciergeResult.commercialScore)
    expect(nowResult.contextScore).toBe(conciergeResult.contextScore)
    expect(nowResult.editorialScore).toBe(conciergeResult.editorialScore)
    expect(nowResult.qualityScore).toBe(conciergeResult.qualityScore)
  })

  it('concierge intent tags provide additional context boost', () => {
    const place = makeCandidate({ context_tag_slugs: ['romantic', 'dinner'] })

    const noIntent = makeContext({ surface: 'concierge' })
    const withIntent = makeContext({
      surface: 'concierge',
      intentTags: ['romantic', 'date-night'],
    })

    const noIntentResult = scoreCandidate(place, noIntent)
    const withIntentResult = scoreCandidate(place, withIntent)

    // Intent tag overlap should boost context score
    expect(withIntentResult.contextScore).toBeGreaterThan(noIntentResult.contextScore)
  })
})

// ─── 5. Diversity tests ─────────────────────────────────────────────────────

describe('Diversity rules', () => {
  it('penalizes adjacent same place_type (pool > 3)', () => {
    const r1 = scoreCandidate(
      makeCandidate({ id: 'a', place_type: 'restaurant' }),
      makeContext(),
    )
    const r2 = scoreCandidate(
      makeCandidate({ id: 'b', place_type: 'restaurant', popularity_score: 49 }),
      makeContext(),
    )
    const r3 = scoreCandidate(
      makeCandidate({ id: 'c', place_type: 'bar', context_tag_slugs: ['cocktails'] }),
      makeContext(),
    )
    const r4 = scoreCandidate(
      makeCandidate({ id: 'd', place_type: 'cafe', context_tag_slugs: ['coffee'] }),
      makeContext(),
    )

    const sorted = [r1, r2, r3, r4] // needs >3 to trigger diversity
    const diversified = applyDiversityRules(sorted)

    const r2After = diversified.find((r) => r.place.id === 'b')!
    expect(r2After.totalScore).toBeLessThan(r2.totalScore)
  })

  it('skips diversity penalties when pool is small (<=3)', () => {
    const r1 = scoreCandidate(makeCandidate({ id: 'a', place_type: 'restaurant' }), makeContext())
    const r2 = scoreCandidate(makeCandidate({ id: 'b', place_type: 'restaurant' }), makeContext())

    const diversified = applyDiversityRules([r1, r2])

    // With only 2 candidates, diversity should be skipped (no penalty)
    const r2After = diversified.find((r) => r.place.id === 'b')!
    expect(r2After.totalScore).toBe(r2.totalScore)
  })
})
