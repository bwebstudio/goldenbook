#!/usr/bin/env tsx
/**
 * retranslate-all.ts
 *
 * Regenerates the PT, EN, and ES translations of every place whose
 * translation rows are still machine-generated
 * (`source='manual' AND is_override=false`) using Claude Sonnet 4.6.
 *
 * No locale is treated as canonical. The LLM receives all three existing
 * versions (PT + EN + ES) as fact-context for each place, then produces
 * fresh editorial rewrites in each target locale. Information that exists
 * in one locale but not another survives via the LLM's synthesis.
 *
 * Design:
 *   • Skip rows that are already `manual_fix` (human-curated).
 *   • Batches of 20 places per API call. The large editorial style guide
 *     sits in the system prompt with cache_control; cache hits kick in from
 *     the second batch onward (~20x cheaper for that chunk).
 *   • Structured output via Zod — no free-form parsing.
 *   • Per-field validation after the LLM returns: franc detects target
 *     language, diacritic markers confirm pt-PT vs es.
 *   • Output goes to a staging CSV so the user can sample-review before
 *     anything is written to the DB.
 *
 * Usage:
 *   cd goldenbook-backend/api
 *   npx tsx --env-file=../.env ../scripts/retranslate-all.ts              # sample (3 places, dry-run)
 *   npx tsx --env-file=../.env ../scripts/retranslate-all.ts --all        # full batch
 *   npx tsx --env-file=../.env ../scripts/retranslate-all.ts --apply      # writes staging csv; no DB touch either way
 *
 * Apply is a separate step: scripts/apply-retranslations.ts reads the
 * staging CSV and UPSERTs inside one transaction.
 */

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { writeFileSync, existsSync, readFileSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool } from 'pg'
import { franc } from 'franc'

const SAMPLE_MODE = !process.argv.includes('--all')
const SAMPLE_SIZE = 3
const BATCH_SIZE  = 10  // was 20 — smaller batches avoid JSON truncation at max_tokens
const RESET       = process.argv.includes('--reset')

const OUT_CSV = resolve(__dirname, '..', 'retranslated_staging.csv')

const CSV_HEADER = [
  'place_id','place_slug','translation_id','locale','field',
  'existing_text','corrected_text','verdict','notes',
].join(',')

/** Places already in the staging CSV — skip them on resume. */
function loadDonePlaces(): Set<string> {
  const done = new Set<string>()
  if (!existsSync(OUT_CSV)) return done
  try {
    const text = readFileSync(OUT_CSV, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.shift()  // header
    for (const line of lines) {
      const firstComma = line.indexOf(',')
      if (firstComma > 0) {
        const placeId = line.slice(0, firstComma).replace(/^"|"$/g, '')
        if (/^[0-9a-f-]{36}$/.test(placeId)) done.add(placeId)
      }
    }
  } catch {}
  return done
}

// ─── Types ─────────────────────────────────────────────────────────────────

type Locale = 'en' | 'es' | 'pt'

interface LocaleFields {
  name: string
  short_description: string | null
  full_description: string | null
  goldenbook_note: string | null
  insider_tip: string | null
  is_override: boolean
  source: string
}

interface PlaceInput {
  place_id: string
  slug: string
  translation_ids: { pt: string; en: string | null; es: string | null }
  existing: { pt: LocaleFields; en: LocaleFields | null; es: LocaleFields | null }
  // Locales eligible for rewrite (skip if is_override=true / source='manual_fix')
  targets: Array<'pt' | 'en' | 'es'>
}

// ─── Zod schema for the model's structured output ─────────────────────────

const FieldsSchema = z.object({
  short_description: z.string().nullable(),
  full_description:  z.string().nullable(),
  goldenbook_note:   z.string().nullable(),
  insider_tip:       z.string().nullable(),
})
const ItemSchema = z.object({
  place_id: z.string(),
  pt: FieldsSchema,
  en: FieldsSchema,
  es: FieldsSchema,
})
const BatchSchema = z.object({ translations: z.array(ItemSchema) })

// ─── Style guide (system prompt, cached) ───────────────────────────────────
// Designed to be STABLE across runs. Any edit here invalidates the cache —
// keep volatile context (the batch of places) in the user message.

const STYLE_GUIDE = `You are Goldenbook's editorial translator. Goldenbook is a premium travel guide for Portugal — its audience expects refined, concise, travel-guide prose.

Your job: given a place's existing editorial content across pt-PT, English, and Spanish (some versions may be poorly translated, flat, or literal), produce three fresh editorial rewrites — one per locale. None of the three existing versions is a fixed source of truth: they are a FACT POOL. If one locale has a detail the others lack, the detail survives in all three rewrites. If all three are literal or awkward, rewrite from scratch in editorial voice.

# Style rules per locale

## English (en)
- International travel-guide register. Neutral, confident, descriptive.
- NO contractions in long-form copy ("it is", not "it's").
- Avoid Americanisms (color → colour? use colour for international) AND Britishisms. Aim for register that reads well in both markets.
- Measurements in metric.
- PRESERVE Portuguese place names, street names, dish names, venue names untouched. "pastéis de nata" stays as "pastéis de nata", not "custard tarts". "Porto" stays as "Porto", not "Oporto". "Funchal", "Lisboa"/"Lisbon" — keep the locally known form.
- Brand names unchanged: "El Corte Inglés", "Quinta Magnólia", "Wine Tours Madeira".
- Use em-dashes (—) sparingly for editorial rhythm.

## Spanish peninsular (es)
- EDITORIAL AND NATURAL, never literal.
- Avoid English-calque structures:
  - "una dirección ideal para" → "un imprescindible para"
  - "ubicado en" → "en pleno" or "a orillas de" or a descriptive phrase
  - "cuenta con" → just describe the feature directly
  - "ofrece una experiencia" → use something concrete
  - "proporcionando" → cut it, restructure the sentence
- Peninsular vocabulary:
  - "conducir" not "manejar"
  - "ordenador" not "computadora"
  - "ordenar" / "pedir" (context), never "ordenar" as American-Spanish "to order (a meal)"
  - Basic tu/usted: default to "usted" for travel-guide register, but don't be stiff.
- "Porto" stays as "Oporto" in Spanish (this IS the accepted ES form).
- No regional slang (Latin American or Spanish).

## Portuguese (pt-PT) — target locale, editorial rewrite
- Strict pt-PT. Never pt-BR.
  - "casa de banho" not "banheiro"
  - "autocarro" not "ônibus"
  - "pequeno-almoço" not "café da manhã"
  - "fato" = "suit" (clothing) NOT "fact"; "facto" = "fact" — common slip.
  - "equipa" not "equipe" (team)
- Avoid gerund overuse. Claude often over-produces "estamos a fazer / está a oferecer" — both are pt-PT grammatically correct, but in polished editorial prose Portuguese uses simple present or descriptive phrasing instead. Example: "oferece uma experiência" is better than "está a oferecer uma experiência".
- Avoid literal calques that look like translated English/Spanish:
  - "localizado em" → "em pleno", "à beira de", or a descriptive opener
  - "oferece uma experiência gastronómica única" → pick a concrete detail; the phrase is travel-guide cliché in every language
  - "combinando" + long list → break into two sentences
- Keep the European cadence — shorter sentences, precise vocabulary, no empty adjectives ("magnífico", "único", "incrível") unless really warranted.
- Geography: "Lisboa" (not "Lisbon"), "Porto" (not "Oporto"), "Algarve", "Madeira", "Funchal". Keep Portuguese venue names untouched.

# Cross-locale rules
- Preserve proper nouns, URLs, phone numbers, venue names, dish names, brand names unchanged.
- KEEP LENGTH PROPORTIONAL TO THE SOURCE. A 40-word short description should stay 35–50 words, not balloon to 100.
- If ALL THREE input locales have the field as null/empty, the output field MUST also be null. Never invent content.
- If at least one locale has content but others don't, use the available content as the fact basis and write the missing target from scratch.
- Don't translate literally. Rewrite naturally in each target language as if a native editor had written it from a brief.
- Treat the three inputs as one fact pool per field. If EN says the place has 300 stores and PT says "mais de 300 lojas", write "mais de 300 lojas" / "over 300 stores" / "más de 300 tiendas" consistently. If they conflict, prefer the more conservative/verifiable claim.
- If a claim in any input sounds like promotional puffery ("the oldest", "the most famous"), soften it unless strongly corroborated across locales.

# Few-shot examples

### Example 1: short_description
PT: "O cais mais icónico da cidade com vista panorâmica para o Tejo e para as colinas da capital."
EN: "The city's most iconic waterfront, offering panoramic views across the Tagus to the capital's hillsides."
ES: "El muelle más emblemático de la ciudad, con vistas panorámicas al Tajo y a las colinas de la capital."
(NOT "un lugar ideal para" — the ES rewrites naturally.)

### Example 2: goldenbook_note
PT: "Um refúgio de bom gosto onde Lisboa abranda — elegante, pausado e surpreendentemente silencioso."
EN: "A refined retreat where Lisbon slows down — elegant, unhurried, and surprisingly quiet."
ES: "Un refugio con criterio donde Lisboa baja el ritmo — elegante, pausado y sorprendentemente silencioso."

### Example 3: insider_tip
PT: "Peça uma mesa na varanda ao pôr do sol — a luz sobre o rio é difícil de igualar."
EN: "Ask for a table on the balcony at sunset — the light over the river is hard to beat."
ES: "Pida una mesa en la terraza al atardecer — la luz sobre el río es difícil de igualar."

# Output format
Return ONE JSON object with this shape — no preamble, no markdown, nothing outside the JSON:
{
  "translations": [
    {
      "place_id": "<uuid from input>",
      "pt": { "short_description": "...", "full_description": "...", "goldenbook_note": "...", "insider_tip": "..." },
      "en": { "short_description": "...", "full_description": "...", "goldenbook_note": "...", "insider_tip": "..." },
      "es": { "short_description": "...", "full_description": "...", "goldenbook_note": "...", "insider_tip": "..." }
    },
    ...
  ]
}

Every place in the input must appear in the output. Every output must include pt, en, AND es. Null fields stay null (only when ALL three inputs had null for that field). Never omit a field.`

// ─── DB ────────────────────────────────────────────────────────────────────

async function fetchEligiblePlaces(pool: Pool, limit?: number): Promise<PlaceInput[]> {
  // Find places with at least one editable translation row
  // (source != 'manual_fix' AND is_override = false).
  const { rows } = await pool.query<{
    place_id: string; slug: string
    pt_id: string | null; pt_name: string | null
    pt_short: string | null; pt_full: string | null; pt_note: string | null; pt_tip: string | null
    pt_override: boolean | null; pt_source: string | null
    en_id: string | null; en_name: string | null
    en_short: string | null; en_full: string | null; en_note: string | null; en_tip: string | null
    en_override: boolean | null; en_source: string | null
    es_id: string | null; es_name: string | null
    es_short: string | null; es_full: string | null; es_note: string | null; es_tip: string | null
    es_override: boolean | null; es_source: string | null
  }>(
    `
    SELECT p.id AS place_id, p.slug,
           pt.id AS pt_id, pt.name AS pt_name,
           pt.short_description AS pt_short, pt.full_description AS pt_full,
           pt.goldenbook_note AS pt_note, pt.insider_tip AS pt_tip,
           pt.is_override AS pt_override, pt.source AS pt_source,
           en.id AS en_id, en.name AS en_name,
           en.short_description AS en_short, en.full_description AS en_full,
           en.goldenbook_note AS en_note, en.insider_tip AS en_tip,
           en.is_override AS en_override, en.source AS en_source,
           es.id AS es_id, es.name AS es_name,
           es.short_description AS es_short, es.full_description AS es_full,
           es.goldenbook_note AS es_note, es.insider_tip AS es_tip,
           es.is_override AS es_override, es.source AS es_source
      FROM places p
      LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = 'pt'
      LEFT JOIN place_translations en ON en.place_id = p.id AND en.locale = 'en'
      LEFT JOIN place_translations es ON es.place_id = p.id AND es.locale = 'es'
     WHERE
           -- At least one of the three rows is eligible for rewrite
           ( (pt.source IS NULL OR (pt.source = 'manual' AND pt.is_override = false))
          OR (en.source IS NULL OR (en.source = 'manual' AND en.is_override = false))
          OR (es.source IS NULL OR (es.source = 'manual' AND es.is_override = false)) )
       AND
           -- At least one source has usable fact content across any locale
           ( COALESCE(pt.short_description,'') <> ''
          OR COALESCE(pt.full_description,'')  <> ''
          OR COALESCE(pt.goldenbook_note,'')   <> ''
          OR COALESCE(pt.insider_tip,'')       <> ''
          OR COALESCE(en.short_description,'') <> ''
          OR COALESCE(en.full_description,'')  <> ''
          OR COALESCE(en.goldenbook_note,'')   <> ''
          OR COALESCE(en.insider_tip,'')       <> ''
          OR COALESCE(es.short_description,'') <> ''
          OR COALESCE(es.full_description,'')  <> ''
          OR COALESCE(es.goldenbook_note,'')   <> ''
          OR COALESCE(es.insider_tip,'')       <> '' )
     ORDER BY p.slug
     ${limit ? `LIMIT ${limit}` : ''}
    `,
  )

  return rows.map(r => {
    const pt: LocaleFields = {
      name: r.pt_name ?? '',
      short_description: r.pt_short, full_description: r.pt_full,
      goldenbook_note: r.pt_note, insider_tip: r.pt_tip,
      is_override: !!r.pt_override, source: r.pt_source ?? '',
    }
    const en: LocaleFields | null = r.en_id ? {
      name: r.en_name ?? '',
      short_description: r.en_short, full_description: r.en_full,
      goldenbook_note: r.en_note, insider_tip: r.en_tip,
      is_override: !!r.en_override, source: r.en_source ?? '',
    } : null
    const es: LocaleFields | null = r.es_id ? {
      name: r.es_name ?? '',
      short_description: r.es_short, full_description: r.es_full,
      goldenbook_note: r.es_note, insider_tip: r.es_tip,
      is_override: !!r.es_override, source: r.es_source ?? '',
    } : null

    const targets: Array<'pt' | 'en' | 'es'> = []
    if (r.pt_id && !(r.pt_source === 'manual_fix' || r.pt_override)) targets.push('pt')
    if (r.en_id && !(r.en_source === 'manual_fix' || r.en_override)) targets.push('en')
    if (r.es_id && !(r.es_source === 'manual_fix' || r.es_override)) targets.push('es')

    return {
      place_id: r.place_id, slug: r.slug,
      translation_ids: { pt: r.pt_id ?? '', en: r.en_id, es: r.es_id },
      existing: { pt, en, es },
      targets,
    }
  })
}

// ─── LLM call ──────────────────────────────────────────────────────────────

function stripLocaleFields(l: LocaleFields | null) {
  if (!l) return null
  return {
    short_description: l.short_description,
    full_description:  l.full_description,
    goldenbook_note:   l.goldenbook_note,
    insider_tip:       l.insider_tip,
  }
}

async function translateBatch(client: Anthropic, batch: PlaceInput[]) {
  const userPayload = batch.map(p => ({
    place_id: p.place_id,
    name: p.existing.pt.name || p.existing.en?.name || p.existing.es?.name || p.slug,
    existing: {
      pt: stripLocaleFields(p.existing.pt),
      en: stripLocaleFields(p.existing.en),
      es: stripLocaleFields(p.existing.es),
    },
  }))

  // Use streaming — max_tokens > ~16000 requires it to avoid the 10-min
  // non-streaming HTTP timeout. `finalMessage()` rolls the chunks up into
  // a standard Message so the rest of this function is unchanged.
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    system: [
      {
        type: 'text',
        text: STYLE_GUIDE,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Translate these ${batch.length} places. Input:\n\n${JSON.stringify(userPayload, null, 2)}\n\nReturn only the JSON object.`,
      },
    ],
  })
  const response = await stream.finalMessage()

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text block in response')
  }
  let raw = textBlock.text.trim()
  // Some runs wrap in ```json fences despite instructions — strip if present.
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  const parsed = BatchSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    throw new Error(`Zod parse failed: ${parsed.error.message}`)
  }

  return { translations: parsed.data.translations, usage: response.usage }
}

// ─── Validation per field ─────────────────────────────────────────────────

const PT_MARKERS = /[ãõâêôç]/
const ES_MARKERS = /[ñ¿¡]/
function francToIso(code: string): Locale | 'und' {
  if (code === 'por') return 'pt'
  if (code === 'spa') return 'es'
  if (code === 'eng') return 'en'
  return 'und'
}

function fieldVerdict(text: string | null, target: Locale): 'ok' | 'empty' | 'wrong_lang' | 'suspicious' {
  if (!text || text.trim() === '') return 'empty'
  const hasPt = PT_MARKERS.test(text)
  const hasEs = ES_MARKERS.test(text)

  if (target === 'en' && (hasPt || hasEs)) return 'wrong_lang'
  if (target === 'es' && hasPt && !hasEs) return 'wrong_lang'
  if (target === 'pt' && hasEs && !hasPt) return 'wrong_lang'

  if (text.length < 20) return 'ok' // too short for franc
  const iso = francToIso(franc(text, { minLength: 10 }))
  if (iso === 'und') return 'suspicious'
  if (iso !== target && !(target === 'pt' && hasPt)) return 'wrong_lang'
  return 'ok'
}

// ─── CSV ──────────────────────────────────────────────────────────────────

function csvQuote(v: string | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\n✖ ANTHROPIC_API_KEY is not set in goldenbook-backend/.env')
    console.error('  Add it, then re-run.\n')
    process.exit(2)
  }
  if (!process.env.DATABASE_URL) {
    console.error('\n✖ DATABASE_URL missing\n')
    process.exit(2)
  }

  const client = new Anthropic()
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })

  const limit = SAMPLE_MODE ? SAMPLE_SIZE : undefined
  const allPlaces = await fetchEligiblePlaces(pool, limit)

  // Resume support: if a staging CSV already exists, skip places already in it.
  if (RESET && existsSync(OUT_CSV)) {
    writeFileSync(OUT_CSV, CSV_HEADER + '\n', 'utf8')
    console.log('─ --reset: staging CSV truncated to header')
  } else if (!existsSync(OUT_CSV)) {
    writeFileSync(OUT_CSV, CSV_HEADER + '\n', 'utf8')
  }
  const done = RESET ? new Set<string>() : loadDonePlaces()
  const places = allPlaces.filter(p => !done.has(p.place_id))

  console.log(`\n─ ${allPlaces.length} places eligible (${SAMPLE_MODE ? 'SAMPLE MODE' : 'FULL RUN'})`)
  if (done.size) console.log(`─ ${done.size} places already in staging — skipping`)
  console.log(`─ ${places.length} places to process`)
  console.log(`─ Batches of ${BATCH_SIZE} → ${Math.ceil(places.length / BATCH_SIZE)} API calls`)

  const issues: Array<{ place_id: string; locale: Locale; field: string; verdict: string }> = []
  let totalUsage = { input_tokens: 0, output_tokens: 0, cache_read: 0, cache_creation: 0 }
  let totalRowsWritten = done.size === 0 ? 0 : -1  // unknown from prior runs

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const batch = places.slice(i, i + BATCH_SIZE)
    const label = `batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(places.length / BATCH_SIZE)}`
    console.log(`\n${label} (${batch.length} places)...`)

    let result
    try {
      result = await translateBatch(client, batch)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✖ ${label} failed: ${msg}`)
      continue
    }

    totalUsage.input_tokens    += result.usage.input_tokens
    totalUsage.output_tokens   += result.usage.output_tokens
    totalUsage.cache_read      += (result.usage.cache_read_input_tokens ?? 0)
    totalUsage.cache_creation  += (result.usage.cache_creation_input_tokens ?? 0)
    console.log(`  ok · in=${result.usage.input_tokens} out=${result.usage.output_tokens} cache_read=${result.usage.cache_read_input_tokens ?? 0}`)

    // Map LLM results back to DB rows + append to staging CSV IMMEDIATELY.
    // This way a later crash doesn't lose already-processed work.
    const byId = new Map(batch.map(p => [p.place_id, p]))
    const batchLines: string[] = []
    for (const t of result.translations) {
      const place = byId.get(t.place_id)
      if (!place) {
        console.warn(`  ⚠  LLM returned unknown place_id=${t.place_id} — skipping`)
        continue
      }

      for (const locale of ['pt', 'en', 'es'] as const) {
        if (!place.targets.includes(locale)) continue
        const tgtId = place.translation_ids[locale]
        if (!tgtId) continue

        const tgtFields = t[locale]
        for (const field of ['short_description', 'full_description', 'goldenbook_note', 'insider_tip'] as const) {
          const existing = place.existing[locale]?.[field] ?? null
          const corrected = tgtFields[field]
          const verdict = fieldVerdict(corrected, locale)
          if (verdict === 'wrong_lang' || verdict === 'suspicious') {
            issues.push({ place_id: place.place_id, locale, field, verdict })
          }
          batchLines.push([
            csvQuote(place.place_id), csvQuote(place.slug),
            csvQuote(tgtId), csvQuote(locale), csvQuote(field),
            csvQuote(existing), csvQuote(corrected), csvQuote(verdict), '',
          ].join(','))
        }
      }
    }
    if (batchLines.length > 0) {
      appendFileSync(OUT_CSV, batchLines.join('\n') + '\n', 'utf8')
      if (totalRowsWritten >= 0) totalRowsWritten += batchLines.length
    }
  }

  const cost =
    (totalUsage.input_tokens / 1_000_000) * 3 +
    (totalUsage.output_tokens / 1_000_000) * 15 +
    (totalUsage.cache_creation / 1_000_000) * 3.75 +
    (totalUsage.cache_read / 1_000_000) * 0.3

  console.log('\n━━━ Summary ━━━')
  console.log(`  places processed this run : ${places.length}`)
  console.log(`  rows appended this run    : ${totalRowsWritten >= 0 ? totalRowsWritten : 'n/a (resumed)'}`)
  console.log(`  issues flagged            : ${issues.length}`)
  console.log(`  tokens in/out      : ${totalUsage.input_tokens} / ${totalUsage.output_tokens}`)
  console.log(`  cache read/write   : ${totalUsage.cache_read} / ${totalUsage.cache_creation}`)
  console.log(`  est. cost          : $${cost.toFixed(3)}`)
  console.log(`\n  staging CSV: ${OUT_CSV}`)
  if (SAMPLE_MODE) console.log(`\n  SAMPLE MODE — re-run with --all to process every eligible place.`)
  console.log()

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
