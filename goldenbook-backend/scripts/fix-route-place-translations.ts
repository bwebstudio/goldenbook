#!/usr/bin/env tsx
/**
 * fix-route-place-translations.ts
 *
 * Targeted fixes for known-bad translations on route-linked places (the 24
 * places surfaced inside curated_routes for Algarve/Lisboa/Madeira/Porto).
 *
 * Each entry corresponds to a verified bug found by reading the content by
 * hand — not a franc heuristic. See route_places_audit.csv for the broader
 * scan; most rows flagged there are false positives on short or branded
 * text, so we only correct the six confirmed issues listed below.
 *
 * Corrections are applied with source='manual_fix', is_override=true so
 * future LLM passes do not clobber them. Updates are wrapped in one tx.
 *
 * Usage:
 *   cd goldenbook-backend
 *   npx tsx --env-file=.env scripts/fix-route-place-translations.ts
 *   npx tsx --env-file=.env scripts/fix-route-place-translations.ts --apply
 */
import { Pool } from 'pg'

const APPLY = process.argv.includes('--apply')

type Fix = {
  slug: string
  locale: 'en' | 'es' | 'pt'
  field: 'short_description' | 'full_description' | 'goldenbook_note' | 'insider_tip'
  before: string
  after: string
  reason: string
}

const FIXES: Fix[] = [
  {
    slug: 'winetours-madeira',
    locale: 'es',
    field: 'full_description',
    before: 'A Wine Tours Madeira oferece provas guiadas e experiências no mundo do vinho da Madeira, uma das tradições culturais mais distintivas da ilha. Situada en la tranquila zona de Funchal, las visitas están pensadas para ser informativas y agradables, incluso para quien quiera descubrir los vinos de la región.',
    after: 'Wine Tours Madeira ofrece catas guiadas y experiencias en torno al vino de Madeira, una de las tradiciones culturales más distintivas de la isla. Situada en la zona antigua de Funchal, las visitas están pensadas para ser informativas y acogedoras, también para quien se inicia en los vinos de la región.',
    reason: 'Mixed pt+es — first half was Portuguese, second half Spanish',
  },
  {
    slug: 'arneiro-1969-lisboa',
    locale: 'es',
    field: 'full_description',
    before: 'Fundada en 1969 en el corazón de Sintra, Arneiro es una auténtica casa de moda portuguesa donde la artesanía tradicional se encuentra con el diseño contemporáneo. La tienda reúne filigranas, cuentas de Viana, piezas barrocas y colecciones de diseñadores internacionales, todo en un espacio que honra el legado de la joyería portuguesa.',
    after: 'Fundada en 1969 en el corazón de Sintra, Arneiro es una auténtica casa de orfebrería portuguesa donde la artesanía tradicional se encuentra con el diseño contemporáneo. La tienda reúne filigranas, cuentas de Viana, piezas barrocas y colecciones propias junto a diseñadores internacionales — todo en un espacio que honra el legado de la joyería portuguesa.',
    reason: 'Wrong domain: "casa de moda" (fashion) — Arneiro is a goldsmith/jewelry house',
  },
  {
    slug: 'arneiro-1969-lisboa',
    locale: 'es',
    field: 'goldenbook_note',
    before: 'Uno de los últimos lugares donde la cocina tradicional portuguesa se mantiene genuinamente viva.',
    after: 'Uno de los últimos lugares donde la orfebrería tradicional portuguesa se siente genuinamente viva.',
    reason: 'Wrong domain: "cocina" (cuisine) — this is a jewelry shop, not a restaurant',
  },
  {
    slug: 'arneiro-1969-lisboa',
    locale: 'es',
    field: 'insider_tip',
    before: 'Pergunte por las colecciones de filigrana y cuentas de Viana - representan siglos de tradición artesanal portuguesa y son una compra verdaderamente local y con significado.',
    after: 'Pregunte por las colecciones de filigrana y las cuentas de Viana — representan siglos de tradición artesanal portuguesa y son una compra verdaderamente local y con significado.',
    reason: 'Starts with Portuguese word "Pergunte" (ES is "Pregunte")',
  },
  {
    slug: 'el-corte-ingles',
    locale: 'en',
    field: 'short_description',
    before: 'O seu destino de compras em Portugal',
    after: 'Your shopping destination in Portugal.',
    reason: 'Portuguese text in EN locale',
  },
  {
    slug: 'tacho-real-lisboa',
    locale: 'pt',
    field: 'short_description',
    before: 'Levamos os visitantes numa viagem de sabores sempre actuais, sem perderde vista o seu passado Sintrense.',
    after: 'Levamos os visitantes numa viagem de sabores sempre actuais, sem perder de vista o seu passado sintrense.',
    reason: 'Typo "perderde" → "perder de"; lowercased "sintrense" (adjective)',
  },
]

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(':5432/', ':6543/'),
    ssl: { rejectUnauthorized: false },
    max: 2,
  })
  const c = await pool.connect()
  try {
    console.log(`\n━ ${FIXES.length} targeted fixes queued\n`)
    if (APPLY) await c.query('BEGIN')

    for (const fx of FIXES) {
      const { rows } = await c.query(
        `SELECT pt.id AS tid, pt.${fx.field} AS current_val
           FROM place_translations pt
           JOIN places p ON pt.place_id = p.id
          WHERE p.slug = $1 AND pt.locale = $2`,
        [fx.slug, fx.locale],
      )
      if (rows.length === 0) {
        console.log(`  SKIP  [${fx.locale}] ${fx.slug} — no translation row`)
        continue
      }
      const { tid, current_val } = rows[0]
      if (current_val !== fx.before) {
        console.log(`  SKIP  [${fx.locale}] ${fx.slug}.${fx.field} — current value differs from expected "before", aborting to avoid clobbering drift`)
        console.log(`        current: ${(current_val || '').slice(0, 120)}`)
        console.log(`        expect : ${fx.before.slice(0, 120)}`)
        continue
      }
      console.log(`  FIX   [${fx.locale}] ${fx.slug}.${fx.field}`)
      console.log(`        reason: ${fx.reason}`)
      console.log(`        before: ${fx.before.slice(0, 140)}`)
      console.log(`        after : ${fx.after.slice(0, 140)}`)
      if (APPLY) {
        await c.query(
          `UPDATE place_translations
              SET ${fx.field} = $1,
                  source = 'manual_fix',
                  is_override = true,
                  updated_at = now()
            WHERE id = $2`,
          [fx.after, tid],
        )
      }
    }

    if (APPLY) await c.query('COMMIT')
    console.log(APPLY ? '\n━━━ APPLIED (committed) ━━━\n' : '\n━━━ DRY-RUN — re-run with --apply ━━━\n')
  } catch (err) {
    if (APPLY) await c.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    c.release()
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
