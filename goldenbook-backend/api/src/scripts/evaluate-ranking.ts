#!/usr/bin/env tsx
// ─── Ranking Evaluation Harness ───────────────────────────────────────────
//
// Tests the ranking engine against curated test cases and generates a report.
//
// Usage:
//   npx tsx api/src/scripts/evaluate-ranking.ts
//
// Output: ranking-evaluation-report.json

import { db } from '../db/postgres'
import { getCandidates } from '../modules/recommendations/recommendations.query'
import { rank, type Surface } from '../modules/recommendations/recommendations.engine'
import { parseIntent, resolveIntent } from '../modules/recommendations/intent-engine'

// ─── Test cases ───────────────────────────────────────────────────────────

interface TestCase {
  id: string
  description: string
  city: string
  time: string
  intent?: string
  budget?: string
  category?: string
  surface?: Surface
  lat?: number
  lng?: number
  limit: number
  // Expected: what a human reviewer would want to see
  expectTypes?: string[]       // place_types that SHOULD appear
  expectNotTypes?: string[]    // place_types that should NOT dominate
  expectMinResults?: number
  expectTopCategory?: string   // expected category of #1 result
}

const TEST_CASES: TestCase[] = [
  // ── Dining ────────────────────────────────────────────────────────────
  {
    id: 'dinner-porto-evening',
    description: 'Dinner in Porto at 20:00',
    city: 'porto', time: '20:00', intent: 'dinner', surface: 'concierge', limit: 5,
    expectTypes: ['restaurant'], expectTopCategory: 'gastronomy', expectMinResults: 5,
  },
  {
    id: 'romantic-lisboa-expensive',
    description: 'Romantic dinner €€€€ in Lisboa',
    city: 'lisboa', time: '20:30', intent: 'romantic', budget: '€€€€', surface: 'concierge', limit: 5,
    expectTypes: ['restaurant'], expectTopCategory: 'gastronomy', expectMinResults: 3,
  },
  {
    id: 'lunch-algarve-midday',
    description: 'Lunch in Algarve at 12:30',
    city: 'algarve', time: '12:30', intent: 'lunch', surface: 'now', limit: 5,
    expectTypes: ['restaurant', 'cafe'], expectTopCategory: 'gastronomy', expectMinResults: 5,
  },
  {
    id: 'breakfast-madeira',
    description: 'Breakfast in Madeira at 09:00',
    city: 'madeira', time: '09:00', intent: 'breakfast', surface: 'now', limit: 5,
    expectTypes: ['cafe', 'restaurant'], expectMinResults: 2,
  },

  // ── Drinks & Nightlife ────────────────────────────────────────────────
  {
    id: 'drinks-porto-night',
    description: 'Drinks in Porto at 22:30',
    city: 'porto', time: '22:30', intent: 'drinks', surface: 'concierge', limit: 5,
    expectTypes: ['bar', 'restaurant'], expectMinResults: 3,
  },
  {
    id: 'late-night-lisboa',
    description: 'Late night in Lisboa at 23:30',
    city: 'lisboa', time: '23:30', intent: 'late-night', surface: 'concierge', limit: 5,
    expectTypes: ['bar', 'restaurant'], expectMinResults: 3,
  },

  // ── Culture ───────────────────────────────────────────────────────────
  {
    id: 'culture-porto-morning',
    description: 'Culture in Porto at 10:00',
    city: 'porto', time: '10:00', intent: 'culture', category: 'culture', surface: 'concierge', limit: 5,
    expectTypes: ['museum', 'landmark'], expectTopCategory: 'culture', expectMinResults: 3,
  },
  {
    id: 'rainy-day-lisboa',
    description: 'Rainy day in Lisboa at 14:00',
    city: 'lisboa', time: '14:00', intent: 'rainy-day', surface: 'concierge', limit: 5,
    expectTypes: ['museum', 'shop', 'landmark'], expectMinResults: 3,
  },

  // ── Nature ────────────────────────────────────────────────────────────
  {
    id: 'sunset-algarve',
    description: 'Sunset in Algarve at 18:30',
    city: 'algarve', time: '18:30', intent: 'sunset', surface: 'concierge', limit: 5,
    expectMinResults: 3,
  },
  {
    id: 'sunset-madeira',
    description: 'Sunset in Madeira at 17:30',
    city: 'madeira', time: '17:30', intent: 'sunset', surface: 'concierge', limit: 5,
    expectMinResults: 3,
  },

  // ── Shopping ──────────────────────────────────────────────────────────
  {
    id: 'shopping-porto-afternoon',
    description: 'Shopping in Porto at 15:00',
    city: 'porto', time: '15:00', intent: 'shopping', surface: 'concierge', limit: 5,
    expectTypes: ['shop'], expectTopCategory: 'retail', expectMinResults: 5,
  },

  // ── General / no intent ───────────────────────────────────────────────
  {
    id: 'where-now-porto-afternoon',
    description: 'Where now? Porto at 15:00 (no intent)',
    city: 'porto', time: '15:00', surface: 'now', limit: 6,
    expectMinResults: 5, expectNotTypes: ['transport'],
  },
  {
    id: 'where-now-lisboa-evening',
    description: 'Where now? Lisboa at 19:00 (no intent)',
    city: 'lisboa', time: '19:00', surface: 'now', limit: 6,
    expectMinResults: 5,
  },

  // ── NOW vs Concierge comparison ───────────────────────────────────────
  {
    id: 'dinner-porto-NOW',
    description: 'Dinner Porto — NOW surface (distance-heavy)',
    city: 'porto', time: '20:00', intent: 'dinner', surface: 'now',
    lat: 41.1496, lng: -8.6109, limit: 5,
    expectTypes: ['restaurant'], expectMinResults: 5,
  },
  {
    id: 'dinner-porto-CONCIERGE',
    description: 'Dinner Porto — Concierge surface (quality-heavy)',
    city: 'porto', time: '20:00', intent: 'dinner', surface: 'concierge',
    lat: 41.1496, lng: -8.6109, limit: 5,
    expectTypes: ['restaurant'], expectMinResults: 5,
  },
]

// ─── Intent Engine test cases ─────────────────────────────────────────────

interface IntentTestCase {
  query: string
  expectedIntent: string | null
  expectedBudget: string | null
  expectedCategory: string | null
}

const INTENT_TESTS: IntentTestCase[] = [
  { query: 'algo romántico para esta noche',       expectedIntent: 'romantic',   expectedBudget: '€€€',  expectedCategory: null },
  { query: 'un sitio tranquilo para almorzar',     expectedIntent: 'lunch',      expectedBudget: null,    expectedCategory: 'gastronomy' },
  { query: 'algo especial con vistas',             expectedIntent: 'viewpoint',  expectedBudget: '€€€',  expectedCategory: null },
  { query: 'where to have dinner',                 expectedIntent: 'dinner',     expectedBudget: null,    expectedCategory: 'gastronomy' },
  { query: 'museum near me',                       expectedIntent: 'culture',    expectedBudget: null,    expectedCategory: 'culture' },
  { query: 'sunset today',                         expectedIntent: 'sunset',     expectedBudget: null,    expectedCategory: null },
  { query: 'where to go when it rains',            expectedIntent: 'rainy-day',  expectedBudget: null,    expectedCategory: null },
  { query: 'quiero comprar ropa',                  expectedIntent: 'shopping',   expectedBudget: null,    expectedCategory: 'retail' },
  { query: 'family friendly afternoon',            expectedIntent: 'family',     expectedBudget: null,    expectedCategory: null },
  { query: 'fine dining celebration',              expectedIntent: 'fine-dining', expectedBudget: '€€€€', expectedCategory: 'gastronomy' },
  { query: 'hidden gem in porto',                  expectedIntent: 'hidden-gem', expectedBudget: null,    expectedCategory: null },
  { query: 'spa and wellness',                     expectedIntent: 'wellness',   expectedBudget: null,    expectedCategory: 'experiences' },
]

// ─── Evaluation ───────────────────────────────────────────────────────────

interface TestResult {
  id: string
  description: string
  passed: boolean
  failures: string[]
  results: { name: string; placeType: string; category: string | null; score: number; reason: string[] }[]
  meta: { window: string; candidatesTotal: number; candidatesFiltered: number }
}

async function runRankingTests(): Promise<TestResult[]> {
  const results: TestResult[] = []

  for (const tc of TEST_CASES) {
    const candidates = await getCandidates(tc.city, 'pt')
    const output = rank({
      candidates,
      time: tc.time,
      intent: tc.intent,
      budget: tc.budget,
      category: tc.category,
      userLat: tc.lat,
      userLng: tc.lng,
      limit: tc.limit,
      surface: tc.surface,
    })

    const failures: string[] = []

    // Check minimum results
    if (tc.expectMinResults && output.results.length < tc.expectMinResults) {
      failures.push(`Expected ≥${tc.expectMinResults} results, got ${output.results.length}`)
    }

    // Check expected types appear
    if (tc.expectTypes && output.results.length > 0) {
      const topTypes = new Set(output.results.map(r => r.placeType))
      const missing = tc.expectTypes.filter(t => !topTypes.has(t))
      if (missing.length === tc.expectTypes.length) {
        failures.push(`None of expected types [${tc.expectTypes}] found in results. Got: [${[...topTypes]}]`)
      }
    }

    // Check NOT types don't dominate
    if (tc.expectNotTypes && output.results.length > 0) {
      for (const notType of tc.expectNotTypes) {
        const count = output.results.filter(r => r.placeType === notType).length
        if (count > output.results.length / 2) {
          failures.push(`Type '${notType}' dominates results (${count}/${output.results.length})`)
        }
      }
    }

    // Check top category
    if (tc.expectTopCategory && output.results.length > 0) {
      const topCat = output.results[0].category
      if (topCat !== tc.expectTopCategory) {
        failures.push(`Expected top category '${tc.expectTopCategory}', got '${topCat}' (${output.results[0].name})`)
      }
    }

    results.push({
      id: tc.id,
      description: tc.description,
      passed: failures.length === 0,
      failures,
      results: output.results.map(r => ({
        name: r.name, placeType: r.placeType, category: r.category, score: r.score, reason: r.reason,
      })),
      meta: { window: output.window, candidatesTotal: output.candidatesTotal, candidatesFiltered: output.candidatesFiltered },
    })
  }

  return results
}

function runIntentTests(): { passed: number; failed: number; details: string[] } {
  let passed = 0
  let failed = 0
  const details: string[] = []

  for (const tc of INTENT_TESTS) {
    const parsed = parseIntent(tc.query)
    const resolved = resolveIntent(parsed)
    const errors: string[] = []

    if (tc.expectedIntent && parsed.intent !== tc.expectedIntent) {
      errors.push(`intent: expected '${tc.expectedIntent}', got '${parsed.intent}'`)
    }
    if (tc.expectedBudget && parsed.budget !== tc.expectedBudget) {
      errors.push(`budget: expected '${tc.expectedBudget}', got '${parsed.budget}'`)
    }
    if (tc.expectedCategory && parsed.category !== tc.expectedCategory) {
      errors.push(`category: expected '${tc.expectedCategory}', got '${parsed.category}'`)
    }

    if (errors.length === 0) {
      passed++
    } else {
      failed++
      details.push(`FAIL "${tc.query}" → ${errors.join('; ')}`)
    }
  }

  return { passed, failed, details }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Ranking Evaluation Harness')
  console.log(`${'═'.repeat(60)}\n`)

  // Intent Engine tests
  console.log('── Intent Engine Tests ──────────────────────────────')
  const intentResults = runIntentTests()
  console.log(`  Passed: ${intentResults.passed}/${intentResults.passed + intentResults.failed}`)
  for (const d of intentResults.details) console.log(`  ${d}`)

  // Ranking tests
  console.log('\n── Ranking Tests ────────────────────────────────────')
  const rankResults = await runRankingTests()

  let passedRanking = 0
  let failedRanking = 0

  for (const r of rankResults) {
    if (r.passed) {
      passedRanking++
      console.log(`  ✓ ${r.id}`)
    } else {
      failedRanking++
      console.log(`  ✗ ${r.id}`)
      for (const f of r.failures) console.log(`    → ${f}`)
    }
    // Show top 3 results
    for (const res of r.results.slice(0, 3)) {
      console.log(`    ${res.score} | ${res.name} [${res.placeType}] — ${res.reason.slice(0, 3).join(', ')}`)
    }
  }

  // NOW vs Concierge comparison
  console.log('\n── NOW vs Concierge Comparison ──────────────────────')
  const nowTest = rankResults.find(r => r.id === 'dinner-porto-NOW')
  const conTest = rankResults.find(r => r.id === 'dinner-porto-CONCIERGE')
  if (nowTest && conTest) {
    console.log('  NOW top 3:')
    for (const r of nowTest.results.slice(0, 3)) console.log(`    ${r.score} | ${r.name} — ${r.reason.slice(0, 2).join(', ')}`)
    console.log('  Concierge top 3:')
    for (const r of conTest.results.slice(0, 3)) console.log(`    ${r.score} | ${r.name} — ${r.reason.slice(0, 2).join(', ')}`)

    // Check they differ
    const nowNames = new Set(nowTest.results.slice(0, 3).map(r => r.name))
    const conNames = new Set(conTest.results.slice(0, 3).map(r => r.name))
    const overlap = [...nowNames].filter(n => conNames.has(n)).length
    console.log(`  Overlap: ${overlap}/3 (${overlap < 3 ? 'good diversity' : 'surfaces may be too similar'})`)
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  EVALUATION SUMMARY')
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Intent Engine:  ${intentResults.passed}/${intentResults.passed + intentResults.failed} passed`)
  console.log(`  Ranking:        ${passedRanking}/${passedRanking + failedRanking} passed`)
  console.log(`${'═'.repeat(60)}\n`)

  // Write report
  const fs = await import('fs')
  const report = {
    timestamp: new Date().toISOString(),
    intentEngine: intentResults,
    ranking: rankResults.map(r => ({
      id: r.id, description: r.description, passed: r.passed, failures: r.failures,
      topResults: r.results.slice(0, 5),
      meta: r.meta,
    })),
    summary: {
      intentPassed: intentResults.passed,
      intentFailed: intentResults.failed,
      rankingPassed: passedRanking,
      rankingFailed: failedRanking,
    },
  }
  fs.writeFileSync('./ranking-evaluation-report.json', JSON.stringify(report, null, 2))
  console.log('Report: ranking-evaluation-report.json\n')

  await db.end()
}

main().catch(e => { console.error(e); process.exit(1) })
