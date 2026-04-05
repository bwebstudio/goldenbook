// ─── Verification Tests: Shared Scoring Engine ──────────────────────────────
//
// These tests verify the critical production requirements:
//   1. Commercial: paid placements boost correctly, respect city/time boundaries
//   2. Context: weather and time adjust ranking, never eliminate
//   3. Refinement: "más relajado" adjusts weights additively
//   4. Consistency: NOW and Concierge produce identical scores for same candidate

import { describe, it, expect } from 'vitest'
import { scoreCandidate, selectTopN } from '../scoring-engine'
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

// ─── Paid placement + tag interaction scenarios ─────────────────────────────

describe('Paid placement vs context tags', () => {
  it('1️⃣ paid with perfect tags → ranks high', () => {
    const paid = makeCandidate({ context_tag_slugs: ['dinner', 'romantic', 'fine-dining'] })
    const ctx = makeContext({ timeOfDay: 'evening', weather: 'sunny', paidPlaceIds: new Set([paid.id]) })

    const result = scoreCandidate(paid, ctx)
    expect(result.isSponsored).toBe(true)
    expect(result.commercialScore).toBeGreaterThanOrEqual(70)
    expect(result.contextScore).toBeGreaterThan(0)
    expect(result.totalScore).toBeGreaterThan(30)
  })

  it('2️⃣ paid with weak tags → still appears (commercial carries it)', () => {
    const paid = makeCandidate({ context_tag_slugs: ['shopping'] }) // weak for evening
    const ctx = makeContext({ timeOfDay: 'evening', weather: 'sunny', paidPlaceIds: new Set([paid.id]) })

    const result = scoreCandidate(paid, ctx)
    expect(result.isSponsored).toBe(true)
    expect(result.commercialScore).toBeGreaterThanOrEqual(70)
    // Context is low but totalScore is still positive due to commercial
    expect(result.totalScore).toBeGreaterThan(0)
  })

  it('3️⃣ paid with NO tags → still appears (commercial + quality carry it)', () => {
    const paid = makeCandidate({ context_tag_slugs: [] })
    const ctx = makeContext({ timeOfDay: 'evening', weather: 'sunny', paidPlaceIds: new Set([paid.id]) })

    const result = scoreCandidate(paid, ctx)
    expect(result.isSponsored).toBe(true)
    expect(result.contextScore).toBe(0) // no tags = no context score
    expect(result.commercialScore).toBeGreaterThanOrEqual(70)
    expect(result.totalScore).toBeGreaterThan(0)
  })

  it('4️⃣ organic with excellent tags cannot displace paid from visibility floor', () => {
    const paid = makeCandidate({ id: 'paid', context_tag_slugs: [] })
    const organic = makeCandidate({ id: 'organic', context_tag_slugs: ['dinner', 'romantic', 'fine-dining', 'sunset'], popularity_score: 95 })

    const ctx = makeContext({ timeOfDay: 'evening', weather: 'sunny', paidPlaceIds: new Set([paid.id]) })

    const paidResult = scoreCandidate(paid, ctx)
    const organicResult = scoreCandidate(organic, ctx)

    // Organic may outscore paid in totalScore...
    // (that's fine — the visibility floor in selectTopN guarantees paid appears)
    expect(organicResult.contextScore).toBeGreaterThan(paidResult.contextScore)

    // But selectTopN must include the paid placement
    const ranked = [organicResult, paidResult].sort((a, b) => b.totalScore - a.totalScore)
    const selected = selectTopN(ranked, 3)
    const paidInResult = selected.some((r) => r.place.id === 'paid')
    expect(paidInResult).toBe(true)
  })

  it('diversity rules never penalize paid placements', () => {
    const paid = scoreCandidate(
      makeCandidate({ id: 'paid', place_type: 'restaurant' }),
      makeContext({ paidPlaceIds: new Set(['paid']) }),
    )
    const organic1 = scoreCandidate(
      makeCandidate({ id: 'org1', place_type: 'restaurant' }),
      makeContext(),
    )
    const organic2 = scoreCandidate(
      makeCandidate({ id: 'org2', place_type: 'restaurant' }),
      makeContext(),
    )
    const organic3 = scoreCandidate(
      makeCandidate({ id: 'org3', place_type: 'bar', context_tag_slugs: ['cocktails'] }),
      makeContext(),
    )

    // Place paid between two same-type organics
    const sorted = [organic1, paid, organic2, organic3]
    const diversified = applyDiversityRules(sorted)

    // Paid placement should NOT have been penalized
    const paidAfter = diversified.find((r) => r.place.id === 'paid')!
    expect(paidAfter.totalScore).toBe(paid.totalScore)
  })
})

// ─── Intent compatibility scenarios ──────────────────────────────────────────

describe('Intent compatibility — paid placements with mismatch', () => {
  it('compatible: wine bar for romantic dinner → small penalty (tag overlap)', () => {
    // Wine bar has tags that overlap with romantic_dinner intent tags
    const wineBar = makeCandidate({
      id: 'wine-bar', place_type: 'bar',
      context_tag_slugs: ['wine', 'romantic', 'terrace'],
    })
    // romantic_dinner intent tags: romantic, date-night, atmospheric, fine-dining, intimate
    const intentTags = ['romantic', 'date-night', 'atmospheric', 'fine-dining', 'intimate']
    const ctx = makeContext({
      timeOfDay: 'evening',
      paidPlaceIds: new Set(['wine-bar']),
      intentTags,
    })

    const result = scoreCandidate(wineBar, ctx)
    // Has tag overlap ('romantic') so context score should be decent
    expect(result.contextScore).toBeGreaterThan(0)
    // Total should be healthy due to commercial + context overlap
    expect(result.totalScore).toBeGreaterThan(15)
  })

  it('incompatible: late-night cocktail bar for family brunch → ranks low', () => {
    const cocktailBar = makeCandidate({
      id: 'cocktail-bar', place_type: 'bar',
      context_tag_slugs: ['late-night', 'cocktails', 'live-music'],
    })
    const brunchPlace = makeCandidate({
      id: 'brunch-place', place_type: 'restaurant',
      context_tag_slugs: ['brunch', 'family', 'coffee'],
    })

    // Morning context — brunch is highly relevant, late-night is not
    const ctx = makeContext({ timeOfDay: 'morning', weather: 'sunny' })

    const barScore = scoreCandidate(cocktailBar, ctx)
    const brunchScore = scoreCandidate(brunchPlace, ctx)

    // Brunch place should score much higher than cocktail bar in morning
    expect(brunchScore.contextScore).toBeGreaterThan(barScore.contextScore)
    // Even without the intent penalty, the context score alone pushes bar down
    expect(brunchScore.totalScore).toBeGreaterThan(barScore.totalScore)
  })

  it('strongly incompatible paid bar still scores > 0 (not eliminated)', () => {
    const lateBar = makeCandidate({
      id: 'late-bar', place_type: 'bar',
      context_tag_slugs: ['late-night', 'cocktails'],
    })
    const ctx = makeContext({
      timeOfDay: 'morning',
      weather: 'sunny',
      paidPlaceIds: new Set(['late-bar']),
    })

    const result = scoreCandidate(lateBar, ctx)
    // Should still have positive total (commercial carries it)
    expect(result.totalScore).toBeGreaterThan(0)
    expect(result.isSponsored).toBe(true)
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

// ─── 5. Diversity + Visibility Floor interaction ────────────────────────────

describe('Diversity + paid placement injection interaction', () => {
  it('morning brunch: café, restaurant, then paid bar — diverse types preserved', () => {
    const ctx = makeContext({ timeOfDay: 'morning', weather: 'sunny' })
    const paidCtx = makeContext({
      timeOfDay: 'morning', weather: 'sunny',
      paidPlaceIds: new Set(['paid-bar']),
    })

    // Score organics (high context for morning)
    const cafe = scoreCandidate(
      makeCandidate({ id: 'cafe-1', place_type: 'cafe', context_tag_slugs: ['brunch', 'coffee'], popularity_score: 70 }),
      ctx,
    )
    const restaurant = scoreCandidate(
      makeCandidate({ id: 'rest-1', place_type: 'restaurant', context_tag_slugs: ['brunch', 'family'], popularity_score: 60 }),
      ctx,
    )
    // Paid bar (low context for morning, but commercial carries it)
    const paidBar = scoreCandidate(
      makeCandidate({ id: 'paid-bar', place_type: 'bar', context_tag_slugs: ['cocktails', 'late-night'] }),
      paidCtx,
    )

    // Organic brunch places should outscore the paid bar in context
    expect(cafe.contextScore).toBeGreaterThan(paidBar.contextScore)
    expect(restaurant.contextScore).toBeGreaterThan(paidBar.contextScore)

    // Simulate the Concierge pipeline: score → diversity → visibility floor → dedup
    const sorted = [cafe, restaurant, paidBar].sort((a, b) => b.totalScore - a.totalScore)
    const diversified = applyDiversityRules(sorted) // ≤3, so diversity is skipped (relaxed)

    // Verify no duplicates
    const ids = diversified.map((r) => r.place.id)
    expect(new Set(ids).size).toBe(ids.length) // no duplicates

    // Verify all 3 different place_types present
    const types = diversified.map((r) => r.place.place_type)
    expect(new Set(types).size).toBe(3) // cafe, restaurant, bar — all different

    // Verify paid bar is last (lowest context score)
    const barIdx = diversified.findIndex((r) => r.place.id === 'paid-bar')
    expect(barIdx).toBe(2) // position 3 (index 2)
  })

  it('paid injection does not create duplicates', () => {
    const ctx = makeContext({ paidPlaceIds: new Set(['cafe-1']) })

    const cafe = scoreCandidate(
      makeCandidate({ id: 'cafe-1', place_type: 'cafe', context_tag_slugs: ['coffee'] }),
      ctx,
    )
    const rest = scoreCandidate(
      makeCandidate({ id: 'rest-1', place_type: 'restaurant', context_tag_slugs: ['dinner'] }),
      makeContext(),
    )

    // Simulate: cafe already in results, then selectTopN tries to add it again
    const ranked = [rest, cafe]
    const selected = selectTopN(ranked, 3)

    // No duplicate IDs
    const ids = selected.map((r) => r.place.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('with 5+ candidates, diversity penalizes adjacent same-type but not paid', () => {
    const ctx = makeContext({ paidPlaceIds: new Set(['paid-rest']) })

    const rest1 = scoreCandidate(makeCandidate({ id: 'r1', place_type: 'restaurant', context_tag_slugs: ['dinner'], popularity_score: 80 }), makeContext())
    const paidRest = scoreCandidate(makeCandidate({ id: 'paid-rest', place_type: 'restaurant', context_tag_slugs: ['dinner'] }), ctx)
    const rest2 = scoreCandidate(makeCandidate({ id: 'r2', place_type: 'restaurant', context_tag_slugs: ['dinner'], popularity_score: 40 }), makeContext())
    const bar = scoreCandidate(makeCandidate({ id: 'b1', place_type: 'bar', context_tag_slugs: ['cocktails'] }), makeContext())
    const cafe = scoreCandidate(makeCandidate({ id: 'c1', place_type: 'cafe', context_tag_slugs: ['coffee'] }), makeContext())

    const sorted = [rest1, paidRest, rest2, bar, cafe]
    const diversified = applyDiversityRules(sorted)

    // Paid restaurant should NOT be penalized
    const paidAfter = diversified.find((r) => r.place.id === 'paid-rest')!
    expect(paidAfter.totalScore).toBe(paidRest.totalScore)

    // But organic rest2 (adjacent same type after paid) SHOULD be penalized
    const rest2After = diversified.find((r) => r.place.id === 'r2')!
    expect(rest2After.totalScore).toBeLessThan(rest2.totalScore)
  })
})

// ─── 6. Basic diversity tests ────────────────────────────────────────────────

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
