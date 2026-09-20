#!/usr/bin/env tsx
// ─── Data corrections from the 2026-09-20 audit ─────────────────────────────
//
// Two record-level fixes that the audit confirmed against production. Both are
// narrow, both target a named place by slug, and both print before/after.
//
// Run with --confirm to apply; without it, nothing is written.
//
//   1. ALGARVE WOW — `place_type` was 'restaurant' on a boat-experience
//      company whose editorial category is experiences/desporto.
//
//      `place_type` and the editorial category are independent fields with no
//      cross-validation, and it is `place_type` (not the category) that
//      auto-classify.ts reads to derive context and moment tags. So the wrong
//      type stamped the place with dinner/lunch/romantic/wine, which is why it
//      surfaced to guests as "Restaurante — Lunch in Algarve".
//
//      The recommendation engine was behaving correctly on bad input; this is
//      a data fix, not an algorithm change. Re-running the classifier after
//      the update regenerates the tags from the corrected type.
//
//   2. VILA DO PEIXE — `booking_url` pointed at VILA DA CARNE's TheFork page
//      (both rows held the identical URL, r78893). A guest reserving a table
//      at the fish restaurant would have been booked at the meat restaurant.
//
//      We clear it rather than guess a replacement: no reserve button is
//      strictly better than one that books the wrong venue, and the field is
//      trivially refilled once someone supplies the correct link. Note the
//      app only ever shows a venue's own booking_url — it never synthesises
//      affiliate links — so clearing this simply removes the CTA.

import { db } from '../db/postgres'
import { autoClassifyPlace } from '../modules/admin/places/auto-classify'

const CONFIRM = process.argv.includes('--confirm')

const ALGARVE_WOW = 'algarve-wow-experiences-algarve'
const VILA_DO_PEIXE = 'vila-do-peixe-restaurante-madeira'
const WRONG_BOOKING_URL = 'https://www.thefork.com/restaurant/vila-da-carne-r78893'

interface Row {
  id: string; slug: string; place_type: string; booking_url: string | null
  context_tags_auto: string[] | null; moment_tags_auto: string[] | null
}

async function fetchRow(slug: string): Promise<Row | null> {
  const { rows } = await db.query<Row>(
    `SELECT id, slug, place_type, booking_url, context_tags_auto, moment_tags_auto
       FROM places WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  return rows[0] ?? null
}

async function main() {
  if (!CONFIRM) console.log('\nDRY RUN — nothing will be written. Re-run with --confirm.\n')

  // ── 1. ALGARVE WOW place_type ──────────────────────────────────────────
  const wow = await fetchRow(ALGARVE_WOW)
  if (!wow) {
    console.log(`! ${ALGARVE_WOW} not found, skipping`)
  } else {
    console.log(`ALGARVE WOW`)
    console.log(`  place_type        ${wow.place_type} → activity`)
    console.log(`  context_tags_auto ${JSON.stringify(wow.context_tags_auto)}`)
    console.log(`  moment_tags_auto  ${JSON.stringify(wow.moment_tags_auto)}`)

    if (wow.place_type !== 'activity' && CONFIRM) {
      await db.query(`UPDATE places SET place_type = 'activity', updated_at = now() WHERE id = $1`, [wow.id])
      // Regenerate the derived tags from the corrected type. Without this the
      // dinner/lunch tags survive and the place keeps surfacing as a meal.
      await autoClassifyPlace(wow.id)
      const after = await fetchRow(ALGARVE_WOW)
      console.log(`  → now ${after?.place_type}`)
      console.log(`  → context_tags_auto ${JSON.stringify(after?.context_tags_auto)}`)
      console.log(`  → moment_tags_auto  ${JSON.stringify(after?.moment_tags_auto)}`)
    } else if (wow.place_type === 'activity') {
      console.log('  already correct, nothing to do')
    }
  }

  // ── 2. VILA DO PEIXE booking_url ───────────────────────────────────────
  const peixe = await fetchRow(VILA_DO_PEIXE)
  console.log(`\nVILA DO PEIXE`)
  if (!peixe) {
    console.log(`! ${VILA_DO_PEIXE} not found, skipping`)
  } else if (peixe.booking_url !== WRONG_BOOKING_URL) {
    // Guard on the exact wrong value so a re-run cannot clear a URL that
    // someone has since corrected.
    console.log(`  booking_url is ${peixe.booking_url ?? 'NULL'}, not the known-wrong one — leaving it alone`)
  } else {
    console.log(`  booking_url ${peixe.booking_url} (this is VILA DA CARNE's page) → NULL`)
    if (CONFIRM) {
      await db.query(`UPDATE places SET booking_url = NULL, updated_at = now() WHERE id = $1`, [peixe.id])
      console.log('  → cleared. Set the correct link when it is known.')
    }
  }
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })
