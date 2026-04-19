#!/usr/bin/env tsx
/**
 * apply-human-translations.ts
 *
 * Hand-written translations for the 12 rows that ChatGPT fumbled.
 * The other 11 rows that came back flagged are false positives (the
 * source_text is already correctly in the target locale) — no DB change
 * needed for those.
 *
 * Dry-run by default. --apply to execute inside one transaction.
 */

import { Pool } from 'pg'

const APPLY = process.argv.includes('--apply')

interface Fix {
  rowId: number
  slug: string          // just for the log
  translationId: string
  column: 'name' | 'short_description' | 'full_description' | 'goldenbook_note' | 'insider_tip'
  targetLocale: 'en' | 'es' | 'pt'
  text: string
  note?: string         // translator's rationale
}

// ─── Translations ──────────────────────────────────────────────────────────
// Rationale per fix in the `note` field. Tone choices:
//   • ES — peninsular Spanish, editorial, NOT literal from EN. Avoid "ideal"
//     overuse; prefer "imprescindible", "en pleno", etc.
//   • PT — pt-PT: "curadoria", "fragrâncias", "pequeno-almoço" style;
//     avoid gerunds; use "desfrutar" not "aproveitar" where editorial.
//   • EN — international travel-guide register; keep Portuguese place
//     names unchanged (Funchal, Madeira, Porto); metric units; no
//     contractions in long-form copy.

const fixes: Fix[] = [

  // ── Row 5 — Barbour (EN) — ChatGPT output was actually fine; filter
  // rejected it because franc couldn't decide on short text. Accept.
  {
    rowId: 5, slug: 'barbour-loios-porto',
    translationId: '932340e4-0f9f-5f1d-ad16-84ea254048ac',
    column: 'short_description', targetLocale: 'en',
    text: "One feature that sets Barbour's classic waxed cotton jackets apart is their legendary durability.",
    note: 'ChatGPT output reaccepted (franc was undecided; text is valid EN)',
  },

  // ── Row 9 — Seapleasure Madeira (ES long_description)
  {
    rowId: 9, slug: 'seapleasure-madeira',
    translationId: 'c59ad5ce-881d-49c1-8a89-bcff8a7b1b38',
    column: 'full_description', targetLocale: 'es',
    text: 'Seapleasure ofrece experiencias náuticas privadas a lo largo de la costa sur de Madeira. Desde el avistamiento de delfines hasta paseos al atardecer, su propuesta se centra en salidas para grupos reducidos que permiten descubrir el litoral de la isla de una forma personal y pausada.',
    note: 'Translated from PT reference; editorial ES, not literal',
  },

  // ── Row 15 — VMT Madeira (EN long_description)
  {
    rowId: 15, slug: 'vmtmadeira-madeira',
    translationId: '6cd7df84-a4c9-cafb-8961-edf50b785af2',
    column: 'full_description', targetLocale: 'en',
    text: 'Whale watching, kayaking, Desertas Islands trips, the Fajãs Route, firework displays, bespoke programmes and sport fishing.',
    note: 'Kept Portuguese place names (Fajãs, Desertas); fixed original PT typo "Obervação" → correct EN',
  },

  // ── Row 18 — Fashion Clinic Women (PT long_description)
  {
    rowId: 18, slug: 'fashion-clinic-women-lisboa',
    translationId: 'ce34a237-8dfa-7d93-d9d6-ef7eb5753747',
    column: 'full_description', targetLocale: 'pt',
    text: 'E muito mais. Uma curadoria de mais de 50 marcas de moda, fragrâncias e lifestyle.',
    note: 'pt-PT: "curadoria", "fragrâncias"; keep the loanword "lifestyle" (editorial register)',
  },

  // ── Row 21 — Alcino Flores Store (EN long_description)
  {
    rowId: 21, slug: 'alcino-flores-store-porto',
    translationId: 'a60f9636-13df-9d6f-db96-5d03d684f580',
    column: 'full_description', targetLocale: 'en',
    text: 'Here, tradition and innovation have built a legacy that now spans six generations. On our guided tour, you will watch our artisans bring the pieces sold in our stores to life, and get to know first-hand the story of a family devoted to this craft since 1902.',
    note: 'Spelled out "six" per EN editorial style; "first-hand" over "personally"',
  },

  // ── Row 22 — Wine Tours Madeira (EN long_description)
  {
    rowId: 22, slug: 'winetours-madeira',
    translationId: 'de204289-a06a-4898-a7c0-476ad6325a84',
    column: 'full_description', targetLocale: 'en',
    text: "Wine Tours Madeira offers guided tastings and experiences through the world of Madeira wine — one of the island's most distinctive cultural traditions. Set in Funchal's old town, the visits are designed to be informative and welcoming, even for those just getting acquainted with the region's wines.",
    note: 'Kept "Funchal", "Madeira" unchanged; em-dash for editorial rhythm',
  },

  // ── Row 23 — Wine Tours Madeira (EN goldenbook_note)
  {
    rowId: 23, slug: 'winetours-madeira',
    translationId: 'de204289-a06a-4898-a7c0-476ad6325a84',
    column: 'goldenbook_note', targetLocale: 'en',
    text: "A well-pitched introduction to one of Portugal's most underrated wine traditions.",
  },

  // ── Row 24 — Wine Tours Madeira (EN insider_tip)
  {
    rowId: 24, slug: 'winetours-madeira',
    translationId: 'de204289-a06a-4898-a7c0-476ad6325a84',
    column: 'insider_tip', targetLocale: 'en',
    text: 'Ask about the older vintages — Madeira wine improves with age in a way few other wines can match.',
  },

  // ── Row 25 — Wine Tours Madeira (ES goldenbook_note) — different translation_id
  {
    rowId: 25, slug: 'winetours-madeira',
    translationId: '6e895c6b-0d54-44e1-9162-238663ce5379',
    column: 'goldenbook_note', targetLocale: 'es',
    text: 'Una introducción cuidada a una de las tradiciones vinícolas más infravaloradas de Portugal.',
    note: '"cuidada" over "bien conducida" (literal calque); "infravaloradas" is peninsular ES',
  },

  // ── Row 26 — Quinta Magnólia (ES goldenbook_note)
  {
    rowId: 26, slug: 'quinta-magnolia-madeira',
    translationId: '1b368ff4-8899-47c3-8e30-0fe1777e8039',
    column: 'goldenbook_note', targetLocale: 'es',
    text: 'Un jardín donde Funchal baja el ritmo — refinado, verde y sorprendentemente silencioso.',
    note: '"baja el ritmo" natural over literal "abranda/disminuye"',
  },

  // ── Row 31 — Arneiro 1969 Lisboa (ES short_description)
  {
    rowId: 31, slug: 'arneiro-1969-lisboa',
    translationId: '12b7cf09-3d8d-4b23-a75c-f752a73d16c6',
    column: 'short_description', targetLocale: 'es',
    text: 'Una orfebrería portuguesa en Sintra que preserva la joyería tradicional desde 1969.',
    note: '"orfebrería" is the precise ES term for "ourivesaria"',
  },

  // ── Row 32 — El Corte Inglés (EN long_description) — longest fix
  {
    rowId: 32, slug: 'el-corte-ingles',
    translationId: '284858af-ebba-ff41-86a5-8ebe55c0f08a',
    column: 'full_description', targetLocale: 'en',
    text: `Discover the best brands, exclusive offers and unique experiences, all under one roof.

El Corte Inglés is a leading department store in Portugal and Spain, renowned for the excellence of its service and the breadth of its offering. It brings together fashion, beauty, technology, gourmet, home and much more — from the finest national and international brands — in a single space.

For non-resident international visitors, the 10% Reward Card and Tax Free scheme are the ideal way to make the most of your shopping: a card reserved for tourists that offers 10% off at hundreds of brands, plus immediate in-store Tax Free refunds — an El Corte Inglés exclusive.

For an exclusive, tailored service, please contact the International Desk on Floor 0 of the Lisbon store.

We look forward to welcoming you.`,
    note: 'Preserved brand-specific terms (10% Reward Card, Tax Free, International Desk); kept "El Corte Inglés" name unchanged',
  },
]

// ─── False positives (for the record; no DB action) ────────────────────────
const FALSE_POSITIVES = [
  { rowId: 4,  slug: 'david-rosas-madeira',              reason: 'Brand list is identical across pt/es ("Marcas representadas: ...")' },
  { rowId: 13, slug: 'david-rosas-madeira',              reason: 'Text is already correct English ("Brands represented: ...")' },
  { rowId: 14, slug: 'montblanc-porto',                  reason: 'Text is already correct pt-PT; franc misread diacritics' },
  { rowId: 16, slug: 'restaurante-doc-porto',            reason: 'Text is already correct pt-PT' },
  { rowId: 17, slug: 'uddo-algarve',                     reason: 'Text is already correct pt-PT' },
  { rowId: 19, slug: 'teleferico-jardim-botanico-madeira', reason: 'Text is already correct ES' },
  { rowId: 20, slug: 'vermuteria-gastro-bar-porto',      reason: 'Text is already correct ES' },
  { rowId: 29, slug: 'parrilla-natural-algarve',         reason: 'Text is already correct pt-PT (minor editorial typo "empana" not a locale issue)' },
  { rowId: 30, slug: 'as-vistas-restaurant-madeira',     reason: 'Text is already correct pt-PT' },
  { rowId: 33, slug: 'palacio-da-bolsa-porto',           reason: 'Text is already correct pt-PT ("Porto", não "Oporto")' },
  { rowId: 34, slug: 'miradouro-ponta-do-rosto-madeira', reason: 'Text is already correct pt-PT' },
]

// ─── Execute ───────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })
  const c = await pool.connect()
  try {
    if (APPLY) await c.query('BEGIN')

    console.log(APPLY ? '━━━ APPLYING ━━━' : '━━━ DRY-RUN ━━━')
    console.log(`\nFixes to write: ${fixes.length}`)
    console.log(`False positives (no DB change): ${FALSE_POSITIVES.length}\n`)

    for (const f of fixes) {
      const { rows } = await c.query<{ v: string | null }>(
        `SELECT ${f.column} AS v FROM place_translations WHERE id = $1`, [f.translationId],
      )
      if (rows.length === 0) {
        console.log(`  ✖  row ${f.rowId} [${f.slug}] translation_id not found — SKIP`)
        continue
      }
      const before = rows[0].v ?? '∅'

      console.log(`  ✓  row ${f.rowId} [${f.slug}] ${f.column} → ${f.targetLocale}`)
      console.log(`       from: ${before.slice(0, 110).replace(/\s+/g, ' ')}${before.length > 110 ? '…' : ''}`)
      console.log(`       to  : ${f.text.slice(0, 110).replace(/\s+/g, ' ')}${f.text.length > 110 ? '…' : ''}`)
      if (f.note) console.log(`       note: ${f.note}`)
      console.log()

      if (APPLY) {
        await c.query(
          `UPDATE place_translations
              SET ${f.column} = $1,
                  source = 'manual_fix',
                  is_override = true,
                  updated_at = now()
            WHERE id = $2`,
          [f.text, f.translationId],
        )
      }
    }

    console.log('\n━━━ False positives (no action needed) ━━━\n')
    for (const fp of FALSE_POSITIVES) {
      console.log(`  · row ${fp.rowId}  [${fp.slug}]  ${fp.reason}`)
    }

    if (APPLY) await c.query('COMMIT')
    console.log(APPLY ? '\nCommitted. content_version bumped.\n' : '\nDRY-RUN. Re-run with --apply.\n')
  } catch (err) {
    if (APPLY) await c.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    c.release()
    await pool.end()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
