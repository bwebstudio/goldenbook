#!/usr/bin/env tsx
/**
 * measure-translation-scope.ts
 *
 * Read-only. Counts how many place_translations rows need a quality pass,
 * broken down by locale and by "literalness" heuristics so we can plan
 * batching and cost accurately before spending LLM tokens.
 */

import { Pool } from 'pg'

// Literal DeepL-from-EN tells:
//   ES: "una dirección ideal para", "se encuentra ubicado", "cuenta con", "proporcionando"
//   EN: "located in", "is an ideal destination for" (often direct from ES calques)
// These match patterns that DeepL spits out when translating word-for-word.
const ES_LITERAL_MARKERS = [
  'una dirección ideal',
  'ubicado en el',
  'se encuentra ubicad',
  'cuenta con una',
  'proporcionando una',
  'ofrece una experiencia',
  'a lo largo de la costa',
]
const EN_LITERAL_MARKERS = [
  'located in the',
  'provides an experience',
  'features a',
  'is an ideal destination',
  'is the ideal place',
]
const PT_LITERAL_MARKERS = [
  'está localizado no',
  'oferece uma experiência',
  'proporcionando uma',
  'a sua equipa',
]

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })

  // Totals
  const { rows: totals } = await pool.query<{ locale: string; n: string }>(
    `SELECT locale, COUNT(*)::text AS n FROM place_translations GROUP BY locale ORDER BY locale`,
  )

  // is_override / source breakdown
  const { rows: provenance } = await pool.query<{ locale: string; source: string; is_override: boolean; n: string }>(
    `SELECT locale, source, is_override, COUNT(*)::text AS n
       FROM place_translations GROUP BY locale, source, is_override
       ORDER BY locale, source, is_override`,
  )

  // Filled-ness: how many rows have non-empty editorial content
  const { rows: content } = await pool.query<{
    locale: string; with_short: string; with_full: string; with_note: string; with_tip: string; total: string
  }>(
    `SELECT locale,
            COUNT(*) FILTER (WHERE COALESCE(short_description,'') <> '')::text AS with_short,
            COUNT(*) FILTER (WHERE COALESCE(full_description,'')  <> '')::text AS with_full,
            COUNT(*) FILTER (WHERE COALESCE(goldenbook_note,'')   <> '')::text AS with_note,
            COUNT(*) FILTER (WHERE COALESCE(insider_tip,'')       <> '')::text AS with_tip,
            COUNT(*)::text AS total
       FROM place_translations GROUP BY locale ORDER BY locale`,
  )

  // Literal-marker counts — rows that contain at least one DeepL-literal phrase
  async function countLiteral(locale: 'en' | 'es' | 'pt', markers: string[]) {
    const ors = markers.map((_, i) => `(
         LOWER(COALESCE(full_description,''))  LIKE $${i + 2}
      OR LOWER(COALESCE(short_description,'')) LIKE $${i + 2}
      OR LOWER(COALESCE(goldenbook_note,''))   LIKE $${i + 2}
      OR LOWER(COALESCE(insider_tip,''))       LIKE $${i + 2}
    )`).join(' OR ')
    const params = [locale, ...markers.map(m => `%${m.toLowerCase()}%`)]
    const { rows } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM place_translations WHERE locale = $1 AND (${ors})`,
      params,
    )
    return Number(rows[0]?.n ?? 0)
  }
  const literalEs = await countLiteral('es', ES_LITERAL_MARKERS)
  const literalEn = await countLiteral('en', EN_LITERAL_MARKERS)
  const literalPt = await countLiteral('pt', PT_LITERAL_MARKERS)

  // Rows that would be re-translated under the policy we propose:
  //   is_override = false AND source IN ('manual','deepl','import')
  //   (skip rows already marked 'manual_fix' — those are already human-curated)
  const { rows: eligible } = await pool.query<{ locale: string; n: string }>(
    `SELECT locale, COUNT(*)::text AS n
       FROM place_translations
      WHERE is_override = false
        AND source IN ('manual','deepl','import')
      GROUP BY locale ORDER BY locale`,
  )

  // Total character load (roughly, input tokens for an LLM)
  const { rows: charLoad } = await pool.query<{ locale: string; chars: string }>(
    `SELECT locale,
            SUM(LENGTH(COALESCE(short_description,'')) +
                LENGTH(COALESCE(full_description,'')) +
                LENGTH(COALESCE(goldenbook_note,'')) +
                LENGTH(COALESCE(insider_tip,'')))::text AS chars
       FROM place_translations
      WHERE is_override = false AND source IN ('manual','deepl','import')
      GROUP BY locale ORDER BY locale`,
  )

  // ── Report ──
  console.log('\n━━━ Totals per locale ━━━')
  for (const r of totals) console.log(`  ${r.locale}: ${r.n} rows`)

  console.log('\n━━━ Content fill per locale ━━━')
  for (const r of content) {
    console.log(`  ${r.locale}  (${r.total} rows):  short=${r.with_short}  full=${r.with_full}  note=${r.with_note}  tip=${r.with_tip}`)
  }

  console.log('\n━━━ Provenance (source / is_override) ━━━')
  for (const r of provenance) {
    console.log(`  ${r.locale}  source=${r.source.padEnd(11)}  is_override=${r.is_override}  →  ${r.n}`)
  }

  console.log('\n━━━ Literal-marker hits (rough calque detection) ━━━')
  console.log(`  ES rows with literal markers: ${literalEs}`)
  console.log(`  EN rows with literal markers: ${literalEn}`)
  console.log(`  PT rows with literal markers: ${literalPt}`)

  console.log('\n━━━ Eligible for re-translation (is_override=false AND source ∈ {manual,deepl,import}) ━━━')
  let totalEligible = 0, totalChars = 0
  for (const r of eligible) {
    const chars = Number(charLoad.find(c => c.locale === r.locale)?.chars ?? 0)
    totalEligible += Number(r.n)
    totalChars += chars
    console.log(`  ${r.locale}: ${r.n} rows, ~${chars.toLocaleString()} chars of editorial content`)
  }
  console.log(`\n  Total eligible: ${totalEligible} rows, ~${totalChars.toLocaleString()} chars`)

  // Very rough token estimate: 1 char ≈ 0.3 tokens for romance languages
  const inputTokens  = Math.round(totalChars * 0.3)
  const outputTokens = Math.round(totalChars * 0.3)   // output ~= input for translation
  // Claude Sonnet 4.6 pricing: $3/M input, $15/M output
  const cost = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
  console.log(`\n  Est. token load: ~${(inputTokens / 1000).toFixed(0)}k input + ~${(outputTokens / 1000).toFixed(0)}k output`)
  console.log(`  Est. cost (Claude Sonnet 4.6): ~$${cost.toFixed(2)}`)

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
