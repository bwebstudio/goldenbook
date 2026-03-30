#!/usr/bin/env npx tsx
// ─── Generate Reservation Suggestions ────────────────────────────────────────
//
// Usage:
//   npx tsx scripts/generate-suggestions.ts              # all places
//   npx tsx scripts/generate-suggestions.ts --missing    # only places without suggestions
//   npx tsx scripts/generate-suggestions.ts --refresh    # only heuristic_v1 suggestions
//   npx tsx scripts/generate-suggestions.ts --place <id> # single place by UUID
//
// Requires DATABASE_URL in .env or environment.

import { generateSuggestions } from '../api/src/modules/admin/suggestions/admin-suggestions.query'

async function main() {
  const args = process.argv.slice(2)

  let placeId: string | undefined
  let onlyMissing = false
  let onlySource: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--missing') onlyMissing = true
    else if (args[i] === '--refresh') onlySource = 'heuristic_v1'
    else if (args[i] === '--place' && args[i + 1]) placeId = args[++i]
  }

  console.log('Generating reservation suggestions...')
  if (placeId) console.log(`  Place: ${placeId}`)
  if (onlyMissing) console.log('  Filter: only missing')
  if (onlySource) console.log(`  Filter: source = ${onlySource}`)
  console.log('')

  const results = await generateSuggestions({ placeId, onlyMissing, onlySource })

  // Summary
  const relevant = results.filter(r => r.suggestion.relevant)
  const notRelevant = results.filter(r => !r.suggestion.relevant)
  const highConf = results.filter(r => r.suggestion.confidence >= 0.75)
  const medConf = results.filter(r => r.suggestion.confidence >= 0.50 && r.suggestion.confidence < 0.75)
  const lowConf = results.filter(r => r.suggestion.confidence < 0.50)

  console.log(`Total: ${results.length} places processed`)
  console.log(`  Reservation relevant: ${relevant.length}`)
  console.log(`  Not relevant: ${notRelevant.length}`)
  console.log(`  High confidence (>=75%): ${highConf.length}`)
  console.log(`  Medium confidence (50-74%): ${medConf.length}`)
  console.log(`  Low confidence (<50%): ${lowConf.length}`)
  console.log('')

  // Mode breakdown
  const byMode = new Map<string, number>()
  for (const r of results) {
    const mode = r.suggestion.suggestedMode
    byMode.set(mode, (byMode.get(mode) ?? 0) + 1)
  }
  console.log('By suggested mode:')
  for (const [mode, count] of [...byMode.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${mode}: ${count}`)
  }
  console.log('')

  // Show first 10 detailed results
  const preview = results.slice(0, 10)
  console.log(`Preview (first ${preview.length}):`)
  for (const r of preview) {
    const s = r.suggestion
    const confPct = Math.round(s.confidence * 100)
    const icon = s.relevant ? '+' : '-'
    console.log(`  ${icon} ${r.placeName} → ${s.suggestedMode} (${confPct}%) [${s.reason}: ${s.reasonDetail}]`)
  }
  if (results.length > 10) {
    console.log(`  ... and ${results.length - 10} more`)
  }

  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
